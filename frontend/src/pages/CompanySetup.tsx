import React, { useState } from 'react';
import {
    Form,
    Input,
    Button,
    message,
    Alert,
    Segmented,
} from 'antd';
import {
    TeamOutlined,
    ApartmentOutlined,
    LockOutlined,
    ArrowRightOutlined,
} from '@ant-design/icons';
import { companySetup, checkCompany } from '../api';
import { useAuth } from '../AuthContext';
import AuthShell from '../components/AuthShell';
import BrandMark from '../components/BrandMark';
import Magnetic from '../components/motion/Magnetic';

interface JoinValues {
    company_name: string;
    company_password: string;
}

interface CreateValues {
    company_name: string;
    company_password: string;
    confirm_password: string;
}

const CompanySetup: React.FC = () => {
    const { user, setSession } = useAuth();
    const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
    const [mode, setMode] = useState<'join' | 'create'>('join');
    const [loading, setLoading] = useState(false);
    const [joinForm] = Form.useForm<JoinValues>();
    const [createForm] = Form.useForm<CreateValues>();

    // 校验公司是否存在（加入模式）
    const validateCompanyExists = async (_rule: any, value: string) => {
        const name = (value || '').trim();
        if (!name) {
            throw new Error('请输入公司名称');
        }
        const res = await checkCompany(name);
        if (res.success && !res.data.exists) {
            throw new Error('该公司不存在，请检查名称或选择创建公司');
        }
    };

    const handleJoinSubmit = async (values: JoinValues) => {
        setLoading(true);
        try {
            const res = await companySetup({
                action: 'join',
                company_name: values.company_name.trim(),
                company_password: values.company_password,
            });
            if (!res.success) {
                message.error(res.message || '加入公司失败');
                return;
            }
            setSession(res.data.token, res.data.user);
            message.success('加入公司成功，欢迎使用');
        } catch (e: any) {
            message.error(e.message || '加入公司失败，请重试');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateSubmit = async (values: CreateValues) => {
        setLoading(true);
        try {
            const res = await companySetup({
                action: 'create',
                company_name: values.company_name.trim(),
                company_password: values.company_password,
            });
            if (!res.success) {
                message.error(res.message || '创建公司失败');
                return;
            }
            setSession(res.data.token, res.data.user);
            message.success('创建公司成功，欢迎使用');
        } catch (e: any) {
            message.error(e.message || '创建公司失败，请重试');
        } finally {
            setLoading(false);
        }
    };

    const handleJoinNameBlur = () => {
        // 失焦时即时校验公司是否存在
        joinForm.validateFields(['company_name']).catch(() => {
            /* 错误提示由 Form 展示 */
        });
    };

    const prefixStyle = { color: '#A8A29E' };

    return (
        <AuthShell
            eyebrow="SET UP YOUR COMPANY · 公司设置"
            headline={
                <>
                    先安顿好
                    <br />
                    <em>你的公司。</em>
                </>
            }
            lead="加入现有公司，或创建一家新公司。公司名称一经确定不可修改，请认真填写。"
            points={
                isAdmin
                    ? [
                          { title: '加入公司', desc: '凭公司密码加入，数据与团队共享' },
                          { title: '创建新公司', desc: '成为管理员，自主分发邀请码' },
                      ]
                    : [{ title: '加入公司', desc: '凭公司密码加入，数据与团队共享' }]
            }
            pills={['公司隔离', '邀请码注册', '有效期管理']}
            quote="先安顿好公司，才能安心管好每一笔订单。"
            footnote="Small details. Better interfaces. · 用心设计的查重工具"
        >
            <div className="auth-card dd-sweep">
                <div className="auth-card-head">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                        <BrandMark size={26} />
                        <span className="dd-eyebrow">订单查重管理系统</span>
                    </div>
                    <h2 className="auth-card-title">设置公司信息</h2>
                    <p className="auth-card-sub">完成这一步，就可以开始管理订单了</p>
                </div>

                {isAdmin && (
                    <Segmented
                        block
                        value={mode}
                        onChange={(v) => setMode(v as 'join' | 'create')}
                        options={[
                            { label: '加入公司', value: 'join', icon: <TeamOutlined /> },
                            { label: '创建新公司', value: 'create', icon: <ApartmentOutlined /> },
                        ]}
                        style={{ marginBottom: 26 }}
                    />
                )}

                {mode === 'join' ? (
                    <Form<JoinValues>
                        form={joinForm}
                        name="join"
                        size="large"
                        onFinish={handleJoinSubmit}
                    >
                        <Form.Item
                            name="company_name"
                            rules={[
                                { required: true, message: '请输入公司名称' },
                                { validator: validateCompanyExists },
                            ]}
                            style={{ marginBottom: 16 }}
                        >
                            <Input
                                prefix={<TeamOutlined style={prefixStyle} />}
                                placeholder="公司名称"
                                onBlur={handleJoinNameBlur}
                            />
                        </Form.Item>
                        <Form.Item
                            name="company_password"
                            rules={[{ required: true, message: '请输入公司密码' }]}
                            style={{ marginBottom: 22 }}
                        >
                            <Input.Password
                                prefix={<LockOutlined style={prefixStyle} />}
                                placeholder="公司密码"
                            />
                        </Form.Item>
                        <Alert
                            type="info"
                            showIcon
                            className="dd-note"
                            message="加入公司需通过公司密码验证，请向公司管理员获取"
                        />
                        <Magnetic strength={0.18} style={{ display: 'block', width: '100%', marginTop: 16 }}>
                            <Button
                                type="primary"
                                htmlType="submit"
                                block
                                loading={loading}
                                className="dd-submit dd-jelly"
                            >
                                加入公司 <ArrowRightOutlined />
                            </Button>
                        </Magnetic>
                    </Form>
                ) : (
                    <Form<CreateValues>
                        form={createForm}
                        name="create"
                        size="large"
                        onFinish={handleCreateSubmit}
                    >
                        <Form.Item
                            name="company_name"
                            rules={[
                                { required: true, message: '请输入公司名称' },
                                {
                                    validator: async (_rule, value) => {
                                        const name = (value || '').trim();
                                        if (!name) return;
                                        const res = await checkCompany(name);
                                        if (res.success && res.data.exists) {
                                            throw new Error('该公司名称已存在');
                                        }
                                    },
                                },
                            ]}
                            style={{ marginBottom: 16 }}
                        >
                            <Input
                                prefix={<ApartmentOutlined style={prefixStyle} />}
                                placeholder="新公司名称"
                            />
                        </Form.Item>
                        <Form.Item
                            name="company_password"
                            rules={[
                                { required: true, message: '请设置公司密码' },
                                { min: 6, message: '公司密码至少 6 位' },
                            ]}
                            hasFeedback
                            style={{ marginBottom: 16 }}
                        >
                            <Input.Password
                                prefix={<LockOutlined style={prefixStyle} />}
                                placeholder="设置公司密码（至少 6 位）"
                            />
                        </Form.Item>
                        <Form.Item
                            name="confirm_password"
                            dependencies={['company_password']}
                            hasFeedback
                            rules={[
                                { required: true, message: '请再次输入公司密码' },
                                ({ getFieldValue }) => ({
                                    validator(_, value) {
                                        if (!value || getFieldValue('company_password') === value) {
                                            return Promise.resolve();
                                        }
                                        return Promise.reject(new Error('两次输入的密码不一致'));
                                    },
                                }),
                            ]}
                            style={{ marginBottom: 22 }}
                        >
                            <Input.Password
                                prefix={<LockOutlined style={prefixStyle} />}
                                placeholder="确认公司密码"
                            />
                        </Form.Item>
                        <Alert
                            type="warning"
                            showIcon
                            className="dd-note"
                            message="公司名称提交后不可修改，请谨慎填写"
                        />
                        <Magnetic strength={0.18} style={{ display: 'block', width: '100%', marginTop: 16 }}>
                            <Button
                                type="primary"
                                htmlType="submit"
                                block
                                loading={loading}
                                className="dd-submit dd-jelly"
                            >
                                创建公司 <ArrowRightOutlined />
                            </Button>
                        </Magnetic>
                    </Form>
                )}
            </div>
        </AuthShell>
    );
};

export default CompanySetup;