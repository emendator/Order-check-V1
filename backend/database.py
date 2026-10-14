"""
数据库连接与初始化模块
使用 SQLAlchemy 连接 SQLite，创建 orders 表及索引
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
import os

# 确保 data 目录存在（项目根目录下的 data/）
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(PROJECT_ROOT, "data")
os.makedirs(DATA_DIR, exist_ok=True)

DATABASE_URL = f"sqlite:///{os.path.join(DATA_DIR, 'orders.db')}"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},  # SQLite 多线程需要
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """FastAPI 依赖注入：获取数据库会话"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """初始化数据库表结构，并执行迁移"""
    Base.metadata.create_all(bind=engine)
    # 迁移：为旧数据库添加新列（如不存在）
    from sqlalchemy import text
    migrations = [
        ("ALTER TABLE orders ADD COLUMN shipped BOOLEAN DEFAULT 0", "shipped"),
        ("ALTER TABLE orders ADD COLUMN product_model VARCHAR(200) DEFAULT ''", "product_model"),
        ("ALTER TABLE orders ADD COLUMN filename VARCHAR(500)", "filename"),
        ("ALTER TABLE orders ADD COLUMN processed BOOLEAN DEFAULT 0", "processed"),
        ("ALTER TABLE orders ADD COLUMN owner_id INTEGER", "owner_id"),
        ("ALTER TABLE users ADD COLUMN invited_by INTEGER", "invited_by"),
        ("ALTER TABLE users ADD COLUMN is_guest BOOLEAN DEFAULT 0", "is_guest"),
    ]
    with engine.connect() as conn:
        for sql, col_name in migrations:
            try:
                conn.execute(text(sql))
                conn.commit()
            except Exception:
                pass  # 列已存在，忽略
