import React, { useCallback, useEffect, useState } from 'react';
import {
    Tabs,
    Table,
    Button,
    Modal,
    Form,
    Input,
    Select,
    DatePicker,
    Space,
    message,
    Popconfirm,
    Typography,
} from 'antd';
import {
    PlusOutlined,
    StopOutlined,
    ClockCircleOutlined,
    DeleteOutlined,
    CopyOutlined,
    LockOutlined,
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import {
    createInviteCode,
    fetchInviteCodes,
    revokeInviteCode,
    fetchManagedUsers,
    extendUser,
    deleteUser,
    changeCompanyPassword,
} from '../api';
import { useAuth } from '../AuthContext';
import type { InviteCodeItem, UserInfo, Role } from '../types';

const { Text } = Typography;

/** 角色胶囊 */
const RoleTag: React.FC<{ role: Role }> = ({ role }) => {
    const map: Record<Role, { cls: string; label: string }> = {
        super_admin: { cls: 'dd-pill amber', label: '最高级管理员' },
        admin: { cls: 'dd-pill blue', label: '管理员' },
        user: { cls: 'dd-pill green', label: '用户' },
    };
    const cfg = map[role];
    return <span className={cfg.cls}>{cfg.label}</span>;
};

/** 状态胶囊 */
const StatusTag: React.FC<{ status: UserInfo['status'] }> = ({ status }) => {
    const map: Record<string, { cls: string; label: string }> = {
        active: { cls: 'dd-pill green', label: '正常' },
        pending_company: { cls: 'dd-pill amber', label: '待设置公司' },
        expired: { cls: 'dd-pill red', label: '已到期' },
        disabled: { cls: 'dd-pill gray', label: '已禁用' },
    };
    const cfg = map[status] || { cls: 'dd-pill gray', label: status };
    return <span className={cfg.cls}>{cfg.label}</span>;
};

const fmtTime = (iso: string | null) => (iso ? dayjs(iso).format('YYYY-MM-DD HH:mm') : '—');

const UserManagement: React.FC = () => {
    const { user } = useAuth();
    const isSuperAdmin = user?.role === 'super_admin';

    // ---------- 邀请码管理 ----------
    const [invites, setInvites] = useState<InviteCodeItem[]>([]);
    const [inviteModalOpen, setInviteModalOpen] = useState(false);
    const [inviteSubmitting, setInviteSubmitting] = useState(false);
    const [inviteForm] = Form.useForm();

    // ---------- 账号管理 ----------
    const [accounts, setAccounts] = useState<UserInfo[]>([]);
    const [extendTarget, setExtendTarget] = useState<UserInfo | null>(null);
    const [extendSubmitting, setExtendSubmitting] = useState(false);
    const [extendForm] = Form.useForm();

    // ---------- 修改公司密码 ----------
    const [companyPwdOpen, setCompanyPwdOpen] = useState(false);
    const [companyPwdSubmitting, setCompanyPwdSubmitting] = useState(false);
    const [companyPwdForm] = Form.useForm();

    const handleChangeCompanyPassword = async (values: {
        old_password: string;
        new_password: string;
    }) => {
        setCompanyPwdSubmitting(true);
        try {
            const res = await changeCompanyPassword(values.old_password, values.new_password);
            if (!res.success) {
                message.error(res.message || '修改失败');
                return;
            }
            message.success('公司密码修改成功');
            setCompanyPwdOpen(false);
            companyPwdForm.resetFields();
        } catch (e: any) {
            message.error(e.message || '修改失败，请重试');
        } finally {
            setCompanyPwdSubmitting(false);
        }
    };

    const loadInvites = useCallback(async () => {
        const res = await fetchInviteCodes();
        if (res.success) {
            // 已作废(revoked)/已使用(used)的邀请码自动清除，只展示未使用的
            setInvites(res.data.filter((i) => i.status === 'unused'));
        }
    }, []);

    const loadAccounts = useCallback(async () => {
        const res = await fetchManagedUsers();
        if (res.success) setAccounts(res.data);
    }, []);

    useEffect(() => {
        loadInvites();
        loadAccounts();
    }, [loadInvites, loadAccounts]);

    // ---------- 分发邀请码 ----------
    const handleCreateInvite = async (values: { level: 1 | 2; valid_until: Dayjs }) => {
        setInviteSubmitting(true);
        try {
            const res = await createInviteCode(values.level, values.valid_until.toISOString());
            if (!res.success) {
                message.error(res.message || '分发失败');
                return;
            }
            message.success('邀请码创建成功');
            setInviteModalOpen(false);
            inviteForm.resetFields();
            await loadInvites();
        } catch (e: any) {
            message.error(e.message || '分发失败，请重试');
        } finally {
            setInviteSubmitting(false);
        }
    };

    // ---------- 作废邀请码 ----------
    const handleRevokeInvite = async (id: number) => {
        try {
            const res = await revokeInviteCode(id);
            if (res.success) {
                message.success('邀请码已作废');
                await loadInvites();
            } else {
                message.error(res.message || '作废失败');
            }
        } catch (e: any) {
            message.error(e.message || '作废失败，请重试');
        }
    };

    // ---------- 延长有效期 ----------
    const handleExtend = async (values: { valid_until: Dayjs }) => {
        if (!extendTarget) return;
        setExtendSubmitting(true);
        try {
            const res = await extendUser(extendTarget.id, values.valid_until.toISOString());
            if (!res.success) {
                message.error(res.message || '延长失败');
                return;
            }
            message.success('已延长账号有效时间');
            setExtendTarget(null);
            extendForm.resetFields();
            await loadAccounts();
        } catch (e: any) {
            message.error(e.message || '延长失败，请重试');
        } finally {
            setExtendSubmitting(false);
        }
    };

    // ---------- 清除账号 ----------
    const handleDeleteUser = async (target: UserInfo) => {
        try {
            const res = await deleteUser(target.id);
            if (res.success) {
                message.success('账号「' + target.username + '」已清除');
                await loadAccounts();
            } else {
                message.error(res.message || '清除失败');
            }
        } catch (e: any) {
            message.error(e.message || '清除失败，请重试');
        }
    };

    // ---------- 复制邀请码 ----------
    const handleCopy = (code: string) => {
        navigator.clipboard?.writeText(code).then(
            () => message.success('邀请码已复制'),
            () => message.error('复制失败，请手动复制')
        );
    };

    const inviteColumns = [
        {
            title: '邀请码',
            dataIndex: 'code',
            key: 'code',
            render: (v: string) => (
                <Text code copyable style={{ fontFamily: 'var(--mono)' }}>
                    {v}
                </Text>
            ),
        },
        {
            title: '级别',
            dataIndex: 'level',
            key: 'level',
            width: 130,
            render: (v: number) =>
                v === 1 ? <span className="dd-pill purple">一级（管理员）</span> : <span className="dd-pill cyan">二级（用户）</span>,
        },
        { title: '有效截止', dataIndex: 'valid_until', key: 'valid_until', width: 170, render: fmtTime },
        { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 170, render: fmtTime },
        {
            title: '操作',
            key: 'action',
            width: 140,
            render: (_: unknown, row: InviteCodeItem) => (
                <Space>
                    <Button size="small" icon={<CopyOutlined />} onClick={() => handleCopy(row.code)}>
                        复制
                    </Button>
                    <Popconfirm
                        title="确定作废该邀请码？"
                        onConfirm={() => handleRevokeInvite(row.id)}
                    >
                        <Button size="small" danger icon={<StopOutlined />}>
                            作废
                        </Button>
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    // 本账户判断（管理范围 = 本账户 + 本账户邀请的账户）
    const isSelf = (row: UserInfo) => row.id === user?.id;

    const accountColumns = [
        {
            title: '用户名',
            dataIndex: 'username',
            key: 'username',
            width: 180,
            render: (v: string, row: UserInfo) => (
                <Space>
                    <Text>{v}</Text>
                    {isSelf(row) && <span className="dd-pill blue">本账户</span>}
                </Space>
            ),
        },
        { title: '角色', dataIndex: 'role', key: 'role', width: 130, render: (v: Role) => <RoleTag role={v} /> },
        { title: '公司', dataIndex: 'company_name', key: 'company_name', render: (v: string | null) => v || '—' },
        { title: '状态', dataIndex: 'status', key: 'status', width: 110, render: (v: UserInfo['status']) => <StatusTag status={v} /> },
        { title: '注册时间', dataIndex: 'registered_at', key: 'registered_at', width: 170, render: fmtTime },
        { title: '最后登录', dataIndex: 'last_login_at', key: 'last_login_at', width: 170, render: fmtTime },
        { title: '有效截止', dataIndex: 'valid_until', key: 'valid_until', width: 170, render: fmtTime },
        {
            title: '操作',
            key: 'action',
            width: 180,
            render: (_: unknown, row: UserInfo) =>
                isSelf(row) ? (
                    <Text type="secondary">—</Text>
                ) : (
                    <Space>
                        <Button
                            size="small"
                            icon={<ClockCircleOutlined />}
                            onClick={() => {
                                setExtendTarget(row);
                                extendForm.setFieldsValue({ valid_until: undefined });
                            }}
                        >
                            延长
                        </Button>
                        <Popconfirm
                            title={'确定清除账号「' + row.username + '」？'}
                            description={
                                row.role === 'admin' && isSuperAdmin
                                    ? '清除管理员将同步清除其下所有用户账号及其数据，且不可恢复！'
                                    : '将处理该账号及其订单数据，且不可恢复！'
                            }
                            okButtonProps={{ danger: true }}
                            onConfirm={() => handleDeleteUser(row)}
                        >
                            <Button size="small" danger icon={<DeleteOutlined />}>
                                清除
                            </Button>
                        </Popconfirm>
                    </Space>
                ),
        },
    ];

    return (
        <div className="dd-card">
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    flexWrap: 'wrap',
                    marginBottom: 18,
                }}
            >
                <h3 className="dd-page-title" style={{ fontSize: 22 }}>
                    用户管理
                </h3>
                <Button
                    icon={<LockOutlined />}
                    onClick={() => {
                        companyPwdForm.resetFields();
                        setCompanyPwdOpen(true);
                    }}
                >
                    修改公司密码
                </Button>
            </div>

            {isSuperAdmin && (
                <div className="dd-banner amber" style={{ marginBottom: 18 }}>
                    <span className="dd-banner-ic">ℹ</span>
                    <span>
                        <b>管理范围说明：</b>账号列表仅显示本账户及您通过邀请码邀请的账户；清除管理员账号时，其下关联的用户账号将同步清除。
                    </span>
                </div>
            )}

            <Tabs
                items={[
                    {
                        key: 'invites',
                        label: '邀请码管理',
                        children: (
                            <>
                                <div style={{ marginBottom: 16 }}>
                                    <Button
                                        type="primary"
                                        icon={<PlusOutlined />}
                                        onClick={() => {
                                            inviteForm.resetFields();
                                            setInviteModalOpen(true);
                                        }}
                                    >
                                        分发邀请码
                                    </Button>
                                </div>
                                <Table
                                    rowKey="id"
                                    columns={inviteColumns}
                                    dataSource={invites}
                                    pagination={{ pageSize: 10, showTotal: (t) => '共 ' + t + ' 条' }}
                                    size="middle"
                                    locale={{
                                        emptyText: (
                                            <div style={{ padding: '40px 0', textAlign: 'center', color: '#A8A29E', fontSize: 13 }}>
                                                暂无未使用的邀请码 · 点击「分发邀请码」创建
                                            </div>
                                        ),
                                    }}
                                />
                            </>
                        ),
                    },
                    {
                        key: 'accounts',
                        label: '账号管理',
                        children: (
                            <Table
                                rowKey="id"
                                columns={accountColumns}
                                dataSource={accounts}
                                pagination={{ pageSize: 10, showTotal: (t) => '共 ' + t + ' 条' }}
                                size="middle"
                                locale={{
                                    emptyText: (
                                        <div style={{ padding: '40px 0', textAlign: 'center', color: '#A8A29E', fontSize: 13 }}>
                                            暂无账号记录
                                        </div>
                                    ),
                                }}
                            />
                        ),
                    },
                ]}
            />

            {/* 分发邀请码弹窗 */}
            <Modal
                title="分发邀请码"
                open={inviteModalOpen}
                onCancel={() => setInviteModalOpen(false)}
                onOk={() => inviteForm.submit()}
                confirmLoading={inviteSubmitting}
                okText="创建"
                cancelText="取消"
            >
                <Form form={inviteForm} layout="vertical" onFinish={handleCreateInvite}>
                    <Form.Item
                        name="level"
                        label="邀请码级别"
                        rules={[{ required: true, message: '请选择级别' }]}
                        initialValue={2}
                    >
                        <Select
                            options={
                                isSuperAdmin
                                    ? [
                                        { value: 1, label: '一级邀请码（注册管理员）' },
                                        { value: 2, label: '二级邀请码（注册用户）' },
                                    ]
                                    : [{ value: 2, label: '二级邀请码（注册用户）' }]
                            }
                        />
                    </Form.Item>
                    <Form.Item
                        name="valid_until"
                        label="有效截止时间"
                        rules={[{ required: true, message: '请选择有效截止时间' }]}
                        extra="使用该邀请码注册的账号将继承此有效时间，到期后禁止登录"
                    >
                        <DatePicker
                            showTime
                            style={{ width: '100%' }}
                            disabledDate={(d) => d.isBefore(dayjs().startOf('day'))}
                            placeholder="选择有效截止时间"
                        />
                    </Form.Item>
                </Form>
            </Modal>

            {/* 延长有效期弹窗 */}
            <Modal
                title={'延长账号有效期 - ' + (extendTarget?.username ?? '')}
                open={!!extendTarget}
                onCancel={() => setExtendTarget(null)}
                onOk={() => extendForm.submit()}
                confirmLoading={extendSubmitting}
                okText="确定延长"
                cancelText="取消"
            >
                <Form form={extendForm} layout="vertical" onFinish={handleExtend}>
                    <Form.Item
                        name="valid_until"
                        label="新的有效截止时间"
                        rules={[{ required: true, message: '请选择新的有效截止时间' }]}
                    >
                        <DatePicker
                            showTime
                            style={{ width: '100%' }}
                            disabledDate={(d) => d.isBefore(dayjs().startOf('day'))}
                            placeholder="选择新的有效截止时间"
                        />
                    </Form.Item>
                </Form>
            </Modal>

            {/* 修改公司密码弹窗 */}
            <Modal
                title="修改公司密码"
                open={companyPwdOpen}
                onCancel={() => setCompanyPwdOpen(false)}
                onOk={() => companyPwdForm.submit()}
                confirmLoading={companyPwdSubmitting}
                okText="确定修改"
                cancelText="取消"
            >
                <Form form={companyPwdForm} layout="vertical" onFinish={handleChangeCompanyPassword}>
                    <Form.Item
                        name="old_password"
                        label="原公司密码"
                        rules={[{ required: true, message: '请输入原公司密码' }]}
                    >
                        <Input.Password placeholder="请输入原公司密码" />
                    </Form.Item>
                    <Form.Item
                        name="new_password"
                        label="新公司密码"
                        rules={[
                            { required: true, message: '请输入新公司密码' },
                            { min: 6, message: '公司密码至少 6 位' },
                        ]}
                        hasFeedback
                    >
                        <Input.Password placeholder="新公司密码（至少 6 位）" />
                    </Form.Item>
                    <Form.Item
                        name="confirm_password"
                        dependencies={['new_password']}
                        hasFeedback
                        rules={[
                            { required: true, message: '请再次输入新公司密码' },
                            ({ getFieldValue }) => ({
                                validator(_, value) {
                                    if (!value || getFieldValue('new_password') === value) {
                                        return Promise.resolve();
                                    }
                                    return Promise.reject(new Error('两次输入的密码不一致'));
                                },
                            }),
                        ]}
                    >
                        <Input.Password placeholder="确认新公司密码" />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default UserManagement;