"""
Excel/CSV 解析模块 — 支持表头模糊匹配
"""
import pandas as pd
from typing import Optional

# ============================================================
# 模糊匹配关键词库
# ============================================================

NAME_PATTERNS = [
    "姓名", "名字", "收件人", "收货人", "收货姓名", "联系人",
    "客户姓名", "客户名称", "name", "customer_name", "receiver",
    "contact_name", "recipient",
]

ADDRESS_PATTERNS = [
    "地址", "收货地址", "收件地址", "详细地址", "联系地址",
    "配送地址", "邮寄地址", "address", "shipping_address",
    "delivery_address", "addr", "location",
]

PHONE_PATTERNS = [
    "电话", "手机", "手机号", "联系电话", "联系方式", "收货电话",
    "手机号码", "电话号码", "Tel", "phone", "mobile", "tel",
    "telephone", "contact_number", "cell",
]

PRODUCT_MODEL_PATTERNS = [
    "产品型号", "产品规格", "型号规格", "规格型号", "商品型号", "型号",
    "货号", "款号", "款式", "款型", "产品编号", "商品编号", "产品代码",
    "规格", "物料编号", "品号", "SKU", "product_model", "sku", "product_code",
    "item_no", "model", "part_number", "style_no",
]


def _normalize(s: str) -> str:
    """标准化字符串：去除空格、转小写"""
    return s.replace(" ", "").replace("\u3000", "").strip().lower()


def _fuzzy_match(headers: list, patterns: list) -> Optional[str]:
    """
    从表头列表中匹配关键词，返回最佳匹配的列名。
    优先精确匹配（标准化后完全相等），其次包含匹配。
    """
    best_match = None
    best_score = 0

    for header in headers:
        if not header:
            continue
        norm_header = _normalize(str(header))
        for pattern in patterns:
            norm_pattern = _normalize(pattern)
            # 精确匹配得分最高
            if norm_header == norm_pattern:
                return str(header)
            # 包含匹配
            if norm_pattern in norm_header or norm_header in norm_pattern:
                score = len(norm_pattern)
                if score > best_score:
                    best_score = score
                    best_match = str(header)

    return best_match


def auto_match_columns(file_path: str) -> dict:
    """
    自动匹配表头到各字段列名。
    返回:
    {
        "headers": [所有表头],
        "matched": {"name": ..., "address": ..., "phone": ..., "product_model": ...},
        "all_matched": bool   # 仅要求 name+address+phone 全部匹配
    }
    """
    headers = get_all_headers(file_path)
    matched = {
        "name": _fuzzy_match(headers, NAME_PATTERNS),
        "address": _fuzzy_match(headers, ADDRESS_PATTERNS),
        "phone": _fuzzy_match(headers, PHONE_PATTERNS),
        "product_model": _fuzzy_match(headers, PRODUCT_MODEL_PATTERNS),
    }
    # 产品型号为必填：四列全部匹配成功才算 all_matched
    all_matched = all(matched[k] is not None for k in ("name", "address", "phone", "product_model"))
    return {"headers": headers, "matched": matched, "all_matched": all_matched}


def get_all_headers(file_path: str) -> list:
    """读取文件表头"""
    if file_path.endswith(".csv"):
        df = pd.read_csv(file_path, nrows=0, encoding="utf-8-sig")
    else:
        df = pd.read_excel(file_path, nrows=0)
    return list(df.columns)


def parse_file(file_path: str, name_col: str, address_col: str, phone_col: str,
               product_model_col: Optional[str] = None) -> list[dict]:
    """
    解析文件，提取指定列的数据。
    返回: [{"name": ..., "address": ..., "phone": ..., "product_model": ...}, ...]
    """
    if file_path.endswith(".csv"):
        df = pd.read_csv(file_path, encoding="utf-8-sig", dtype=str)
    else:
        df = pd.read_excel(file_path, dtype=str)

    def _clean(v: str) -> str:
        return "" if v in ("nan", "None", "") else v

    records = []
    for _, row in df.iterrows():
        name = _clean(str(row.get(name_col, "")).strip())
        address = _clean(str(row.get(address_col, "")).strip())
        phone = _clean(str(row.get(phone_col, "")).strip())
        product_model = ""
        if product_model_col:
            pm = str(row.get(product_model_col, "")).strip()
            if pm not in ("nan", "None", ""):
                product_model = pm

        # 产品型号为必填：四项任一为空则跳过该行
        if not (name and address and phone and product_model):
            continue

        records.append({
            "name": name,
            "address": address,
            "phone": phone,
            "product_model": product_model,
        })

    return records