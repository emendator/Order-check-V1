import React, { useState, useEffect } from 'react';
import { getRemainingTime, isExpiringSoon, isExpired } from '../utils/countdown';

interface Props {
    expireAt: string;
}

/** 倒计时胶囊：已过期灰、临近红、正常绿 */
const CountdownCell: React.FC<Props> = ({ expireAt }) => {
    const [, setTick] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => {
            setTick((t) => t + 1);
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const expired = isExpired(expireAt);
    const soon = isExpiringSoon(expireAt);
    const text = getRemainingTime(expireAt);

    if (expired) {
        return <span className="dd-pill gray dd-count">已过期</span>;
    }
    if (soon) {
        return <span className="dd-pill red dd-count">{text}</span>;
    }
    return <span className="dd-pill green dd-count">{text}</span>;
};

export default CountdownCell;
