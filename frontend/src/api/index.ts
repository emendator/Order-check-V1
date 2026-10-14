import axios from 'axios';
import type {
    ApiResponse,
    PaginatedData,
    Order,
    UploadPreview,
    ImportResult,
    BatchImportResult,
    OrderFormData,
    OrderSaveResult,
    DuplicateGroup,
    ProcessDuplicateBody,
    UserInfo,
    RegisterBody,
    RegisterResult,
    LoginResult,
    CompanySetupBody,
    InviteCodeItem,
} from '../types';

export const TOKEN_KEY = 'order_check_token';

const api = axios.create({
    baseURL: '/api',
    timeout: 30000,
});

// 请求拦截器：自动携带登录 token
api.interceptors.request.use((config) => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// 响应拦截器：提取后端错误详情；401 → 通知登出；自动重试（应对后端短暂断连）
let isRetrying = false;
api.interceptors.response.use(
    (response) => response,
    (error) => {
        // 用后端返回的明确提示（FastAPI detail）覆盖通用错误信息，供所有 catch 展示
        const detail = error?.response?.data?.detail;
        if (typeof detail === 'string' && detail) {
            error.message = detail;
        }
        const config = error.config;
        // 登录失效（401）→ 清除 token 并广播登出事件
        if (error.response && error.response.status === 401) {
            localStorage.removeItem(TOKEN_KEY);
            window.dispatchEvent(new CustomEvent('auth:unauthorized'));
            return Promise.reject(error);
        }
        // 如果是网络错误或 5xx，且没有重试过，则自动重试一次
        if (
            !config._retry &&
            (error.code === 'ERR_NETWORK' || error.code === 'ECONNABORTED' ||
                (error.response && error.response.status >= 500))
        ) {
            config._retry = true;
            if (!isRetrying) {
                isRetrying = true;
                console.warn('[API] 请求失败，2秒后自动重试...', config.url);
                // 5xx 时保留后端信息
                return new Promise((resolve) => setTimeout(resolve, 2000)).then(() => {
                    isRetrying = false;
                    return api(config);
                });
            }
        }
        return Promise.reject(error);
    }
);

// ==================== 认证相关 ====================

/** 注册（校验邀请码） */
export async function register(body: RegisterBody): Promise<ApiResponse<RegisterResult>> {
    const { data } = await api.post('/auth/register', body);
    return data;
}

/** 公司设置（加入/创建公司） */
export async function companySetup(body: CompanySetupBody): Promise<ApiResponse<LoginResult>> {
    const { data } = await api.post('/auth/company-setup', body);
    return data;
}

/** 登录 */
export async function login(username: string, password: string): Promise<ApiResponse<LoginResult>> {
    const { data } = await api.post('/auth/login', { username, password });
    return data;
}

/** 游客登录（免密，数据不保留） */
export async function guestLogin(): Promise<ApiResponse<LoginResult>> {
    const { data } = await api.post('/auth/guest-login');
    return data;
}

/** 登出 */
export async function logout(token?: string): Promise<ApiResponse<null>> {
    // 显式传入 token：调用方可能紧接着清除本地 token，
    // 若依赖请求拦截器从 localStorage 读取，会因微任务时序丢失 token
    const { data } = await api.post(
        '/auth/logout',
        {},
        token ? { headers: { Authorization: `Bearer ${token}` } } : undefined
    );
    return data;
}

/** 获取当前用户信息 */
export async function fetchMe(): Promise<ApiResponse<UserInfo>> {
    const { data } = await api.get('/auth/me');
    return data;
}

/** 修改自己的登录密码 */
export async function changePassword(oldPassword: string, newPassword: string): Promise<ApiResponse<null>> {
    const { data } = await api.put('/auth/password', {
        old_password: oldPassword,
        new_password: newPassword,
    });
    return data;
}

/** 检查公司名称是否已存在 */
export async function checkCompany(name: string): Promise<ApiResponse<{ exists: boolean }>> {
    const { data } = await api.get('/companies/check', { params: { name } });
    return data;
}

/** 修改本公司密码（管理员及以上） */
export async function changeCompanyPassword(oldPassword: string, newPassword: string): Promise<ApiResponse<null>> {
    const { data } = await api.put('/companies/password', {
        old_password: oldPassword,
        new_password: newPassword,
    });
    return data;
}

/** 分发邀请码 */
export async function createInviteCode(
    level: 1 | 2,
    validUntil: string
): Promise<ApiResponse<InviteCodeItem>> {
    const { data } = await api.post('/invite-codes', { level, valid_until: validUntil });
    return data;
}

/** 我分发的邀请码列表 */
export async function fetchInviteCodes(): Promise<ApiResponse<InviteCodeItem[]>> {
    const { data } = await api.get('/invite-codes');
    return data;
}

/** 作废邀请码 */
export async function revokeInviteCode(id: number): Promise<ApiResponse<null>> {
    const { data } = await api.delete(`/invite-codes/${id}`);
    return data;
}

/** 管理范围内的账号列表 */
export async function fetchManagedUsers(): Promise<ApiResponse<UserInfo[]>> {
    const { data } = await api.get('/admin/users');
    return data;
}

/** 延长账号有效时间 */
export async function extendUser(id: number, validUntil: string): Promise<ApiResponse<null>> {
    const { data } = await api.put(`/admin/users/${id}/extend`, { valid_until: validUntil });
    return data;
}

/** 清除账号（管理员级联清除其下用户） */
export async function deleteUser(id: number): Promise<ApiResponse<null>> {
    const { data } = await api.delete(`/admin/users/${id}`);
    return data;
}

// ==================== 上传相关 ====================

/** 上传文件预览表头匹配 */
export async function uploadPreview(file: File): Promise<ApiResponse<UploadPreview>> {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await api.post('/upload/preview', formData);
    return data;
}

/** 确认导入文件 */
export async function uploadImport(
    file: File,
    nameCol: string,
    addressCol: string,
    phoneCol: string,
    productModelCol: string = '',
    shipped: boolean = false
): Promise<ApiResponse<ImportResult>> {
    const formData = new FormData();
    formData.append('file', file);
    const params: Record<string, any> = {
        name_col: nameCol,
        address_col: addressCol,
        phone_col: phoneCol,
        shipped,
    };
    if (productModelCol) {
        params.product_model_col = productModelCol;
    }
    const { data } = await api.post('/upload/import', formData, { params });
    return data;
}

/** 批量导入（多个文件） */
export async function uploadBatchImport(
    files: File[],
    mappings: { name_col: string; address_col: string; phone_col: string; product_model_col?: string; shipped: boolean }[]
): Promise<ApiResponse<BatchImportResult>> {
    const formData = new FormData();
    for (const file of files) {
        formData.append('files', file);
    }
    formData.append('mappings_json', JSON.stringify(mappings));
    const { data } = await api.post('/upload/batch-import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
    });
    return data;
}

// ==================== 订单 CRUD ====================

/** 分页查询订单 */
export async function fetchOrders(
    page: number = 1,
    pageSize: number = 20,
    search?: string,
    filename?: string
): Promise<ApiResponse<PaginatedData<Order>>> {
    const params: Record<string, any> = { page, page_size: pageSize };
    if (search) params.search = search;
    if (filename) params.filename = filename;
    const { data } = await api.get('/orders', { params });
    return data;
}

/** 查询单条订单 */
export async function fetchOrder(id: number): Promise<ApiResponse<Order>> {
    const { data } = await api.get(`/orders/${id}`);
    return data;
}

/** 新增订单 */
export async function createOrder(order: OrderFormData): Promise<ApiResponse<OrderSaveResult>> {
    const { data } = await api.post('/orders', order);
    return data;
}

/** 更新订单 */
export async function updateOrderById(
    id: number,
    order: OrderFormData
): Promise<ApiResponse<OrderSaveResult>> {
    const { data } = await api.put(`/orders/${id}`, order);
    return data;
}

/** 标记订单为已处理 */
export async function processOrderById(id: number): Promise<ApiResponse<Order>> {
    const { data } = await api.post(`/orders/${id}/process`);
    return data;
}

/** 批量标记为已处理 */
export async function batchProcessOrders(ids: number[]): Promise<ApiResponse<null>> {
    const { data } = await api.post('/orders/batch-process', { ids });
    return data;
}

/** 删除订单 */
export async function deleteOrderById(id: number): Promise<ApiResponse<null>> {
    const { data } = await api.delete(`/orders/${id}`);
    return data;
}

/** 批量删除 */
export async function batchDeleteOrders(ids: number[]): Promise<ApiResponse<null>> {
    const { data } = await api.post('/orders/batch-delete', { ids });
    return data;
}

// ==================== 文件名相关 ====================

/** 获取所有来源文件名 */
export async function fetchFilenames(): Promise<ApiResponse<string[]>> {
    const { data } = await api.get('/orders/filenames');
    return data;
}

/** 按文件名删除订单 */
export async function deleteOrdersByFilename(filename: string): Promise<ApiResponse<null>> {
    const { data } = await api.post('/orders/delete-by-filename', { filename });
    return data;
}

// ==================== 重复检测与处理 ====================

/** 获取所有重复组 */
export async function fetchDuplicateGroups(): Promise<
    ApiResponse<{ groups: DuplicateGroup[]; total_groups: number; duplicate_order_ids: number[] }>
> {
    const { data } = await api.get('/orders/duplicates');
    return data;
}

/** 处理重复组：保留一条，其他标记为已处理 */
export async function processDuplicateGroup(body: ProcessDuplicateBody): Promise<ApiResponse<null>> {
    const { data } = await api.post('/orders/process-duplicate-group', body);
    return data;
}
