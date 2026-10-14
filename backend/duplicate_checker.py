"""
重复检测模块 — 基于姓名+地址+电话+产品型号四重匹配
"""
from sqlalchemy.orm import Session
from datetime import datetime
from models import Order
from typing import Optional
import unicodedata


def _normalize_text(s: str) -> str:
    """
    标准化文本用于比较：
    - 去除首尾空格
    - 全角字符转半角
    - 统一 Unicode 规范化
    """
    if not s:
        return ""
    s = s.strip()
    # NFKC 规范化（全角→半角等）
    s = unicodedata.normalize("NFKC", s)
    return s


def _make_key(name: str, address: str, phone: str, product_model: str = "") -> tuple:
    """生成用于比较的四元组键"""
    return (
        _normalize_text(name),
        _normalize_text(address),
        _normalize_text(phone),
        _normalize_text(product_model),
    )


def check_duplicates(db: Session, new_records: list[dict],
                     owner_id: Optional[int] = None) -> list[dict]:
    """
    检测新记录与数据库中现有记录的重复情况（按账户隔离）。

    参数:
        db: 数据库会话
        new_records: 待检查的新记录列表 [{"name":..., "address":..., "phone":..., "product_model":...}, ...]
        owner_id: 所属账户ID

    返回:
        重复信息列表:
        [{
            "new_record": {"name":..., "address":..., "phone":..., "product_model":...},
            "existing_record": {...Order.to_dict()...}
        }, ...]
    """
    duplicates = []

    # 获取所有未过期记录（含已处理，按账户隔离）
    # 说明：已处理记录仍参与重复检测，避免“已处理”成为隐藏真实重复的漏洞
    query = db.query(Order).filter(
        Order.expire_at > datetime.utcnow(),
    )
    if owner_id is not None:
        query = query.filter(Order.owner_id == owner_id)
    existing_orders = query.all()

    # 构建索引：{(name, address, phone, product_model): order}
    existing_index = {}
    for order in existing_orders:
        key = _make_key(order.name, order.address, order.phone, order.product_model)
        existing_index[key] = order

    # 逐条检查新记录
    seen_in_batch = set()  # 同批次内去重
    for rec in new_records:
        key = _make_key(
            rec.get("name", ""),
            rec.get("address", ""),
            rec.get("phone", ""),
            rec.get("product_model", ""),
        )

        # 跳过同批次内的重复（已在之前迭代中报告过）
        if key in seen_in_batch:
            continue
        seen_in_batch.add(key)

        if key in existing_index:
            duplicates.append({
                "new_record": {
                    "name": rec.get("name", ""),
                    "address": rec.get("address", ""),
                    "phone": rec.get("phone", ""),
                    "product_model": rec.get("product_model", ""),
                },
                "existing_record": existing_index[key].to_dict(),
            })

    return duplicates


def check_single_duplicate(db: Session, name: str, address: str, phone: str,
                           product_model: str = "", exclude_id: Optional[int] = None,
                           owner_id: Optional[int] = None) -> Optional[dict]:
    """
    检查单条记录是否与数据库重复（用于手动新增/编辑时，按账户隔离）。
    exclude_id: 编辑时排除自身ID。
    """
    query = db.query(Order).filter(
        Order.expire_at > datetime.utcnow(),
    )
    if owner_id is not None:
        query = query.filter(Order.owner_id == owner_id)

    norm_key = _make_key(name, address, phone, product_model)

    # 已处理记录仍参与比对：与任何未过期记录同键即视为重复（堵住“已处理即隐藏”的漏洞）
    # SQLite 不支持在 filter 中做复杂的标准化，因此加载到内存比较
    candidates = query.all()
    for order in candidates:
        if exclude_id and order.id == exclude_id:
            continue
        if _make_key(order.name, order.address, order.phone, order.product_model) == norm_key:
            return order.to_dict()

    return None