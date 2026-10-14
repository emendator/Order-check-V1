import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { fetchMe, login as apiLogin, guestLogin as apiGuestLogin, logout as apiLogout, TOKEN_KEY } from './api';
import type { LoginResult, UserInfo } from './types';

interface AuthState {
    user: UserInfo | null;
    token: string | null;
    loading: boolean;
    /** 登录：成功后写入 token 与用户信息 */
    login: (username: string, password: string) => Promise<LoginResult>;
    /** 游客登录：免密，数据不保留 */
    guestLogin: () => Promise<LoginResult>;
    /** 设置登录结果（注册/公司设置后调用） */
    setSession: (token: string, user: UserInfo) => void;
    logout: () => void;
    /** 更新用户信息 */
    setUser: (user: UserInfo) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<UserInfo | null>(null);
    const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
    const [loading, setLoading] = useState(true);

    // 启动时用本地 token 恢复会话
    useEffect(() => {
        const saved = localStorage.getItem(TOKEN_KEY);
        if (!saved) {
            setLoading(false);
            return;
        }
        fetchMe()
            .then((res) => {
                if (res.success) {
                    setUser(res.data);
                } else {
                    localStorage.removeItem(TOKEN_KEY);
                    setToken(null);
                }
            })
            .catch(() => {
                // fetchMe 401 已由拦截器清 token；其他错误也清理
                if (!localStorage.getItem(TOKEN_KEY)) {
                    setToken(null);
                }
            })
            .finally(() => setLoading(false));
    }, []);

    // 监听 401 事件（token 失效）→ 清除本地会话
    useEffect(() => {
        const handleUnauthorized = () => {
            setUser(null);
            setToken(null);
        };
        window.addEventListener('auth:unauthorized', handleUnauthorized);
        return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
    }, []);

    const login = useCallback(async (username: string, password: string) => {
        const res = await apiLogin(username, password);
        if (!res.success) {
            throw new Error(res.message || '登录失败');
        }
        localStorage.setItem(TOKEN_KEY, res.data.token);
        setToken(res.data.token);
        setUser(res.data.user);
        return res.data;
    }, []);

    const guestLogin = useCallback(async () => {
        const res = await apiGuestLogin();
        if (!res.success) {
            throw new Error(res.message || '游客登录失败');
        }
        localStorage.setItem(TOKEN_KEY, res.data.token);
        setToken(res.data.token);
        setUser(res.data.user);
        return res.data;
    }, []);

    const setSession = useCallback((newToken: string, newUser: UserInfo) => {
        localStorage.setItem(TOKEN_KEY, newToken);
        setToken(newToken);
        setUser(newUser);
    }, []);

    const logout = useCallback(() => {
        // 先取出 token 显式传给后端登出，避免清除本地 token 后
        // axios 拦截器（微任务）读取不到而丢失 Authorization 头
        const currentToken = localStorage.getItem(TOKEN_KEY);
        apiLogout(currentToken || undefined).catch(() => {
            /* 后端登出失败不阻塞前端登出 */
        });
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setUser(null);
    }, []);

    return (
        <AuthContext.Provider value={{ user, token, loading, login, guestLogin, setSession, logout, setUser }}>
            {children}
        </AuthContext.Provider>
    );
};

export function useAuth(): AuthState {
    const ctx = useContext(AuthContext);
    if (!ctx) {
        throw new Error('useAuth 必须在 AuthProvider 内使用');
    }
    return ctx;
}
