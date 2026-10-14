"""
数据模型定义 — Order / User / Company / InviteCode 表
"""
from sqlalchemy import Column, Integer, String, DateTime, Boolean, Index
from datetime import datetime, timedelta
from database import Base


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(200), nullable=False, comment="姓名")
    address = Column(String(500), nullable=False, comment="地址")
    phone = Column(String(50), nullable=False, comment="电话")
    product_model = Column(String(200), nullable=False, default="", comment="产品型号")
    batch_id = Column(String(100), nullable=True, comment="批次标识（同一次上传共用）")
    filename = Column(String(500), nullable=True, comment="来源文件名")
    shipped = Column(Boolean, default=False, comment="是否已发货")
    processed = Column(Boolean, default=False, comment="是否已处理（重复审查后标记）")
    created_at = Column(DateTime, default=datetime.utcnow, comment="录入时间")
    expire_at = Column(DateTime, nullable=False, comment="过期时间（created_at + 3天）")
    owner_id = Column(Integer, nullable=True, comment="所属账户ID（订单库隔离）")

    __table_args__ = (
        Index("idx_name_addr_phone_model", "name", "address", "phone", "product_model"),
        Index("idx_expire_at", "expire_at"),
        Index("idx_filename", "filename"),
    )

    def to_dict(self):
        """转为字典，方便 JSON 序列化，标记为 UTC 时间"""
        def fmt(dt):
            if dt is None:
                return None
            return dt.isoformat() + "Z"  # 标记为 UTC
        return {
            "id": self.id,
            "name": self.name,
            "address": self.address,
            "phone": self.phone,
            "product_model": self.product_model or "",
            "batch_id": self.batch_id,
            "filename": self.filename,
            "shipped": bool(self.shipped) if self.shipped is not None else False,
            "processed": bool(self.processed) if self.processed is not None else False,
            "owner_id": self.owner_id,
            "created_at": fmt(self.created_at),
            "expire_at": fmt(self.expire_at),
        }

    @staticmethod
    def calc_expire_at():
        """计算过期时间：当前时间 + 3天"""
        return datetime.utcnow() + timedelta(days=3)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(50), unique=True, nullable=False, comment="用户名")
    password_hash = Column(String(200), nullable=False, comment="密码哈希（pbkdf2）")
    email = Column(String(200), unique=True, nullable=False, comment="绑定邮箱")
    role = Column(String(20), nullable=False, default="user", comment="角色: super_admin/admin/user")
    company_id = Column(Integer, nullable=True, comment="所属公司ID（未设置公司时为NULL）")
    status = Column(String(20), nullable=False, default="pending_company",
                    comment="状态: pending_company/active/expired/disabled")
    valid_until = Column(DateTime, nullable=True, comment="有效截止时间（NULL=永久）")
    token = Column(String(100), nullable=True, comment="当前会话token")
    invited_by = Column(Integer, nullable=True, comment="邀请者用户ID（使用邀请码注册时记录，邀请码使用后删除仍可追溯）")
    is_guest = Column(Boolean, default=False, comment="是否游客账号（退出登录后自动清除数据）")
    registered_at = Column(DateTime, default=datetime.utcnow, comment="注册时间")
    last_login_at = Column(DateTime, nullable=True, comment="最后一次登录时间")
    created_at = Column(DateTime, default=datetime.utcnow, comment="创建时间")

    def to_dict(self):
        """转为字典。永不含 password_hash / token。"""
        def fmt(dt):
            if dt is None:
                return None
            return dt.isoformat() + "Z"  # 标记为 UTC
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "role": self.role,
            "company_id": self.company_id,
            "status": self.status,
            "valid_until": fmt(self.valid_until),
            "invited_by": self.invited_by,
            "is_guest": bool(self.is_guest) if self.is_guest is not None else False,
            "registered_at": fmt(self.registered_at),
            "last_login_at": fmt(self.last_login_at),
            "created_at": fmt(self.created_at),
        }


class Company(Base):
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(200), unique=True, nullable=False, comment="公司名称（不可修改）")
    password_hash = Column(String(200), nullable=False, comment="公司密码哈希（pbkdf2）")
    created_by = Column(Integer, nullable=True, comment="创建人用户ID")
    created_at = Column(DateTime, default=datetime.utcnow, comment="创建时间")

    def to_dict(self):
        def fmt(dt):
            if dt is None:
                return None
            return dt.isoformat() + "Z"
        return {
            "id": self.id,
            "name": self.name,
            "created_by": self.created_by,
            "created_at": fmt(self.created_at),
        }


class InviteCode(Base):
    __tablename__ = "invite_codes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(String(50), unique=True, nullable=False, comment="邀请码")
    level = Column(Integer, nullable=False, comment="级别: 1=一级(管理员) / 2=二级(用户)")
    created_by = Column(Integer, nullable=False, comment="分发者用户ID")
    used_by = Column(Integer, nullable=True, comment="使用者用户ID")
    used_at = Column(DateTime, nullable=True, comment="使用时间")
    status = Column(String(20), nullable=False, default="unused",
                    comment="状态: unused/used/revoked")
    valid_until = Column(DateTime, nullable=False, comment="有效截止时间")
    created_at = Column(DateTime, default=datetime.utcnow, comment="创建时间")

    def to_dict(self):
        def fmt(dt):
            if dt is None:
                return None
            return dt.isoformat() + "Z"
        return {
            "id": self.id,
            "code": self.code,
            "level": self.level,
            "created_by": self.created_by,
            "used_by": self.used_by,
            "used_at": fmt(self.used_at),
            "status": self.status,
            "valid_until": fmt(self.valid_until),
            "created_at": fmt(self.created_at),
        }
