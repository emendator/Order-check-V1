"""
定时任务模块 — 每小时清理过期数据 & 扫描到期账号 & 清理空公司
"""
from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime
from database import SessionLocal
from models import Order, User, Company

scheduler = BackgroundScheduler()


def cleanup_expired_orders():
    """删除所有已过期的订单记录"""
    db = SessionLocal()
    try:
        deleted = db.query(Order).filter(
            Order.expire_at <= datetime.utcnow()
        ).delete(synchronize_session=False)
        db.commit()
        if deleted > 0:
            print(f"[清理任务] 已清理 {deleted} 条过期记录")
    except Exception as e:
        print(f"[清理任务] 出错: {e}")
        db.rollback()
    finally:
        db.close()


def expire_accounts():
    """扫描有效时间到期的账号：置为 expired 并清除会话 token（禁止登录）"""
    db = SessionLocal()
    try:
        now = datetime.utcnow()
        rows = db.query(User).filter(
            User.status == "active",
            User.valid_until.isnot(None),
            User.valid_until <= now,
        ).update({User.status: "expired", User.token: None}, synchronize_session=False)
        db.commit()
        if rows:
            print(f"[账号到期] {rows} 个账号已过期并被禁止登录")
    except Exception as e:
        print(f"[账号到期] 出错: {e}")
        db.rollback()
    finally:
        db.close()


def cleanup_empty_companies():
    """清理没有任何关联账号的公司（公司无账号时自动删除）"""
    db = SessionLocal()
    try:
        ids_with_users = db.query(User.company_id).filter(
            User.company_id.isnot(None),
        ).distinct().all()
        occupied_ids = [r[0] for r in ids_with_users]
        query = db.query(Company)
        if occupied_ids:
            query = query.filter(Company.id.notin_(occupied_ids))
        companies = query.all()
        for company in companies:
            db.delete(company)
        if companies:
            db.commit()
            print(f"[公司清理] 已删除 {len(companies)} 个无关联账号的公司")
    except Exception as e:
        print(f"[公司清理] 出错: {e}")
        db.rollback()
    finally:
        db.close()


def cleanup_guest_data():
    """清理游客残留数据（仅清理已退出的游客，不打扰使用中的游客会话）"""
    db = SessionLocal()
    try:
        guest = db.query(User).filter(User.is_guest == True).first()
        if guest and not guest.token:
            deleted = db.query(Order).filter(
                Order.owner_id == guest.id,
            ).delete(synchronize_session=False)
            db.commit()
            if deleted:
                print(f"[游客清理] 已清除 {deleted} 条游客残留数据")
    except Exception as e:
        print(f"[游客清理] 出错: {e}")
        db.rollback()
    finally:
        db.close()


def start_scheduler():
    """启动定时任务（每小时执行一次）"""
    scheduler.add_job(
        cleanup_expired_orders,
        trigger="interval",
        hours=1,
        id="cleanup_expired",
        name="清理过期订单数据",
        replace_existing=True,
    )
    scheduler.add_job(
        expire_accounts,
        trigger="interval",
        hours=1,
        id="expire_accounts",
        name="扫描到期账号",
        replace_existing=True,
    )
    scheduler.add_job(
        cleanup_empty_companies,
        trigger="interval",
        hours=1,
        id="cleanup_empty_companies",
        name="清理无账号公司",
        replace_existing=True,
    )
    scheduler.add_job(
        cleanup_guest_data,
        trigger="interval",
        hours=1,
        id="cleanup_guest_data",
        name="清理游客残留数据",
        replace_existing=True,
    )
    scheduler.start()
    print("[定时任务] 已启动：每小时清理过期数据、扫描到期账号、清理无账号公司及游客残留数据")


def shutdown_scheduler():
    """关闭定时任务"""
    if scheduler.running:
        scheduler.shutdown(wait=False)
