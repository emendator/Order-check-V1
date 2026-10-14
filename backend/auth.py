"""
认证与权限模块
- 密码哈希: hashlib.pbkdf2_hmac（标准库，零新增依赖）
- 会话 Token: 随机 token 存 users.token（登出/禁用即失效）
- 依赖注入: get_current_user / require_role / get_pending_user
"""
from __future__ import annotations

import hashlib
import hmac
import secrets
from typing import Optional

from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from database import get_db
from models import User

# 认证方案: Authorization: Bearer <token>
_bearer = HTTPBearer(auto_error=False)


# ============================================================
# 密码哈希
# ============================================================

def hash_password(password: str) -> str:
    """生成密码哈希，格式: pbkdf2$<iterations>$<salt_hex>$<hash_hex>"""
    salt = secrets.token_hex(16)  # 16 字节随机盐
    h = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"),
                            bytes.fromhex(salt), 100_000)
    return f"pbkdf2$100000${salt}${h.hex()}"


def verify_password(password: str, stored: str) -> bool:
    """校验密码与存储的哈希是否匹配（恒定时间比较）"""
    try:
        _, iters, salt, expected = stored.split("$")
        h = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"),
                                bytes.fromhex(salt), int(iters))
        return hmac.compare_digest(h.hex(), expected)
    except Exception:
        return False


def generate_token() -> str:
    """生成会话 token"""
    return secrets.token_urlsafe(32)


def generate_invite_code() -> str:
    """生成邀请码（12 位随机字符）"""
    return secrets.token_urlsafe(6)


# ============================================================
# 依赖注入
# ============================================================

def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    """
    获取当前登录用户（必须是 active 状态）。
    未登录 / 已过期 / 未完成公司设置 / 被禁用 均拒绝。
    """
    if credentials is None:
        raise HTTPException(status_code=401, detail="未登录")
    token = credentials.credentials
    user = db.query(User).filter(User.token == token).first()
    if not user:
        raise HTTPException(status_code=401, detail="登录已失效，请重新登录")
    if user.status == "expired":
        raise HTTPException(status_code=403, detail="账号已到期，请联系管理员延长有效期")
    if user.status == "pending_company":
        raise HTTPException(status_code=403, detail="请先完成公司设置")
    if user.status != "active":
        raise HTTPException(status_code=403, detail="账号已被禁用")
    return user


def get_pending_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    """
    获取已完成注册但尚未设置公司的用户（仅用于 /api/auth/company-setup）。
    只校验 token 存在且状态为 pending_company。
    """
    if credentials is None:
        raise HTTPException(status_code=401, detail="未登录")
    token = credentials.credentials
    user = db.query(User).filter(User.token == token).first()
    if not user:
        raise HTTPException(status_code=401, detail="登录已失效，请重新登录")
    if user.status != "pending_company":
        raise HTTPException(status_code=403, detail="当前状态无需设置公司")
    return user


def get_logged_in_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    """
    仅校验已登录（token 有效），不校验账号状态。
    用于公司名称存在性检查等公开的、待设置公司用户也需要的接口。
    """
    if credentials is None:
        raise HTTPException(status_code=401, detail="未登录")
    token = credentials.credentials
    user = db.query(User).filter(User.token == token).first()
    if not user:
        raise HTTPException(status_code=401, detail="登录已失效，请重新登录")
    return user


def get_optional_credentials(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
) -> Optional[HTTPAuthorizationCredentials]:
    """获取可选的 bearer 凭据（不校验有效性），用于幂等登出等场景"""
    return credentials


def require_role(*roles: str):
    """角色校验依赖工厂。用法: Depends(require_role("admin", "super_admin"))"""
    def dep(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status_code=403, detail="无权限执行此操作")
        return user
    return dep
