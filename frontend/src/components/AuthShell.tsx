import React from 'react';
import BrandMark from './BrandMark';
import AnimatedBackground from './motion/AnimatedBackground';
import ThemeSwitch from './ThemeSwitch';

export interface AuthPoint {
    title: string;
    desc: string;
    icon?: React.ReactNode;
}

interface AuthShellProps {
    children: React.ReactNode;
    eyebrow?: string;
    headline?: React.ReactNode;
    lead?: string;
    points?: AuthPoint[];
    /** 策展式标签胶囊（detail.design 风格） */
    pills?: string[];
    /** 面板底部引言 */
    quote?: string;
    footnote?: string;
}

/**
 * 认证页外壳：左为深色编辑风格品牌面板（参考 detail.design 的
 * 黑块 + 衬线排版），右为白色表单卡片。
 */
const AuthShell: React.FC<AuthShellProps> = ({
    children,
    eyebrow = 'ORDER DEDUPLICATION · 订单查重',
    headline = (
        <>
            让每一笔订单
            <br />
            <em>清晰无重复。</em>
        </>
    ),
    lead,
    points,
    pills,
    quote,
    footnote = 'Small details. Better interfaces.',
}) => {
    return (
        <div className="auth-shell">
            <AnimatedBackground interactive />
            <ThemeSwitch variant="fab" />
            <aside className="auth-panel">
                <div className="dd-watermark" aria-hidden="true">查</div>
                <div className="dd-panel-sheen" aria-hidden="true"></div>
                <div className="auth-brand">
                    <BrandMark size={38} tone="dark" />
                    <span className="auth-word">订单查重</span>
                </div>

                <div>
                    <div className="dd-eyebrow" style={{ color: '#8A8278' }}>
                        {eyebrow}
                    </div>
                    <h1 className="auth-headline">{headline}</h1>
                    {lead && <p className="auth-lead">{lead}</p>}
                    {points && points.length > 0 && (
                        <ul className="auth-points">
                            {points.map((p) => (
                                <li key={p.title}>
                                    <span className="auth-point-ic">{p.icon || '✓'}</span>
                                    <span>
                                        <b>{p.title}</b>
                                        <span>{p.desc}</span>
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                    {pills && pills.length > 0 && (
                        <div className="dd-pill-row">
                            {pills.map((p) => (
                                <span key={p} className="dd-cat-pill">{p}</span>
                            ))}
                        </div>
                    )}
                    {quote && <p className="dd-quote">{quote}</p>}
                </div>

                <div className="auth-foot">
                    <span className="dot" />
                    {footnote}
                </div>
            </aside>

            <main className="auth-main">{children}</main>
        </div>
    );
};

export default AuthShell;