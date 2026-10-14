import React, { useEffect, useRef, useState } from 'react';

interface Ripple {
    id: number;
    x: number;
    y: number;
}

interface AnimatedBackgroundProps {
    /** 是否响应鼠标移动与点击（登录页打开；其他页面可关闭） */
    interactive?: boolean;
    className?: string;
}

/**
 * 交互式动态背景：
 * - 流动渐变（Gradient Mesh）
 * - 漂浮光斑（Float）
 * - 丁达尔光线（Light Rays）
 * - 流动网格
 * - 光标跟随光晕（Cursor Follow）
 * - 点击扩散涟漪（Ripple）
 */
const AnimatedBackground: React.FC<AnimatedBackgroundProps> = ({
    interactive = true,
    className,
}) => {
    const ref = useRef<HTMLDivElement>(null);
    const [glow, setGlow] = useState({ x: 50, y: 30 });
    const [ripples, setRipples] = useState<Ripple[]>([]);

    useEffect(() => {
        const el = ref.current;
        if (!el || !interactive) return;

        const onMove = (e: MouseEvent) => {
            const r = el.getBoundingClientRect();
            setGlow({
                x: ((e.clientX - r.left) / r.width) * 100,
                y: ((e.clientY - r.top) / r.height) * 100,
            });
        };

        const onClick = (e: MouseEvent) => {
            const r = el.getBoundingClientRect();
            const id = Date.now() + Math.random();
            setRipples((prev) => [
                ...prev.slice(-7),
                { id, x: e.clientX - r.left, y: e.clientY - r.top },
            ]);
            window.setTimeout(() => {
                setRipples((prev) => prev.filter((rp) => rp.id !== id));
            }, 950);
        };

        el.addEventListener('mousemove', onMove);
        el.addEventListener('click', onClick);
        return () => {
            el.removeEventListener('mousemove', onMove);
            el.removeEventListener('click', onClick);
        };
    }, [interactive]);

    return (
        <div
            ref={ref}
            className={'dd-anim-bg' + (className ? ' ' + className : '')}
            aria-hidden="true"
        >
            <div className="dd-bg-gradient" />
            <span className="dd-bg-orb o1" />
            <span className="dd-bg-orb o2" />
            <span className="dd-bg-orb o3" />
            <div className="dd-bg-rays" />
            <div className="dd-bg-grid" />
            <div className="dd-bg-dust" />
            <div
                className="dd-bg-glow"
                style={{ left: glow.x + '%', top: glow.y + '%' }}
            />
            {ripples.map((rp) => (
                <span
                    key={rp.id}
                    className="dd-bg-ripple"
                    style={{ left: rp.x, top: rp.y }}
                />
            ))}
        </div>
    );
};

export default AnimatedBackground;