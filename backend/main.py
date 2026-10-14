"""
订单查重系统 — FastAPI 主入口
提供 REST API：认证/权限/邀请码/公司/用户管理 + 上传/解析/查重/CRUD
"""
from __future__ import annotations
import os
import json
import re
import uuid
import shutil
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import Optional, Union
from fastapi import FastAPI, File, UploadFile, Depends, HTTPException, Query, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from database import get_db, init_db
from models import Order, User, Company, InviteCode
from excel_parser import auto_match_columns, parse_file
from crud import (
    create_order, create_orders_batch,
    get_orders, get_order_by_id,
    update_order, delete_order, delete_orders_batch, delete_orders_by_filename,
    find_duplicate_groups,
    mark_order_processed, mark_orders_processed,
    get_all_filenames, check_filename_exists,
    get_user_by_username, get_user_by_email, get_user_by_id, create_user,
    update_last_login, update_user_password, update_user_valid_until,
    delete_user_and_data, get_managed_users, get_descendant_users,
    get_company_by_name, get_company_by_id, create_company, update_company_password,
    create_invite_code, get_invite_code, get_invite_code_by_id,
    get_invite_codes_by_creator, delete_invite_code, revoke_invite_code,
)
from duplicate_checker import check_duplicates, check_single_duplicate
from auth import (
    hash_password, verify_password, generate_token, generate_invite_code,
    get_current_user, get_pending_user, get_logged_in_user,
    get_optional_credentials, require_role,
)
from scheduler import start_scheduler, shutdown_scheduler
from seed import seed_initial_data

# ============================================================
# 应用生命周期
# ============================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """启动时初始化数据库 & 预置数据 & 定时任务，关闭时清理"""
    init_db()
    seed_initial_data()
    start_scheduler()
    yield
    shutdown_scheduler()

app = FastAPI(
    title="订单查重管理系统",
    description="订单表格上传、解析、查重与数据管理 API",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS 配置（开发环境允许所有来源）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# 全局异常处理器 — 防止未捕获异常导致进程崩溃
# ============================================================

import traceback
import sys
from starlette.responses import JSONResponse
from starlette.requests import Request


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """捕获所有未处理异常，返回友好错误信息并记录日志，防止进程退出"""
    print(f"[严重错误] {request.method} {request.url.path}: {exc}", file=sys.stderr)
    traceback.print_exc(file=sys.stderr)
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "message": f"服务器内部错误: {str(exc)}",
            "data": None,
        },
    )

# 上传文件临时目录（项目根目录下的 data/uploads/）
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UPLOAD_DIR = os.path.join(PROJECT_ROOT, "data", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# ============================================================
# Pydantic 模型
# ============================================================

class OrderCreate(BaseModel):
    name: str
    address: str
    phone: str
    product_model: str   # 必填
    shipped: bool = False

class OrderUpdate(BaseModel):
    name: str
    address: str
    phone: str
    product_model: str   # 必填
    shipped: bool = False

class BatchDelete(BaseModel):
    ids: list[int]

class FileNameDelete(BaseModel):
    filename: str

class ProcessDuplicateBody(BaseModel):
    """处理重复组：保留指定ID，其余标记为已处理"""
    keep_id: int
    group_order_ids: list[int]

class ColumnMapping(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    product_model: Optional[str] = None

class ApiResponse(BaseModel):
    success: bool
    data: Optional[Union[dict, list]] = None
    message: str = ""


# ---------- 认证 / 权限相关模型 ----------

class RegisterBody(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6, max_length=100)
    email: str = Field(..., max_length=200)
    invite_code: str = Field(..., max_length=50)


class CompanySetupBody(BaseModel):
    action: str = Field(..., description="join=加入公司 / create=创建新公司")
    company_name: str = Field(..., max_length=200)
    company_password: str = Field(..., min_length=6, max_length=100)


class LoginBody(BaseModel):
    username: str
    password: str


class ChangePasswordBody(BaseModel):
    old_password: str
    new_password: str = Field(..., min_length=6, max_length=100)


class ChangeCompanyPasswordBody(BaseModel):
    old_password: str
    new_password: str = Field(..., min_length=6, max_length=100)


class InviteCreateBody(BaseModel):
    level: int = Field(..., description="1=一级(管理员) / 2=二级(用户)")
    valid_until: datetime


class ExtendUserBody(BaseModel):
    valid_until: datetime

# ============================================================
# API 路由
# ============================================================

@app.get("/api/health")
def health_check():
    """健康检查"""
    return {"success": True, "message": "服务运行正常"}


# ============================================================
# 认证 / 公司 / 邀请码 / 用户管理
# ============================================================

EMAIL_RE = re.compile(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$")


def _to_naive_utc(dt: datetime) -> datetime:
    """统一转换为 naive UTC（数据库与 datetime.utcnow() 比较需要 naive）"""
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def _calc_days_left(user: User) -> Optional[int]:
    """剩余有效天数；永久有效返回 None"""
    if user.valid_until is None:
        return None
    diff = (user.valid_until - datetime.utcnow()).total_seconds()
    return max(0, int(diff // 86400))


def _user_dict(user: User, db: Session) -> dict:
    """用户字典（含公司名与剩余天数），不含敏感字段"""
    data = user.to_dict()
    data["days_left"] = _calc_days_left(user)
    if user.company_id:
        company = get_company_by_id(db, user.company_id)
        data["company_name"] = company.name if company else None
    else:
        data["company_name"] = None
    return data


# ---------- 认证 ----------

@app.post("/api/auth/register")
def register(body: RegisterBody, db: Session = Depends(get_db)):
    """注册：校验用户名/邮箱/邀请码，创建账号（待完成公司设置）"""
    username = body.username.strip()
    email = body.email.strip().lower()

    if not re.match(r"^[A-Za-z0-9_\u4e00-\u9fa5]{3,20}$", username):
        raise HTTPException(status_code=400, detail="用户名需为3-20位字母、数字、下划线或中文")
    if not EMAIL_RE.match(email):
        raise HTTPException(status_code=400, detail="邮箱格式不正确")
    if get_user_by_username(db, username):
        raise HTTPException(status_code=400, detail="用户名已被注册")
    if get_user_by_email(db, email):
        raise HTTPException(status_code=400, detail="该邮箱已被注册")

    invite = get_invite_code(db, body.invite_code.strip())
    if not invite or invite.status != "unused":
        raise HTTPException(status_code=400, detail="邀请码无效或已被使用")
    if invite.valid_until <= datetime.utcnow():
        raise HTTPException(status_code=400, detail="邀请码已过期")

    role = "admin" if invite.level == 1 else "user"
    user = create_user(db, username, hash_password(body.password), email, role,
                       valid_until=invite.valid_until, invited_by=invite.created_by)
    # 已使用的邀请码自动删除（邀请关系已记录在 user.invited_by，可追溯）
    delete_invite_code(db, invite)
    # 发放 pending token，供下一步"公司设置"使用
    user.token = generate_token()
    db.commit()
    db.refresh(user)

    return {
        "success": True,
        "data": {
            "need_company": True,
            "role": role,
            "user_id": user.id,
            "token": user.token,
            "user": _user_dict(user, db),
        },
        "message": "注册成功，请设置公司信息",
    }


@app.post("/api/auth/company-setup")
def company_setup(body: CompanySetupBody, user: User = Depends(get_pending_user),
                  db: Session = Depends(get_db)):
    """公司设置：加入公司 / 创建新公司（仅 pending_company 状态可调用）"""
    name = body.company_name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="请输入公司名称")
    if len(name) > 200:
        raise HTTPException(status_code=400, detail="公司名称过长")
    if body.action not in ("join", "create"):
        raise HTTPException(status_code=400, detail="无效的操作类型")
    # 普通用户（二级邀请码注册）仅能加入公司
    if user.role == "user" and body.action != "join":
        raise HTTPException(status_code=400, detail="普通用户仅能加入公司，不能创建公司")

    if body.action == "join":
        company = get_company_by_name(db, name)
        if not company:
            raise HTTPException(status_code=400, detail="公司不存在，请检查公司名称")
        if not verify_password(body.company_password, company.password_hash):
            raise HTTPException(status_code=400, detail="公司密码不正确")
    else:  # create 创建新公司
        if get_company_by_name(db, name):
            raise HTTPException(status_code=400, detail="该公司名称已存在")
        company = create_company(db, name, hash_password(body.company_password), user.id)

    # 绑定公司并激活账号
    user.company_id = company.id
    user.status = "active"
    user.token = generate_token()
    user.last_login_at = datetime.utcnow()
    db.commit()
    db.refresh(user)

    return {
        "success": True,
        "data": {"token": user.token, "user": _user_dict(user, db)},
        "message": "公司设置完成，欢迎使用",
    }


@app.post("/api/auth/login")
def login(body: LoginBody, db: Session = Depends(get_db)):
    """登录：校验用户名/密码/账号状态，返回 token 与用户信息"""
    user = get_user_by_username(db, body.username.strip())
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="用户名或密码错误")

    # 待完成公司设置的账号：允许登录以继续公司设置
    if user.status == "pending_company":
        user.token = generate_token()
        db.commit()
        return {
            "success": True,
            "data": {
                "need_company": True,
                "token": user.token,
                "user": _user_dict(user, db),
            },
            "message": "请先完成公司设置",
        }

    # 有效时间到期 → 禁止登录并提示
    if user.valid_until is not None and user.valid_until <= datetime.utcnow():
        if user.status == "active":
            user.status = "expired"
            user.token = None
            db.commit()
        raise HTTPException(status_code=403, detail="账号已到期，请联系管理员延长有效期")
    if user.status == "expired":
        raise HTTPException(status_code=403, detail="账号已到期，请联系管理员延长有效期")
    if user.status != "active":
        raise HTTPException(status_code=403, detail="账号已被禁用")

    user.token = generate_token()
    user.last_login_at = datetime.utcnow()
    db.commit()
    db.refresh(user)

    return {
        "success": True,
        "data": {"token": user.token, "user": _user_dict(user, db)},
        "message": "登录成功",
    }


@app.post("/api/auth/guest-login")
def guest_login(db: Session = Depends(get_db)):
    """游客登录：免账号密码，可使用全部订单功能；数据不保留，退出后自动清除"""
    guest = db.query(User).filter(User.is_guest == True).first()
    if not guest:
        raise HTTPException(status_code=500, detail="游客账号未初始化")
    guest.token = generate_token()
    db.commit()
    return {
        "success": True,
        "data": {"token": guest.token, "user": _user_dict(guest, db)},
        "message": "已以游客身份登录，数据不会保留",
    }


@app.post("/api/auth/logout")
def logout(credentials: Optional[HTTPAuthorizationCredentials] = Depends(get_optional_credentials),
           db: Session = Depends(get_db)):
    """登出：清除会话 token（幂等）；游客退出时同时清除其全部订单数据"""
    if credentials and credentials.credentials:
        user = db.query(User).filter(User.token == credentials.credentials).first()
        if user:
            if user.is_guest:
                # 游客退出登录：清除所有使用痕迹（订单数据）
                db.query(Order).filter(Order.owner_id == user.id).delete(synchronize_session=False)
            user.token = None
            db.commit()
    return {"success": True, "message": "已退出登录"}


@app.get("/api/auth/me")
def me(user: User = Depends(get_logged_in_user), db: Session = Depends(get_db)):
    """当前登录用户信息（含 pending 状态，便于前端刷新后恢复公司设置流程）"""
    return {"success": True, "data": _user_dict(user, db)}


@app.put("/api/auth/password")
def change_password(body: ChangePasswordBody, user: User = Depends(get_current_user),
                    db: Session = Depends(get_db)):
    """修改自己的登录密码"""
    if not verify_password(body.old_password, user.password_hash):
        raise HTTPException(status_code=400, detail="原密码不正确")
    update_user_password(db, user, hash_password(body.new_password))
    return {"success": True, "message": "密码修改成功"}


# ---------- 公司 ----------

@app.get("/api/companies/check")
def check_company(name: str = Query(..., description="公司名称"),
                  _: User = Depends(get_logged_in_user), db: Session = Depends(get_db)):
    """检查公司名称是否已存在（登录用户即可，含待设置公司的用户）"""
    return {
        "success": True,
        "data": {"exists": get_company_by_name(db, name.strip()) is not None},
    }


@app.put("/api/companies/password")
def change_company_password(body: ChangeCompanyPasswordBody,
                            user: User = Depends(require_role("admin", "super_admin")),
                            db: Session = Depends(get_db)):
    """修改本公司密码（仅管理员及以上）"""
    company = get_company_by_id(db, user.company_id)
    if not company:
        raise HTTPException(status_code=400, detail="您尚未加入任何公司")
    if not verify_password(body.old_password, company.password_hash):
        raise HTTPException(status_code=400, detail="原公司密码不正确")
    update_company_password(db, company, hash_password(body.new_password))
    return {"success": True, "message": "公司密码修改成功"}


# ---------- 邀请码 ----------

@app.post("/api/invite-codes")
def create_invite(body: InviteCreateBody, user: User = Depends(get_current_user),
                  db: Session = Depends(get_db)):
    """分发邀请码：super_admin 可发一级/二级；admin 仅二级"""
    if body.level not in (1, 2):
        raise HTTPException(status_code=400, detail="邀请码级别无效")
    if user.role == "user":
        raise HTTPException(status_code=403, detail="无权限分发邀请码")
    if user.role != "super_admin" and body.level == 1:
        raise HTTPException(status_code=403, detail="仅最高级管理员可分发一级邀请码")
    if _to_naive_utc(body.valid_until) <= datetime.utcnow():
        raise HTTPException(status_code=400, detail="有效时间必须晚于当前时间")

    code = generate_invite_code()
    while get_invite_code(db, code):
        code = generate_invite_code()
    invite = create_invite_code(db, code, body.level, user.id, _to_naive_utc(body.valid_until))
    return {
        "success": True,
        "data": invite.to_dict(),
        "message": f"{'一级' if body.level == 1 else '二级'}邀请码创建成功",
    }


@app.get("/api/invite-codes")
def list_invites(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """查看我分发的邀请码列表"""
    if user.role == "user":
        raise HTTPException(status_code=403, detail="无权限查看邀请码")
    invites = get_invite_codes_by_creator(db, user.id)
    return {"success": True, "data": [i.to_dict() for i in invites]}


@app.delete("/api/invite-codes/{invite_id}")
def revoke_invite(invite_id: int, user: User = Depends(get_current_user),
                  db: Session = Depends(get_db)):
    """作废未使用的邀请码（仅本人分发的）"""
    invite = get_invite_code_by_id(db, invite_id)
    if not invite or invite.created_by != user.id:
        raise HTTPException(status_code=404, detail="邀请码不存在")
    if invite.status != "unused":
        raise HTTPException(status_code=400, detail="仅未使用的邀请码可作废")
    revoke_invite_code(db, invite)
    return {"success": True, "message": "邀请码已作废"}


# ---------- 用户管理（管理员/超级管理员）----------

@app.get("/api/admin/users")
def list_managed_users(user: User = Depends(require_role("admin", "super_admin")),
                       db: Session = Depends(get_db)):
    """账号列表：本账户 + 本账户分发的邀请码所注册的账户（超级管理员与管理员统一）"""
    users = get_managed_users(db, user)
    return {
        "success": True,
        "data": [_user_dict(u, db) for u in users],
    }


@app.put("/api/admin/users/{user_id}/extend")
def extend_user(user_id: int, body: ExtendUserBody,
                manager: User = Depends(require_role("admin", "super_admin")),
                db: Session = Depends(get_db)):
    """延长账号有效时间（仅管理范围内）"""
    target = get_user_by_id(db, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="账号不存在")
    if target.role == "super_admin":
        raise HTTPException(status_code=400, detail="不能修改最高级管理员的有效时间")
    if target.id == manager.id:
        raise HTTPException(status_code=400, detail="不能修改自己的有效时间")
    managed = get_managed_users(db, manager)
    if target not in managed:
        raise HTTPException(status_code=403, detail="该账号不在您的管理范围内")
    if _to_naive_utc(body.valid_until) <= datetime.utcnow():
        raise HTTPException(status_code=400, detail="有效时间必须晚于当前时间")
    update_user_valid_until(db, target, _to_naive_utc(body.valid_until))
    return {"success": True, "message": f"已延长账号「{target.username}」的有效时间"}


@app.delete("/api/admin/users/{user_id}")
def delete_managed_user(user_id: int,
                        manager: User = Depends(require_role("admin", "super_admin")),
                        db: Session = Depends(get_db)):
    """
    清除账号。
    超级管理员清除管理员时，其下通过该管理员二级邀请码注册的用户同步清除。
    """
    target = get_user_by_id(db, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="账号不存在")
    if target.role == "super_admin":
        raise HTTPException(status_code=400, detail="不能清除最高级管理员")
    if target.id == manager.id:
        raise HTTPException(status_code=400, detail="不能清除自己的账号")
    managed = get_managed_users(db, manager)
    if target not in managed:
        raise HTTPException(status_code=403, detail="该账号不在您的管理范围内")

    if target.role == "admin":
        # 级联清除：该管理员分发的二级邀请码注册的用户
        descendants = get_descendant_users(db, target)
        for desc in descendants:
            delete_user_and_data(db, desc)
        print(f"[账号清除] 管理员「{target.username}」及其下 {len(descendants)} 个用户账号已同步清除")

    delete_user_and_data(db, target)
    return {"success": True, "message": f"账号「{target.username}」已清除"}


# ---------- 上传相关 ----------

@app.post("/api/upload/preview")
def upload_preview(file: UploadFile = File(...), user: User = Depends(get_current_user),
                  db: Session = Depends(get_db)):
    """
    上传文件并预览表头匹配结果（不实际入库）。
    返回所有表头和自动匹配的建议列名。
    同时检查文件名是否已存在（按账户隔离），防止重复导入同一文件。
    """
    # 验证文件类型
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in (".xlsx", ".xls", ".csv"):
        raise HTTPException(status_code=400, detail="仅支持 .xlsx / .xls / .csv 文件")

    # 检查文件名是否已存在（当前账户范围内）
    if check_filename_exists(db, file.filename, owner_id=user.id):
        raise HTTPException(
            status_code=409,
            detail=f"文件名「{file.filename}」已存在，不允许重复导入同一文件",
        )

    # 保存临时文件
    file_id = uuid.uuid4().hex
    tmp_path = os.path.join(UPLOAD_DIR, f"{file_id}{ext}")
    try:
        with open(tmp_path, "wb") as f:
            shutil.copyfileobj(file.file, f)

        result = auto_match_columns(tmp_path)
        return {
            "success": True,
            "data": {
                "file_id": file_id,
                "headers": result["headers"],
                "matched": result["matched"],
                "all_matched": result["all_matched"],
            },
            "message": "表头匹配完成" if result["all_matched"] else "部分列未能自动匹配，请手动选择",
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"文件解析失败: {str(e)}")
    finally:
        # 清理临时文件
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


@app.post("/api/upload/import")
def upload_import(
    file: UploadFile = File(...),
    name_col: str = Query(..., description="姓名列名"),
    address_col: str = Query(..., description="地址列名"),
    phone_col: str = Query(..., description="电话列名"),
    product_model_col: str = Query("", description="产品型号列名"),
    shipped: bool = Query(False, description="是否已发货"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    确认导入：根据用户指定（或自动匹配）的列名解析文件并入库，同时进行重复检测。
    入库记录归属当前登录账户。
    """
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in (".xlsx", ".xls", ".csv"):
        raise HTTPException(status_code=400, detail="仅支持 .xlsx / .xls / .csv 文件")

    # 产品型号为必填：必须提供产品型号列
    if not product_model_col:
        raise HTTPException(status_code=400, detail="缺少产品型号列（产品型号为必填）")

    # 检查文件名是否已存在（当前账户范围内）
    if check_filename_exists(db, file.filename, owner_id=user.id):
        raise HTTPException(
            status_code=409,
            detail=f"文件名「{file.filename}」已存在，不允许重复导入同一文件",
        )

    file_id = uuid.uuid4().hex
    tmp_path = os.path.join(UPLOAD_DIR, f"{file_id}{ext}")
    try:
        with open(tmp_path, "wb") as f:
            shutil.copyfileobj(file.file, f)

        # 解析文件
        records = parse_file(tmp_path, name_col, address_col, phone_col,
                             product_model_col=product_model_col or None)

        if not records:
            raise HTTPException(status_code=400, detail="文件中未提取到有效数据")

        # 重复检测（当前账户范围内）
        duplicates = check_duplicates(db, records, owner_id=user.id)

        # 入库（记录文件名，归属当前账户）
        batch_id = file_id
        orders = create_orders_batch(db, records, batch_id=batch_id,
                                     filename=file.filename, shipped=shipped,
                                     owner_id=user.id)

        return {
            "success": True,
            "data": {
                "total": len(orders),
                "inserted": len(orders),
                "duplicates": duplicates,
                "has_duplicates": len(duplicates) > 0,
            },
            "message": f"成功导入 {len(orders)} 条记录" + (
                f"，发现 {len(duplicates)} 条重复" if duplicates else ""
            ),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导入失败: {str(e)}")
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


@app.post("/api/upload/batch-import")
def upload_batch_import(
    files: list[UploadFile] = File(...),
    mappings_json: str = Form(..., description='''JSON 字符串，格式:
        [
            {"name_col": "姓名", "address_col": "地址", "phone_col": "电话", "product_model_col": "产品型号", "shipped": false},
            {"name_col": "收件人", "address_col": "收货地址", "phone_col": "手机号", "shipped": true}
        ]
        shipped 字段可选，默认 false。
        注意：数组顺序需与 files 中的文件顺序一一对应。
    '''),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    批量导入：一次上传多个表格文件并入库，进行重复检测。
    mappings_json 通过表单字段传递，避免 URL 长度限制。
    数组顺序与 files 中的文件顺序一一对应。
    """
    try:
        mapping_list = json.loads(mappings_json)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="mappings_json 格式错误，需要 JSON 数组")

    if len(mapping_list) != len(files):
        raise HTTPException(
            status_code=400,
            detail=f"列映射数量 ({len(mapping_list)}) 与文件数量 ({len(files)}) 不匹配"
        )

    file_results = []
    all_duplicates: list = []
    total_inserted = 0
    total_records = 0

    for idx, file in enumerate(files):
        ext = os.path.splitext(file.filename)[1].lower()
        if ext not in (".xlsx", ".xls", ".csv"):
            file_results.append({
                "filename": file.filename,
                "success": False,
                "error": "不支持的文件格式",
            })
            continue

        # 检查文件名是否已存在（当前账户范围内）
        if check_filename_exists(db, file.filename, owner_id=user.id):
            file_results.append({
                "filename": file.filename,
                "success": False,
                "error": f"文件名「{file.filename}」已存在，不允许重复导入",
            })
            continue

        mapping = mapping_list[idx]
        name_col = mapping["name_col"]
        address_col = mapping["address_col"]
        phone_col = mapping["phone_col"]
        product_model_col = mapping.get("product_model_col", "")
        file_shipped = mapping.get("shipped", False)

        # 产品型号为必填
        if not product_model_col:
            file_results.append({
                "filename": file.filename,
                "success": False,
                "error": "缺少产品型号列（产品型号为必填）",
            })
            continue

        file_id = uuid.uuid4().hex
        tmp_path = os.path.join(UPLOAD_DIR, f"{file_id}{ext}")
        try:
            with open(tmp_path, "wb") as f:
                shutil.copyfileobj(file.file, f)

            records = parse_file(tmp_path, name_col, address_col, phone_col,
                                 product_model_col=product_model_col or None)

            if not records:
                file_results.append({
                    "filename": file.filename,
                    "success": False,
                    "error": "未提取到有效数据",
                })
                continue

            duplicates = check_duplicates(db, records, owner_id=user.id)
            orders = create_orders_batch(db, records, batch_id=file_id,
                                         filename=file.filename, shipped=file_shipped,
                                         owner_id=user.id)

            total_records += len(records)
            total_inserted += len(orders)
            all_duplicates.extend(duplicates)

            file_results.append({
                "filename": file.filename,
                "success": True,
                "total": len(records),
                "inserted": len(orders),
                "duplicates_count": len(duplicates),
            })
        except Exception as e:
            file_results.append({
                "filename": file.filename,
                "success": False,
                "error": str(e),
            })
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)

    return {
        "success": True,
        "data": {
            "file_results": file_results,
            "total_files": len(files),
            "total_records": total_records,
            "total_inserted": total_inserted,
            "total_duplicates": len(all_duplicates),
            "duplicates": all_duplicates,
            "has_duplicates": len(all_duplicates) > 0,
        },
        "message": (
            f"成功导入 {total_inserted} 条记录"
            + (f"，发现 {len(all_duplicates)} 条重复" if all_duplicates else "")
        ),
    }


# ---------- 订单 CRUD ----------

@app.get("/api/orders")
def list_orders(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    search: Optional[str] = Query(None, description="搜索关键词（姓名/电话）"),
    filename: Optional[str] = Query(None, description="按文件名筛选"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """分页查询订单列表（仅当前账户数据）"""
    skip = (page - 1) * page_size
    orders, total = get_orders(db, skip=skip, limit=page_size, search=search,
                                filename_filter=filename, owner_id=user.id)

    return {
        "success": True,
        "data": {
            "items": [o.to_dict() for o in orders],
            "total": total,
            "page": page,
            "page_size": page_size,
        },
    }


# ---------- 文件名相关 ----------

@app.get("/api/orders/filenames")
def list_filenames(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """获取所有来源文件名列表（仅当前账户数据）"""
    filenames = get_all_filenames(db, owner_id=user.id)
    return {
        "success": True,
        "data": filenames,
    }


@app.post("/api/orders/delete-by-filename")
def delete_by_filename(body: FileNameDelete, user: User = Depends(get_current_user),
                       db: Session = Depends(get_db)):
    """
    根据文件名删除所有关联订单（用于清理误上传的无关数据，仅当前账户）。
    """
    if not body.filename:
        raise HTTPException(status_code=400, detail="请提供文件名")
    count = delete_orders_by_filename(db, body.filename, owner_id=user.id)
    return {
        "success": True,
        "data": {"deleted_count": count},
        "message": f"成功删除 {count} 条来自「{body.filename}」的记录",
    }


# ---------- 重复检测与处理（必须在 {order_id} 之前定义）----------

@app.get("/api/orders/duplicates")
def list_duplicate_groups(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    查找所有重复组（姓名+地址+电话+产品型号 完全相同的未处理记录，仅当前账户）。
    返回重复组列表，每组包含该组的所有订单（按expire_at降序）。
    """
    groups = find_duplicate_groups(db, owner_id=user.id)
    return {
        "success": True,
        "data": {
            "groups": groups,
            "total_groups": len(groups),
            "duplicate_order_ids": list(set(
                o["id"] for g in groups for o in g["orders"]
            )),
        },
    }


@app.post("/api/orders/process-duplicate-group")
def process_duplicate_group(body: ProcessDuplicateBody, user: User = Depends(get_current_user),
                            db: Session = Depends(get_db)):
    """
    处理一个重复组：保留指定记录，组内其他重复记录【删除】（仅当前账户）。

    改为“删除”而非“标记已处理”，目的是真正消除重复：
    - 已处理记录仍会参与后续重复检测，若仅标记会一直提醒；
    - 删除被确认的重复项后，保留记录即成为该键下的唯一记录。
    """
    try:
        to_delete = [oid for oid in body.group_order_ids if oid != body.keep_id]
        if not to_delete:
            return {
                "success": True,
                "data": {"kept_id": body.keep_id, "deleted_ids": []},
                "message": "无需处理（该组只有一条记录）",
            }
        count = delete_orders_batch(db, to_delete, owner_id=user.id)
        return {
            "success": True,
            "data": {
                "kept_id": body.keep_id,
                "deleted_ids": to_delete,
            },
            "message": f"已删除 {count} 条重复记录，保留订单 #{body.keep_id}",
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"处理重复组失败: {str(e)}")


@app.get("/api/orders/{order_id}")
def get_order(order_id: int, user: User = Depends(get_current_user),
              db: Session = Depends(get_db)):
    """查询单条订单详情（仅当前账户）"""
    order = get_order_by_id(db, order_id, owner_id=user.id)
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")
    return {"success": True, "data": order.to_dict()}


@app.post("/api/orders")
def create_order_manual(order: OrderCreate, user: User = Depends(get_current_user),
                        db: Session = Depends(get_db)):
    """手动新增订单（含重复检测，归属当前账户）"""
    # 检查是否有重复
    dup = check_single_duplicate(db, order.name, order.address, order.phone,
                                  product_model=order.product_model, owner_id=user.id)
    new_order = create_order(db, order.name, order.address, order.phone,
                             product_model=order.product_model, shipped=order.shipped,
                             owner_id=user.id)

    return {
        "success": True,
        "data": {
            "order": new_order.to_dict(),
            "duplicate": dup,
            "has_duplicate": dup is not None,
        },
        "message": "新增成功" + ("，但发现重复订单！" if dup else ""),
    }


@app.put("/api/orders/{order_id}")
def update_order_route(order_id: int, order: OrderUpdate,
                       user: User = Depends(get_current_user),
                       db: Session = Depends(get_db)):
    """更新订单（仅当前账户）"""
    # 检查是否有重复（排除自身）
    dup = check_single_duplicate(db, order.name, order.address, order.phone,
                                  product_model=order.product_model, exclude_id=order_id,
                                  owner_id=user.id)
    updated = update_order(db, order_id, order.name, order.address, order.phone,
                            product_model=order.product_model, shipped=order.shipped,
                            owner_id=user.id)
    if not updated:
        raise HTTPException(status_code=404, detail="订单不存在")

    return {
        "success": True,
        "data": {
            "order": updated.to_dict(),
            "duplicate": dup,
            "has_duplicate": dup is not None,
        },
        "message": "更新成功" + ("，但发现重复订单！" if dup else ""),
    }


@app.post("/api/orders/{order_id}/process")
def process_order_route(order_id: int, user: User = Depends(get_current_user),
                        db: Session = Depends(get_db)):
    """将单条订单标记为已处理（仅当前账户）"""
    order = mark_order_processed(db, order_id, owner_id=user.id)
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")
    return {
        "success": True,
        "data": order.to_dict(),
        "message": "已标记为已处理",
    }


@app.post("/api/orders/batch-process")
def batch_process_orders(body: BatchDelete, user: User = Depends(get_current_user),
                         db: Session = Depends(get_db)):
    """批量标记订单为已处理（仅当前账户）"""
    if not body.ids:
        raise HTTPException(status_code=400, detail="请提供要处理的ID列表")
    count = mark_orders_processed(db, body.ids, owner_id=user.id)
    return {"success": True, "message": f"已处理 {count} 条记录"}


@app.delete("/api/orders/{order_id}")
def delete_order_route(order_id: int, user: User = Depends(get_current_user),
                       db: Session = Depends(get_db)):
    """删除单条订单（仅当前账户）"""
    ok = delete_order(db, order_id, owner_id=user.id)
    if not ok:
        raise HTTPException(status_code=404, detail="订单不存在")
    return {"success": True, "message": "删除成功"}


@app.post("/api/orders/batch-delete")
def batch_delete_orders(body: BatchDelete, user: User = Depends(get_current_user),
                        db: Session = Depends(get_db)):
    """批量删除订单（仅当前账户）"""
    if not body.ids:
        raise HTTPException(status_code=400, detail="请提供要删除的ID列表")
    count = delete_orders_batch(db, body.ids, owner_id=user.id)
    return {"success": True, "message": f"成功删除 {count} 条记录"}


# ============================================================
# 启动入口
# ============================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)