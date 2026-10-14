"""
数据库 CRUD 操作模块
"""
from sqlalchemy.orm import Session
from sqlalchemy import or_
from datetime import datetime
from models import Order, User, Company, InviteCode
from typing import Optional


def create_order(db: Session, name: str, address: str, phone: str,
                 product_model: str = "", batch_id: str = None,
                 filename: str = None, shipped: bool = False,
                 processed: bool = False, owner_id: Optional[int] = None) -> Order:
    """新增单条订单记录"""
    order = Order(
        name=name.strip(),
        address=address.strip(),
        phone=phone.strip(),
        product_model=product_model.strip(),
        batch_id=batch_id,
        filename=filename,
        shipped=shipped,
        processed=processed,
        owner_id=owner_id,
        expire_at=Order.calc_expire_at(),
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    return order


def create_orders_batch(db: Session, records: list[dict], batch_id: str = None,
                        filename: str = None, shipped: bool = False,
                        owner_id: Optional[int] = None) -> list[Order]:
    """批量新增订单记录"""
    orders = []
    for rec in records:
        order = Order(
            name=rec["name"].strip(),
            address=rec["address"].strip(),
            phone=rec["phone"].strip(),
            product_model=rec.get("product_model", "").strip(),
            batch_id=batch_id,
            filename=filename,
            shipped=shipped,
            owner_id=owner_id,
            expire_at=Order.calc_expire_at(),
        )
        db.add(order)
        orders.append(order)
    db.commit()
    for o in orders:
        db.refresh(o)
    return orders


def get_orders(
    db: Session,
    skip: int = 0,
    limit: int = 20,
    search: Optional[str] = None,
    filename_filter: Optional[str] = None,
    owner_id: Optional[int] = None,
) -> tuple[list[Order], int]:
    """
    分页查询未过期的订单。
    返回: (订单列表, 总数)
    """
    query = db.query(Order).filter(Order.expire_at > datetime.utcnow())

    if owner_id is not None:
        query = query.filter(Order.owner_id == owner_id)

    if search:
        keyword = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Order.name.like(keyword),
                Order.phone.like(keyword),
            )
        )

    if filename_filter:
        query = query.filter(Order.filename == filename_filter)

    total = query.count()
    orders = query.order_by(Order.created_at.desc()).offset(skip).limit(limit).all()

    return orders, total


def get_order_by_id(db: Session, order_id: int,
                    owner_id: Optional[int] = None) -> Optional[Order]:
    """按ID查询订单（校验归属）"""
    query = db.query(Order).filter(Order.id == order_id)
    if owner_id is not None:
        query = query.filter(Order.owner_id == owner_id)
    return query.first()


def update_order(db: Session, order_id: int, name: str, address: str, phone: str,
                 product_model: str = "", shipped: bool = False,
                 owner_id: Optional[int] = None) -> Optional[Order]:
    """更新订单记录（校验归属）"""
    order = get_order_by_id(db, order_id, owner_id=owner_id)
    if not order:
        return None
    order.name = name.strip()
    order.address = address.strip()
    order.phone = phone.strip()
    order.product_model = product_model.strip()
    order.shipped = shipped
    db.commit()
    db.refresh(order)
    return order


def mark_order_processed(db: Session, order_id: int,
                         owner_id: Optional[int] = None) -> Optional[Order]:
    """将单条订单标记为已处理（校验归属）"""
    order = get_order_by_id(db, order_id, owner_id=owner_id)
    if not order:
        return None
    order.processed = True
    db.commit()
    db.refresh(order)
    return order


def mark_orders_processed(db: Session, order_ids: list[int],
                          owner_id: Optional[int] = None) -> int:
    """批量将订单标记为已处理，返回处理数量（校验归属）"""
    query = db.query(Order).filter(Order.id.in_(order_ids))
    if owner_id is not None:
        query = query.filter(Order.owner_id == owner_id)
    count = 0
    for order in query.all():
        if not order.processed:
            order.processed = True
            count += 1
    db.commit()
    return count


def check_filename_exists(db: Session, filename: str,
                          owner_id: Optional[int] = None) -> bool:
    """检查文件名是否已存在数据库中（未过期的记录，按账户隔离）"""
    query = db.query(Order).filter(
        Order.filename == filename,
        Order.expire_at > datetime.utcnow(),
    )
    if owner_id is not None:
        query = query.filter(Order.owner_id == owner_id)
    return query.count() > 0


def delete_order(db: Session, order_id: int,
                 owner_id: Optional[int] = None) -> bool:
    """删除单条订单（校验归属）"""
    order = get_order_by_id(db, order_id, owner_id=owner_id)
    if not order:
        return False
    db.delete(order)
    db.commit()
    return True


def delete_orders_batch(db: Session, order_ids: list[int],
                        owner_id: Optional[int] = None) -> int:
    """批量删除订单，返回删除数量（校验归属）"""
    query = db.query(Order).filter(Order.id.in_(order_ids))
    if owner_id is not None:
        query = query.filter(Order.owner_id == owner_id)
    count = query.delete(synchronize_session=False)
    db.commit()
    return count


def delete_orders_by_filename(db: Session, filename: str,
                              owner_id: Optional[int] = None) -> int:
    """根据文件名删除所有关联订单，返回删除数量（按账户隔离）"""
    query = db.query(Order).filter(
        Order.filename == filename,
        Order.expire_at > datetime.utcnow(),
    )
    if owner_id is not None:
        query = query.filter(Order.owner_id == owner_id)
    count = query.delete(synchronize_session=False)
    db.commit()
    return count


def get_active_orders(db: Session, owner_id: Optional[int] = None) -> list[Order]:
    """获取所有未过期记录（含已处理，用于重复检测，按账户隔离）。

    注意：已处理记录仍视为“存在的记录”，参与重复组判定，
    以堵住“把重复标记为已处理后就隐藏真实重复”的漏洞。
    """
    query = db.query(Order).filter(
        Order.expire_at > datetime.utcnow(),
    )
    if owner_id is not None:
        query = query.filter(Order.owner_id == owner_id)
    return query.all()


def get_all_filenames(db: Session, owner_id: Optional[int] = None) -> list[str]:
    """获取所有未过期订单的来源文件名列表（去重，按账户隔离）"""
    query = db.query(Order.filename).filter(
        Order.expire_at > datetime.utcnow(),
        Order.filename.isnot(None),
        Order.filename != "",
    )
    if owner_id is not None:
        query = query.filter(Order.owner_id == owner_id)
    results = query.distinct().all()
    return [r[0] for r in results if r[0]]


def find_duplicate_groups(db: Session, owner_id: Optional[int] = None) -> list[dict]:
    """
    查找所有重复组（姓名+地址+电话+产品型号 完全相同的未过期记录，按账户隔离）。

    判定规则（堵住“已处理即隐藏重复”的漏洞）：
    - 只要同一键存在 >=2 条未过期记录，且其中至少一条“未处理”，
      就作为一个待处理重复组返回。
    - 组内可以包含“已处理”记录（它们仍与未处理记录构成真实重复，
      直到被删除才会从组内消失）。
    - 只有“全部已处理”的历史组不再返回，避免反复打扰。

    返回:
    [
        {
            "key": "name|address|phone|product_model",
            "name": "...",
            "address": "...",
            "phone": "...",
            "product_model": "...",
            "orders": [Order, Order, ...],   # 按 expire_at 降序排列
            "count": N,                        # 组内所有记录数（含已处理）
            "unprocessed_count": M             # 其中未处理记录数
        },
        ...
    ]
    只返回“存在未处理记录”的组。
    """
    active = get_active_orders(db, owner_id=owner_id)

    # 分组（含已处理记录）
    groups: dict[str, list[Order]] = {}
    for order in active:
        key = f"{order.name}|{order.address}|{order.phone}|{order.product_model}"
        if key not in groups:
            groups[key] = []
        groups[key].append(order)

    # 筛选重复组并排序
    result = []
    for key, orders in groups.items():
        # 至少 2 条，且必须还有未处理记录（否则说明该组已全部处理，不再提醒）
        if len(orders) <= 1:
            continue
        if not any(not o.processed for o in orders):
            continue
        # 按 expire_at 降序，倒计时最多的排最前
        orders.sort(key=lambda o: o.expire_at, reverse=True)
        parts = key.split("|", 3)
        result.append({
            "key": key,
            "name": parts[0],
            "address": parts[1],
            "phone": parts[2],
            "product_model": parts[3] if len(parts) > 3 else "",
            "orders": [o.to_dict() for o in orders],
            "count": len(orders),
            "unprocessed_count": sum(1 for o in orders if not o.processed),
        })

    # 按 count 降序排列
    result.sort(key=lambda g: g["count"], reverse=True)
    return result


# ============================================================
# 用户 CRUD
# ============================================================

def get_user_by_username(db: Session, username: str) -> Optional[User]:
    return db.query(User).filter(User.username == username).first()


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    return db.query(User).filter(User.email == email).first()


def get_user_by_id(db: Session, user_id: int) -> Optional[User]:
    return db.query(User).filter(User.id == user_id).first()


def create_user(db: Session, username: str, password_hash: str, email: str,
                role: str, valid_until=None, company_id: Optional[int] = None,
                status: str = "pending_company", invited_by: Optional[int] = None) -> User:
    """创建用户（记录邀请者，供管理范围/级联追溯）"""
    user = User(
        username=username,
        password_hash=password_hash,
        email=email,
        role=role,
        company_id=company_id,
        status=status,
        valid_until=valid_until,
        invited_by=invited_by,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def update_last_login(db: Session, user: User) -> None:
    """更新最后登录时间"""
    user.last_login_at = datetime.utcnow()
    db.commit()


def update_user_password(db: Session, user: User, new_hash: str) -> None:
    """更新用户登录密码哈希"""
    user.password_hash = new_hash
    db.commit()


def update_user_valid_until(db: Session, user: User, valid_until) -> User:
    """延长账号有效时间，并解除过期状态"""
    user.valid_until = valid_until
    if user.status == "expired":
        user.status = "active"
    db.commit()
    db.refresh(user)
    return user


def delete_user_and_data(db: Session, user: User) -> None:
    """
    删除账号及其关联数据：
    - 该账号的订单
    - 该账号分发的邀请码（未使用的/已作废的；已使用的邀请码在注册时已自动删除）
    邀请关系已固化在 users.invited_by，随账号一并删除，无残留引用。
    - 若该账号所属公司已无任何账号，自动删除该公司
    """
    company_id = user.company_id
    db.query(Order).filter(Order.owner_id == user.id).delete(synchronize_session=False)
    db.query(InviteCode).filter(InviteCode.created_by == user.id).delete(synchronize_session=False)
    db.delete(user)
    db.commit()
    # 公司下没有账号时，自动删除该公司
    if company_id is not None:
        remaining = db.query(User).filter(User.company_id == company_id).count()
        if remaining == 0:
            company = db.query(Company).filter(Company.id == company_id).first()
            if company:
                company_name = company.name
                db.delete(company)
                db.commit()
                print(f"[公司清理] 公司「{company_name}」已无关联账号，自动删除")


def get_descendant_users(db: Session, admin_user: User) -> list[User]:
    """级联查询：该管理员邀请的所有账户（基于 users.invited_by）"""
    return db.query(User).filter(User.invited_by == admin_user.id).all()


def get_managed_users(db: Session, manager: User) -> list[User]:
    """
    账号管理范围: 本账户 + 本账户分发的邀请码所注册的账户。
    基于 users.invited_by（邀请码使用后已删除，仍可追溯邀请关系）。
    """
    managed: list[User] = [manager]
    invited = db.query(User).filter(
        User.invited_by == manager.id,
        User.id != manager.id,
    ).order_by(User.registered_at.desc()).all()
    managed.extend(invited)
    return managed


# ============================================================
# 公司 CRUD
# ============================================================

def get_company_by_name(db: Session, name: str) -> Optional[Company]:
    return db.query(Company).filter(Company.name == name).first()


def get_company_by_id(db: Session, company_id: int) -> Optional[Company]:
    return db.query(Company).filter(Company.id == company_id).first()


def create_company(db: Session, name: str, password_hash: str,
                   created_by: Optional[int]) -> Company:
    """创建公司"""
    company = Company(
        name=name,
        password_hash=password_hash,
        created_by=created_by,
    )
    db.add(company)
    db.commit()
    db.refresh(company)
    return company


def update_company_password(db: Session, company: Company, new_hash: str) -> None:
    """修改公司密码"""
    company.password_hash = new_hash
    db.commit()


# ============================================================
# 邀请码 CRUD
# ============================================================

def create_invite_code(db: Session, code: str, level: int, created_by: int,
                       valid_until) -> InviteCode:
    """创建邀请码"""
    invite = InviteCode(
        code=code,
        level=level,
        created_by=created_by,
        valid_until=valid_until,
        status="unused",
    )
    db.add(invite)
    db.commit()
    db.refresh(invite)
    return invite


def get_invite_code(db: Session, code: str) -> Optional[InviteCode]:
    return db.query(InviteCode).filter(InviteCode.code == code).first()


def get_invite_code_by_id(db: Session, invite_id: int) -> Optional[InviteCode]:
    return db.query(InviteCode).filter(InviteCode.id == invite_id).first()


def get_invite_codes_by_creator(db: Session, creator_id: int) -> list[InviteCode]:
    # 仅返回未使用的邀请码：已作废(revoked)/已使用(used)的自动清除，不再向前端展示
    return db.query(InviteCode).filter(
        InviteCode.created_by == creator_id,
        InviteCode.status == "unused",
    ).order_by(InviteCode.created_at.desc()).all()


def use_invite_code(db: Session, invite: InviteCode, user_id: int) -> None:
    """邀请码绑定使用（一次性作废）"""
    invite.status = "used"
    invite.used_by = user_id
    invite.used_at = datetime.utcnow()
    db.commit()


def revoke_invite_code(db: Session, invite: InviteCode) -> None:
    """作废邀请码（仅未使用可作废）"""
    if invite.status != "unused":
        return
    invite.status = "revoked"
    db.commit()


def delete_invite_code(db: Session, invite: InviteCode) -> None:
    """删除邀请码记录（已使用的邀请码在注册成功后自动删除）"""
    db.delete(invite)
    db.commit()