/** 订单记录 */
export interface Order {
    id: number;
    name: string;
    address: string;
    phone: string;
    product_model: string;
    batch_id: string | null;
    filename: string | null;
    shipped: boolean;
    processed: boolean;
    created_at: string;
    expire_at: string;
}

/** 重复信息 */
export interface DuplicateInfo {
    new_record: {
        name: string;
        address: string;
        phone: string;
        product_model: string;
    };
    existing_record: Order;
}

/** API 统一响应 */
export interface ApiResponse<T = unknown> {
    success: boolean;
    data: T;
    message: string;
}

/** 分页数据 */
export interface PaginatedData<T> {
    items: T[];
    total: number;
    page: number;
    page_size: number;
}

/** 上传预览结果 */
export interface UploadPreview {
    file_id: string;
    headers: string[];
    matched: {
        name: string | null;
        address: string | null;
        phone: string | null;
        product_model: string | null;
    };
    all_matched: boolean;
}

/** 导入结果 */
export interface ImportResult {
    total: number;
    inserted: number;
    duplicates: DuplicateInfo[];
    has_duplicates: boolean;
}

/** 单文件导入结果（批量中使用） */
export interface FileImportResult {
    filename: string;
    success: boolean;
    error?: string;
    total?: number;
    inserted?: number;
    duplicates_count?: number;
}

/** 批量导入结果 */
export interface BatchImportResult {
    file_results: FileImportResult[];
    total_files: number;
    total_records: number;
    total_inserted: number;
    total_duplicates: number;
    duplicates: DuplicateInfo[];
    has_duplicates: boolean;
}

/** 上传时单个文件的预览状态 */
export interface FilePreviewItem {
    file: File;
    preview: UploadPreview | null;
    name_col: string | undefined;
    address_col: string | undefined;
    phone_col: string | undefined;
    product_model_col: string | undefined;
    shipped: boolean;
    status: 'pending' | 'previewing' | 'ready' | 'error';
    error_msg?: string;
}

/** 订单表单 */
export interface OrderFormData {
    name: string;
    address: string;
    phone: string;
    product_model: string;
    shipped: boolean;
}

/** 单个订单创建/更新结果 */
export interface OrderSaveResult {
    order: Order;
    duplicate: Order | null;
    has_duplicate: boolean;
}

/** 重复组 — 同一 (姓名+地址+电话+产品型号) 的多条记录 */
export interface DuplicateGroup {
    key: string;          // "name|address|phone|product_model"
    name: string;
    address: string;
    phone: string;
    product_model: string;
    orders: Order[];      // 该组所有记录
    count: number;
}

/** 处理重复组请求体 */
export interface ProcessDuplicateBody {
    keep_id: number;
    group_order_ids: number[];
}

// ==================== 认证 / 权限 ====================

/** 角色: 最高级管理员 > 管理员 > 用户 */
export type Role = 'super_admin' | 'admin' | 'user';

/** 账号状态 */
export type UserStatus = 'pending_company' | 'active' | 'expired' | 'disabled';

/** 用户信息 */
export interface UserInfo {
    id: number;
    username: string;
    email: string;
    role: Role;
    company_id: number | null;
    company_name: string | null;
    status: UserStatus;
    valid_until: string | null;   // UTC ISO 字符串；null=永久
    days_left: number | null;     // 剩余有效天数；null=永久
    invited_by: number | null;
    is_guest: boolean;            // 是否游客账号（数据不保留）
    registered_at: string;
    last_login_at: string | null;
    created_at: string;
}

/** 注册请求 */
export interface RegisterBody {
    username: string;
    password: string;
    email: string;
    invite_code: string;
}

/** 注册响应 */
export interface RegisterResult {
    need_company: boolean;
    role: Role;
    user_id: number;
    token: string;
    user: UserInfo;
}

/** 登录响应 */
export interface LoginResult {
    token: string;
    user: UserInfo;
    need_company?: boolean;
}

/** 公司设置请求 */
export interface CompanySetupBody {
    action: 'join' | 'create';
    company_name: string;
    company_password: string;
}

/** 邀请码 */
export interface InviteCodeItem {
    id: number;
    code: string;
    level: 1 | 2;
    created_by: number;
    used_by: number | null;
    used_at: string | null;
    status: 'unused' | 'used' | 'revoked';
    valid_until: string;
    created_at: string;
}
