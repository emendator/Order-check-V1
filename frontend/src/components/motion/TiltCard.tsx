import React, { useRef } from 'react';

interface TiltCardProps {
    children: React.ReactNode;
    /** 最大倾斜角度，默认 7 */
    max?: number;
    className?: string;
    style?: React.CSSProperties;
}

/**
 * 3D 悬浮卡片：跟随鼠标在 X/Y 轴倾斜，模拟立体悬浮。
 */
const TiltCard: React.FC<TiltCardProps> = ({ children, max = 7, className, style }) => {
    const ref = useRef<HTMLDivElement>(null);

    const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
        const el = ref.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        el.style.setProperty('--ry', (px * max * 2).toFixed(2) + 'deg');
        el.style.setProperty('--rx', (-py * max * 2).toFixed(2) + 'deg');
    };

    const reset = () => {
        const el = ref.current;
        if (!el) return;
        el.style.setProperty('--rx', '0deg');
        el.style.setProperty('--ry', '0deg');
    };

    return (
        <div
            ref={ref}
            className={'dd-tilt' + (className ? ' ' + className : '')}
            onMouseMove={handleMove}
            onMouseLeave={reset}
            style={style}
        >
            {children}
        </div>
    );
};

export default TiltCard;
