"""
预置数据模块（幂等）
- 超级管理员与总部公司：使用下方常量，可用环境变量覆盖
- 历史订单划归超级管理员
"""
from __future__ import annotations

import os
import secrets

from database import SessionLocal
from models import Company, User, Order, InviteCode
from auth import hash_password

# ===== 超级管理员账号（仅在首次初始化时创建，可用环境变量覆盖） =====
# 注意：只有数据库中尚不存在该账号时才会创建；账号已存在时修改这里不会生效，
#      需在界面改密，或删除 data/orders.db 后重新初始化。
DEFAULT_ADMIN_PASSWORD = "123123"

SUPER_ADMIN_USERNAME = os.getenv("SUPER_ADMIN_USERNAME", "admin")
SUPER_ADMIN_PASSWORD = os.getenv("SUPER_ADMIN_PASSWORD", DEFAULT_ADMIN_PASSWORD)
SUPER_ADMIN_COMPANY = os.getenv("SUPER_ADMIN_COMPANY", "我的公司")
SUPER_ADMIN_EMAIL = os.getenv("SUPER_ADMIN_EMAIL", "admin@example.com")


def seed_initial_data():
    """幂等：不存在才创建。超级管理员 + 总部公司 + 历史订单归属"""
    db = SessionLocal()
    try:
        # 1. 总部公司
        company = db.query(Company).filter_by(name=SUPER_ADMIN_COMPANY).first()
        if not company:
            company = Company(
                name=SUPER_ADMIN_COMPANY,
                password_hash=hash_password(SUPER_ADMIN_PASSWORD),
                created_by=None,
            )
            db.add(company)
            db.commit()
            db.refresh(company)
            print(f"[Seed] 已创建总部公司: {SUPER_ADMIN_COMPANY}")

        # 2. 超级管理员
        admin = db.query(User).filter_by(username=SUPER_ADMIN_USERNAME).first()
        if not admin:
            if SUPER_ADMIN_PASSWORD == DEFAULT_ADMIN_PASSWORD:
                print("[Seed] 警告：正在使用内置默认口令，正式部署前请设置 "
                      "SUPER_ADMIN_PASSWORD 环境变量")
            admin = User(
                username=SUPER_ADMIN_USERNAME,
                password_hash=hash_password(SUPER_ADMIN_PASSWORD),
                email=SUPER_ADMIN_EMAIL,
                role="super_admin",
                company_id=company.id,
                status="active",
                valid_until=None,  # 永久有效
            )
            db.add(admin)
            db.commit()
            db.refresh(admin)
            print(f"[Seed] 已创建超级管理员: {SUPER_ADMIN_USERNAME}")

        # 3. 历史订单（owner_id 为空）划归超级管理员
        moved = db.query(Order).filter(Order.owner_id.is_(None)).update(
            {Order.owner_id: admin.id}, synchronize_session=False)
        if moved:
            db.commit()
            print(f"[Seed] 已将 {moved} 条历史订单划归超级管理员")

        # 3.5 游客账号（免密登录，数据不保留，退出自动清除）
        guest = db.query(User).filter_by(username="guest").first()
        if not guest:
            guest = User(
                username="guest",
                password_hash=hash_password(secrets.token_urlsafe(24)),  # 随机不可知密码，仅游客登录使用
                email="guest@guest.local",
                role="user",
                status="active",
                valid_until=None,
                is_guest=True,
            )
            db.add(guest)
            db.commit()
            print("[Seed] 已创建游客账号: guest")

        # 4. 邀请码迁移：回填历史邀请关系(invited_by) + 删除已使用的邀请码（新注册会直接删除）
        from sqlalchemy import text
        backfilled = db.execute(text(
            "UPDATE users SET invited_by = (SELECT created_by FROM invite_codes "
            "WHERE invite_codes.used_by = users.id) WHERE invited_by IS NULL"
        ))
        removed_used = db.query(InviteCode).filter(
            InviteCode.status == "used").delete(synchronize_session=False)
        if backfilled.rowcount or removed_used:
            db.commit()
            print(f"[Seed] 邀请码迁移: 回填 {backfilled.rowcount} 条邀请关系, "
                  f"删除 {removed_used} 条已使用的邀请码")

        print("[Seed] 预置数据就绪")
    except Exception as e:
        db.rollback()
        print(f"[Seed] 预置数据失败: {e}")
    finally:
        db.close()
