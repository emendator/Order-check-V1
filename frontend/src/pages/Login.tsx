import React, { useState } from 'react';
import {
    Form,
    Input,
    Button,
    message,
    Alert,
} from 'antd';
import {
    UserOutlined,
    LockOutlined,
    MailOutlined,
    IdcardOutlined,
    ExperimentOutlined,
    ArrowRightOutlined,
} from '@ant-design/icons';
import { register } from '../api';
import { useAuth } from '../AuthContext';
import type { RegisterBody } from '../types';
import AuthShell from '../components/AuthShell';
import BrandMark from '../components/BrandMark';
import Magnetic from '../components/motion/Magnetic';

interface LoginValues {
    username: string;
    password: string;
}

interface RegisterValues {
    username: string;
    password: string;
    confirm: string;
    email: string;
    invite_code: string;
}

const Login: React.FC = () => {
    const { login, guestLogin, setSession } = useAuth();
    /** true = 背面（注册），false = 正面（登录） */
    const [flipped, setFlipped] = useState(false);
    const [loginLoading, setLoginLoading] = useState(false);
    const [regLoading, setRegLoading] = useState(false);
    const [guestLoading, setGuestLoading] = useState(false);

    // ---------- 登录 ----------
    const handleLogin = async (values: LoginValues) => {
        setLoginLoading(true);
        try {
            const res = await login(values.username.trim(), values.password);
            if (res.need_company) {
                // 账号已注册但未设置公司 → 进入公司设置页（token 已由 login 写入）
                return;
            }
            message.success('登录成功，欢迎回来');
        } catch (e: any) {
            message.error(e.message || '登录失败，请重试');
        } finally {
            setLoginLoading(false);
        }
    };

    // ---------- 游客登录 ----------
    const handleGuestLogin = async () => {
        setGuestLoading(true);
        try {
            await guestLogin();
            message.success('已以游客身份登录');
        } catch (e: any) {
            message.error(e.message || '游客登录失败，请重试');
        } finally {
            setGuestLoading(false);
        }
    };

    // ---------- 注册 ----------
    const handleRegister = async (values: RegisterValues) => {
        setRegLoading(true);
        try {
            const body: RegisterBody = {
                username: values.username.trim(),
                password: values.password,
                email: values.email.trim(),
                invite_code: values.invite_code.trim(),
            };
            const res = await register(body);
            if (!res.success) {
                message.error(res.message || '注册失败');
                return;
            }
            // 写入 pending 会话 → App 自动切换到公司设置页
            setSession(res.data.token, res.data.user);
            message.success('注册成功，请完成公司设置');
        } catch (e: any) {
            message.error(e.message || '注册失败，请重试');
        } finally {
            setRegLoading(false);
        }
    };

    const prefixStyle = { color: '#A8A29E' };

    return (
        <AuthShell
            eyebrow="ORDER DEDUPLICATION · 订单查重管理系统"
            headline={
                <>
                    让每一笔订单
                    <br />
                    <em>清晰无重复。</em>
                </>
            }
            lead="导入、比对、留痕，一步到位。我们把查重这件小事里的每个细节都打磨得恰到好处。"
            points={[
                { title: '四重智能比对', desc: '姓名 · 地址 · 电话 · 产品型号，自动识别重复订单' },
                { title: '逐组审查，保留留痕', desc: '选择要保留的一条，其余重复项被处理，不再打扰' },
                { title: '多文件批量导入', desc: '支持 xlsx / xls / csv，自动匹配列名，免去手工对齐' },
            ]}
            pills={['四重比对', '批量导入', '3天自动清理', '多级权限']}
            quote="把查重这件小事，做成一门手艺。"
            footnote="Small details. Better interfaces. · 用心设计的查重工具"
        >
            <div className="auth-card dd-sweep">
                <div className="auth-card-head">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                        <BrandMark size={26} />
                        <span className="dd-eyebrow">订单查重管理系统</span>
                    </div>
                    <h2
                        key={flipped ? 'reg-title' : 'login-title'}
                        className="auth-card-title dd-anim-blur"
                        aria-live="polite"
                    >
                        {flipped ? '创建账号' : '欢迎回来'}
                    </h2>
                    <p
                        key={flipped ? 'reg-sub' : 'login-sub'}
                        className="auth-card-sub dd-anim-blur"
                    >
                        {flipped ? '注册后即可使用全部功能' : '登录后继续管理你的订单'}
                    </p>
                </div>

                {/* 3D 翻转卡片：正面=登录，背面=注册 */}
                <div className={'dd-flip' + (flipped ? ' flipped' : '')}>
                    <div className="dd-flip-inner">
                        {/* 正面：登录 */}
                        <div className={'dd-flip-face dd-flip-front' + (flipped ? ' away' : '')}>
                            <Form
                                name="login"
                                size="large"
                                onFinish={(values) => handleLogin(values as LoginValues)}
                            >
                                <Form.Item
                                    name="username"
                                    rules={[{ required: true, message: '请输入用户名' }]}
                                    style={{ marginBottom: 16 }}
                                >
                                    <Input
                                        prefix={<UserOutlined style={prefixStyle} />}
                                        placeholder="用户名"
                                        autoComplete="username"
                                    />
                                </Form.Item>
                                <Form.Item
                                    name="password"
                                    rules={[{ required: true, message: '请输入密码' }]}
                                    style={{ marginBottom: 22 }}
                                >
                                    <Input.Password
                                        prefix={<LockOutlined style={prefixStyle} />}
                                        placeholder="密码"
                                        autoComplete="current-password"
                                    />
                                </Form.Item>
                                <Magnetic strength={0.18} style={{ display: 'block', width: '100%' }}>
                                    <Button
                                        type="primary"
                                        htmlType="submit"
                                        block
                                        loading={loginLoading}
                                        className="dd-submit dd-jelly"
                                    >
                                        登 录 <ArrowRightOutlined />
                                    </Button>
                                </Magnetic>
                                <div className="dd-or">
                                    <span>或</span>
                                </div>
                                <Magnetic strength={0.15} style={{ display: 'block', width: '100%' }}>
                                    <Button
                                        block
                                        icon={<ExperimentOutlined />}
                                        loading={guestLoading}
                                        onClick={handleGuestLogin}
                                        className="dd-ghost dd-jelly"
                                    >
                                        以游客身份体验
                                    </Button>
                                </Magnetic>
                                <Alert
                                    type="warning"
                                    showIcon
                                    className="dd-note"
                                    message="游客模式：可使用全部订单功能，数据不保留，退出后自动清除所有使用痕迹"
                                />
                            </Form>
                            <div className="dd-flip-switch">
                                还没有账号？
                                <button type="button" onClick={() => setFlipped(true)}>
                                    立即注册 <ArrowRightOutlined />
                                </button>
                            </div>
                        </div>

                        {/* 背面：注册（2×2 表单） */}
                        <div className={'dd-flip-face dd-flip-back' + (flipped ? '' : ' away')}>
                            <Form
                                name="register"
                                size="large"
                                onFinish={(values) => handleRegister(values as RegisterValues)}
                            >
                                <div className="dd-reg-grid">
                                    <Form.Item
                                        name="username"
                                        rules={[
                                            { required: true, message: '请输入用户名' },
                                            {
                                                pattern: /^[A-Za-z0-9_一-龥]{3,20}$/,
                                                message: '3-20位字母、数字、下划线或中文',
                                            },
                                        ]}
                                    >
                                        <Input
                                            prefix={<UserOutlined style={prefixStyle} />}
                                            placeholder="用户名"
                                        />
                                    </Form.Item>
                                    <Form.Item
                                        name="email"
                                        rules={[
                                            { required: true, message: '请输入邮箱' },
                                            { type: 'email', message: '邮箱格式不正确' },
                                        ]}
                                    >
                                        <Input
                                            prefix={<MailOutlined style={prefixStyle} />}
                                            placeholder="邮箱"
                                        />
                                    </Form.Item>
                                    <Form.Item
                                        name="password"
                                        rules={[
                                            { required: true, message: '请输入密码' },
                                            { min: 6, message: '密码至少 6 位' },
                                        ]}
                                        hasFeedback
                                    >
                                        <Input.Password
                                            prefix={<LockOutlined style={prefixStyle} />}
                                            placeholder="密码（至少 6 位）"
                                        />
                                    </Form.Item>
                                    <Form.Item
                                        name="confirm"
                                        dependencies={['password']}
                                        hasFeedback
                                        rules={[
                                            { required: true, message: '请再次输入密码' },
                                            ({ getFieldValue }) => ({
                                                validator(_, value) {
                                                    if (!value || getFieldValue('password') === value) {
                                                        return Promise.resolve();
                                                    }
                                                    return Promise.reject(new Error('两次输入的密码不一致'));
                                                },
                                            }),
                                        ]}
                                    >
                                        <Input.Password
                                            prefix={<LockOutlined style={prefixStyle} />}
                                            placeholder="确认密码"
                                        />
                                    </Form.Item>
                                </div>
                                <Form.Item
                                    name="invite_code"
                                    rules={[{ required: true, message: '请输入邀请码' }]}
                                    className="dd-reg-full"
                                >
                                    <Input
                                        prefix={<IdcardOutlined style={prefixStyle} />}
                                        placeholder="邀请码（请联系管理员获取）"
                                    />
                                </Form.Item>
                                <Alert
                                    type="info"
                                    showIcon
                                    className="dd-note"
                                    message="注册需使用有效邀请码：一级邀请码注册管理员，二级邀请码注册用户"
                                />
                                <Magnetic
                                    strength={0.18}
                                    style={{ display: 'block', width: '100%', marginTop: 16 }}
                                >
                                    <Button
                                        type="primary"
                                        htmlType="submit"
                                        block
                                        loading={regLoading}
                                        className="dd-submit dd-jelly"
                                    >
                                        注 册 <ArrowRightOutlined />
                                    </Button>
                                </Magnetic>
                            </Form>
                            <div className="dd-flip-switch">
                                已有账号？
                                <button type="button" onClick={() => setFlipped(false)}>
                                    前往登录 <ArrowRightOutlined />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AuthShell>
    );
};

export default Login;