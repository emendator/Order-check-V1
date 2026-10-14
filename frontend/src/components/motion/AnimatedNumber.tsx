import React, { useEffect, useRef, useState } from 'react';

interface AnimatedNumberProps {
    value: number;
    /** 动画时长 ms */
    duration?: number;
    className?: string;
}

/**
 * 数字滚动（Count-up）：数值变化时从旧值平滑滚动到新值。
 */
const AnimatedNumber: React.FC<AnimatedNumberProps> = ({ value, duration = 750, className }) => {
    const [display, setDisplay] = useState(value);
    const prev = useRef(value);

    useEffect(() => {
        const from = prev.current;
        const to = value;
        if (from === to) return;
        const start = performance.now();
        let raf = 0;
        const tick = (now: number) => {
            const t = Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - t, 3);
            setDisplay(Math.round(from + (to - from) * eased));
            if (t < 1) {
                raf = requestAnimationFrame(tick);
            } else {
                prev.current = to;
            }
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [value, duration]);

    return <span className={'dd-count-num' + (className ? ' ' + className : '')}>{display}</span>;
};

export default AnimatedNumber;
