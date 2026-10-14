import React, { useRef, useState } from 'react';

interface MagneticProps {
    children: React.ReactNode;
    /** 磁力强度，默认 0.3 */
    strength?: number;
    className?: string;
    style?: React.CSSProperties;
}

/**
 * 磁性悬停：元素被光标轻微「吸引」，移开后弹回原位。
 */
const Magnetic: React.FC<MagneticProps> = ({
    children,
    strength = 0.3,
    className,
    style,
}) => {
    const ref = useRef<HTMLDivElement>(null);
    const [offset, setOffset] = useState({ x: 0, y: 0 });

    const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
        const el = ref.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const x = (e.clientX - (r.left + r.width / 2)) * strength;
        const y = (e.clientY - (r.top + r.height / 2)) * strength;
        setOffset({ x, y });
    };

    const reset = () => setOffset({ x: 0, y: 0 });

    return (
        <div
            ref={ref}
            className={className}
            onMouseMove={handleMove}
            onMouseLeave={reset}
            style={{
                display: 'inline-block',
                transform: 'translate(' + offset.x + 'px,' + offset.y + 'px)',
                transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                ...style,
            }}
        >
            {children}
        </div>
    );
};

export default Magnetic;
