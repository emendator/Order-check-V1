import React, { useState, useCallback, useEffect } from 'react';
import {
    Layout,
    Typography,
    Space,
    Button,
    Dropdown,
    Modal,
    Form,
    Input,
    Tooltip,
    message,
} from 'antd';
import {
    LogoutOutlined,
    ApartmentOutlined,
    ArrowLeftOutlined,
    LockOutlined,
    DownOutlined,
    FileTextOutlined,
    WarningFilled,
    AuditOutlined,
    ExperimentOutlined,
    TeamOutlined,
} from '@ant-design/icons';
import OrderTable from '../components/OrderTable';
import UploadModal from '../components/UploadModal';
import OrderForm from '../components/OrderForm';
import DuplicateAlert from '../components/DuplicateAlert';
import UserManagement from './UserManagement';
import BrandMark from '../components/BrandMark';
import ThemeSwitch from '../components/ThemeSwitch';
import AnimatedNumber from '../components/motion/AnimatedNumber';
import TiltCard from '../components/motion/TiltCard';
import Reveal from '../components/motion/Reveal';
import { fetchDuplicateGroups, changePassword } from '../api';
import { useAuth } from '../AuthContext';
import type { Order, DuplicateGroup, Role, DuplicateInfo } from '../types';

const { Content } = Layout;
const { Text } = Typography;

/** 角色胶囊 */
const rolePill: Record<Role, { cls: string; label: string }> = {
    super_admin: { cls: 'dd-pill amber', label: '最高级管理员' },
    admin: { cls: 'dd-pill blue', label: '管理员' },
    user: { cls: 'dd-pill green', label: '用户' },
};

/** 统计信息（由 OrderTable 汇总上报） */
export interface OrderStats {
    total: number;
    groups: number;
    records: number;
}

const Dashboard: React.FC = () => {
    const { user, logout } = useAuth();
    const [view, setView] = useState<'orders' | 'users'>('orders');
    const [uploadVisible, setUploadVisible] = useState(false);
    const [formVisible, setFormVisible] = useState(false);
    const [editingOrder, setEditingOrder] = useState<Order | null>(null);
    const [dupGroups, setDupGroups] = useState<DuplicateGroup[]>([]);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [stats, setStats] = useState<OrderStats>({ total: 0, groups: 0, records: 0 });
    /** 由重复横幅「去处理」触发的审查请求，交给 OrderTable 打开弹窗 */
    const [reviewGroup, setReviewGroup] = useState<DuplicateGroup | null>(null);
    /** 页头滚动阴影 */
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 6);
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    const canManageUsers = user?.role === 'admin' || user?.role === 'super_admin';
    const isExpiringSoon =
        user?.days_left !== null && user?.days_left !== undefined && user.days_left <= 7;

    // 修改登录密码
    const [pwdModalOpen, setPwdModalOpen] = useState(false);
    const [pwdSubmitting, setPwdSubmitting] = useState(false);
    const [pwdForm] = Form.useForm();

    const handleChangePassword = async (values: { old_password: string; new_password: string }) => {
        setPwdSubmitting(true);
        try {
            const res = await changePassword(values.old_password, values.new_password);
            if (!res.success) {
                message.error(res.message || '修改失败');
                return;
            }
            message.success('登录密码修改成功');
            setPwdModalOpen(false);
            pwdForm.resetFields();
        } catch (e: any) {
            message.error(e.message || '修改失败，请重试');
        } finally {
            setPwdSubmitting(false);
        }
    };

    const handleLogout = () => {
        logout();
        message.success('已退出登录');
    };

    const userMenu = {
        items: [
            {
                key: 'change-pwd',
                icon: <LockOutlined />,
                label: '修改登录密码',
                onClick: () => {
                    pwdForm.resetFields();
                    setPwdModalOpen(true);
                },
            },
            {
                key: 'logout',
                icon: <LogoutOutlined />,
                label: '退出登录',
                onClick: handleLogout,
            },
        ],
    };

    const triggerRefresh = useCallback(() => {
        setRefreshTrigger((prev) => prev + 1);
    }, []);

    // 全量查重：拉取数据库中所有重复组
    const recheckDuplicates = useCallback(async () => {
        try {
            const res = await fetchDuplicateGroups();
            if (res.success) {
                setDupGroups(res.data.groups || []);
            } else {
                setDupGroups([]);
            }
        } catch {
            // 静默
        }
    }, []);

    // 通用数据变更处理：刷新表格 + 全量查重
    const handleDataChange = useCallback(async () => {
        triggerRefresh();
        await recheckDuplicates();
    }, [triggerRefresh, recheckDuplicates]);

    // 上传完成回调
    const handleUploadSuccess = useCallback(
        async (_dups: DuplicateInfo[]) => {
            await handleDataChange();
        },
        [handleDataChange]
    );

    // 新增/编辑完成回调 → 全量查重
    const handleFormSuccess = useCallback(
        async () => {
            await handleDataChange();
        },
        [handleDataChange]
    );

    // 编辑按钮
    const handleEdit = useCallback((order: Order) => {
        setEditingOrder(order);
        setFormVisible(true);
    }, []);

    // 新增按钮
    const handleAdd = useCallback(() => {
        setEditingOrder(null);
        setFormVisible(true);
    }, []);

    // 重复横幅「去处理」→ 请求 OrderTable 打开审查弹窗
    const handleProcessGroup = useCallback((group: DuplicateGroup) => {
        setReviewGroup({ ...group });
    }, []);

    return (
        <Layout style={{ minHeight: '100vh', background: 'transparent' }}>
            {/* 柔和渐变背景 + 漂浮光斑（浅色/深色均适配） */}
            <div className="dd-page-bg" aria-hidden="true">
                <span className="dd-mb-orb mb-amber" />
                <span className="dd-mb-orb mb-blue" />
            </div>
            <header className={'dd-header' + (scrolled ? ' dd-header-scrolled' : '')}>
                <div className="dd-header-left">
                    <BrandMark size={30} />
                    <span className="dd-wordmark">
                        订单查重
                        <small>MANAGEMENT</small>
                    </span>
                </div>
                <div className="dd-header-right">
                    <Space size={10} wrap>
                        {canManageUsers && (
                            <Button
                                type={view === 'users' ? 'default' : 'primary'}
                                icon={<TeamOutlined />}
                                onClick={() => setView(view === 'users' ? 'orders' : 'users')}
                            >
                                {view === 'users' ? '订单管理' : '用户管理'}
                            </Button>
                        )}
                        <ThemeSwitch />
                        {user?.company_name && (
                            <span
                                className="dd-pill ink"
                                style={{
                                    display: 'inline-flex',
                                    maxWidth: 180,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                }}
                            >
                                <ApartmentOutlined />{user.company_name}
                            </span>
                        )}
                        {user?.is_guest ? (
                            <span className="dd-pill purple">
                                <ExperimentOutlined />游客
                            </span>
                        ) : user ? (
                            <span className={rolePill[user.role].cls}>{rolePill[user.role].label}</span>
                        ) : null}
                        <Dropdown menu={userMenu} trigger={['click']}>
                            <div className="dd-user">
                                <span className="dd-avatar">
                                    {(user?.username || '?').slice(0, 1).toUpperCase()}
                                </span>
                                <Text strong style={{ fontSize: 13, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {user?.username}
                                </Text>
                                <DownOutlined style={{ fontSize: 9, color: 'var(--muted)' }} />
                            </div>
                        </Dropdown>
                        <Tooltip title="退出登录">
                            <Button type="text" icon={<LogoutOutlined />} onClick={handleLogout}>
                                退出
                            </Button>
                        </Tooltip>
                    </Space>
                </div>
            </header>

            <Content
                className="dd-main-content"
                style={{
                    padding: '26px clamp(16px, 3.5vw, 40px) 48px',
                    maxWidth: 1440,
                    margin: '0 auto',
                    width: '100%',
                }}
            >
                {/* 游客模式提醒 */}
                {user?.is_guest && (
                    <Reveal>
                        <div className="dd-banner amber">
                            <span className="dd-banner-ic">
                                <ExperimentOutlined />
                            </span>
                            <span>
                                <b>游客模式：</b>可使用全部订单功能，但不会保留任何数据，退出登录后将自动清除所有使用痕迹。
                            </span>
                        </div>
                    </Reveal>
                )}
                {/* 账号到期提醒 */}
                {isExpiringSoon && (
                    <Reveal delay={80}>
                        <div className="dd-banner red">
                            <span className="dd-banner-ic">
                                <WarningFilled />
                            </span>
                            <span>
                                <b>账号即将到期：</b>
                                {'您的账号将于 ' + user?.days_left + ' 天后到期，到期后将无法登录，请及时联系管理员延长有效期'}
                            </span>
                        </div>
                    </Reveal>
                )}

                {view === 'users' ? (
                    <>
                        <Button
                            icon={<ArrowLeftOutlined />}
                            style={{ marginBottom: 16 }}
                            onClick={() => setView('orders')}
                        >
                            返回订单管理
                        </Button>
                        <UserManagement />
                    </>
                ) : (
                    <>
                        {/* 页头 */}
                        <Reveal>
                            <div className="dd-page-head">
                                <div>
                                    <h1 className="dd-page-title">订单管理</h1>
                                    <p className="dd-page-sub">上传表格 · 审查重复 · 追踪每一笔订单</p>
                                </div>
                                <span className="dd-pill gray">
                                    <FileTextOutlined />共 {stats.total} 条订单
                                </span>
                            </div>
                        </Reveal>

                        {/* 数据统计（3D 悬浮 + 数字滚动） */}
                        <Reveal delay={60}>
                            <div className="dd-stats">
                                <TiltCard max={6}>
                                    <div className="dd-stat">
                                        <div className="dd-stat-label">
                                            <span className="dd-stat-ic ic-ink">
                                                <FileTextOutlined />
                                            </span>
                                            订单总数
                                        </div>
                                        <div className="dd-stat-value">
                                            <AnimatedNumber value={stats.total} />
                                        </div>
                                    </div>
                                </TiltCard>
                                <TiltCard max={6}>
                                    <div className="dd-stat">
                                        <div className="dd-stat-label">
                                            <span className="dd-stat-ic ic-amber">
                                                <AuditOutlined />
                                            </span>
                                            重复组数
                                        </div>
                                        <div className="dd-stat-value">
                                            <AnimatedNumber value={stats.groups} />
                                        </div>
                                    </div>
                                </TiltCard>
                                <TiltCard max={6}>
                                    <div className="dd-stat">
                                        <div className="dd-stat-label">
                                            <span className="dd-stat-ic ic-red">
                                                <WarningFilled />
                                            </span>
                                            待处理重复
                                        </div>
                                        <div className="dd-stat-value">
                                            <AnimatedNumber value={stats.records} />
                                        </div>
                                    </div>
                                </TiltCard>
                            </div>
                        </Reveal>

                        {/* 重复告警横幅 */}
                        <Reveal delay={120}>
                            <DuplicateAlert
                                duplicateGroups={dupGroups}
                                onClose={() => setDupGroups([])}
                                onProcessGroup={handleProcessGroup}
                            />
                        </Reveal>

                        {/* 订单数据表格 */}
                        <Reveal delay={160}>
                            <div className="dd-card">
                                <OrderTable
                                    refreshTrigger={refreshTrigger}
                                    onEdit={handleEdit}
                                    onUpload={() => setUploadVisible(true)}
                                    onAdd={handleAdd}
                                    onDataChanged={handleDataChange}
                                    onStatsChange={setStats}
                                    reviewGroup={reviewGroup}
                                />
                            </div>
                        </Reveal>

                        {/* 上传弹窗 */}
                        <UploadModal
                            visible={uploadVisible}
                            onClose={() => setUploadVisible(false)}
                            onSuccess={handleUploadSuccess}
                        />

                        {/* 新增/编辑表单 */}
                        <OrderForm
                            visible={formVisible}
                            editingOrder={editingOrder}
                            onClose={() => {
                                setFormVisible(false);
                                setEditingOrder(null);
                            }}
                            onSuccess={handleFormSuccess}
                        />
                    </>
                )}
            </Content>

            {/* 修改登录密码弹窗 */}
            <Modal
                title="修改登录密码"
                open={pwdModalOpen}
                onCancel={() => setPwdModalOpen(false)}
                onOk={() => pwdForm.submit()}
                confirmLoading={pwdSubmitting}
                okText="确定修改"
                cancelText="取消"
            >
                <Form form={pwdForm} layout="vertical" onFinish={handleChangePassword}>
                    <Form.Item
                        name="old_password"
                        label="原密码"
                        rules={[{ required: true, message: '请输入原密码' }]}
                    >
                        <Input.Password placeholder="请输入原密码" />
                    </Form.Item>
                    <Form.Item
                        name="new_password"
                        label="新密码"
                        rules={[
                            { required: true, message: '请输入新密码' },
                            { min: 6, message: '新密码至少 6 位' },
                        ]}
                        hasFeedback
                    >
                        <Input.Password placeholder="新密码（至少 6 位）" />
                    </Form.Item>
                    <Form.Item
                        name="confirm_password"
                        dependencies={['new_password']}
                        hasFeedback
                        rules={[
                            { required: true, message: '请再次输入新密码' },
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
                        <Input.Password placeholder="确认新密码" />
                    </Form.Item>
                </Form>
            </Modal>
        </Layout>
    );
};

export default Dashboard;