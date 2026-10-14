import React, { useEffect, useRef, useState } from 'react';

interface RevealProps {
    children: React.ReactNode;
    /** 进入视口后的延迟（ms） */
    delay?: number;
    className?: string;
    style?: React.CSSProperties;
}

/**
 * 滚动揭示：元素进入视口时执行模糊+位移入场，只触发一次。
 */
const Reveal: React.FC<RevealProps> = ({ children, delay = 0, className, style }) => {
    const ref = useRef<HTMLDivElement>(null);
    const [inView, setInView] = useState(false);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        if (typeof IntersectionObserver === 'undefined') {
            setInView(true);
            return;
        }
        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        setInView(true);
                        observer.disconnect();
                    }
                }
            },
            { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    return (
        <div
            ref={ref}
            className={
                'dd-reveal' +
                (inView ? ' in' : '') +
                (className ? ' ' + className : '')
            }
            style={{ transitionDelay: delay + 'ms', ...style }}
        >
            {children}
        </div>
    );
};

export default Reveal;
