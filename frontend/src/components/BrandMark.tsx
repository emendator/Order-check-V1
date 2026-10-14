import React from 'react';

interface BrandMarkProps {
    size?: number;
    /** light = 深色底（浅色勾），dark = 浅色底（深色勾） */
    tone?: 'light' | 'dark';
    style?: React.CSSProperties;
}

/**
 * 品牌标识：一块深色圆角牌 + 两道重叠的对勾。
 * 后一道为琥珀色虚影，寓意「重复被识别」，前一道为实体，
 * 寓意「保留一条、清晰留痕」——与查重业务语义呼应。
 */
const BrandMark: React.FC<BrandMarkProps> = ({ size = 34, tone = 'light', style }) => {
    const tile = tone === 'light' ? '#1C1917' : '#FAFAF9';
    const check = tone === 'light' ? '#FAFAF9' : '#1C1917';
    const ghost = '#F5B53F';
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 36 36"
            fill="none"
            style={style}
            aria-hidden="true"
        >
            <rect x="1.5" y="1.5" width="33" height="33" rx="10" fill={tile} />
            <path
                d="M10.5 19.6l4.6 4.4 9.6-10.6"
                stroke={ghost}
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                transform="translate(2.4 -1.8)"
                opacity="0.9"
            />
            <path
                d="M10.5 19.6l4.6 4.4 9.6-10.6"
                stroke={check}
                strokeWidth="2.8"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
};

export default BrandMark;
