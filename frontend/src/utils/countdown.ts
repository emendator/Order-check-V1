import dayjs from 'dayjs';

/**
 * 计算剩余时间文字
 * @param expireAt ISO 时间字符串
 * @returns 剩余时间描述
 */
export function getRemainingTime(expireAt: string): string {
    const now = dayjs();
    const expire = dayjs(expireAt);
    const diff = expire.diff(now, 'second');

    if (diff <= 0) {
        return '已过期';
    }

    const days = Math.floor(diff / 86400);
    const hours = Math.floor((diff % 86400) / 3600);
    const minutes = Math.floor((diff % 3600) / 60);

    if (days > 0) {
        return `剩余 ${days}天 ${hours}小时`;
    }
    if (hours > 0) {
        return `剩余 ${hours}小时 ${minutes}分钟`;
    }
    if (minutes > 0) {
        return `剩余 ${minutes}分钟`;
    }
    return '即将过期';
}

/**
 * 判断是否即将过期（少于1小时）
 */
export function isExpiringSoon(expireAt: string): boolean {
    const now = dayjs();
    const expire = dayjs(expireAt);
    const diff = expire.diff(now, 'second');
    return diff > 0 && diff < 3600;
}

/**
 * 判断是否已过期
 */
export function isExpired(expireAt: string): boolean {
    return dayjs(expireAt).isBefore(dayjs());
}
