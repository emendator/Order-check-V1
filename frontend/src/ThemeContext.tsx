import React, { createContext, useContext, useEffect, useCallback, useState } from 'react';

export type ThemeMode = 'light' | 'dark';

const KEY = 'dd_theme';
/** 默认外观：深色（当前版本默认） */
const DEFAULT_THEME: ThemeMode = 'dark';

interface ThemeState {
    theme: ThemeMode;
    setTheme: (t: ThemeMode) => void;
    toggle: () => void;
}

const ThemeContext = createContext<ThemeState | null>(null);

const getInitial = (): ThemeMode => {
    try {
        const saved = localStorage.getItem(KEY);
        if (saved === 'light' || saved === 'dark') return saved;
    } catch {
        /* localStorage 不可用时回退默认 */
    }
    return DEFAULT_THEME;
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [theme, setThemeState] = useState<ThemeMode>(getInitial);

    useEffect(() => {
        // 1) CSS 变量主题（深色/浅色色板）
        document.documentElement.setAttribute('data-theme', theme);
        // 2) 持久化用户选择
        try {
            localStorage.setItem(KEY, theme);
        } catch {
            /* ignore */
        }
        // 3) 同步浏览器地址栏主题色
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) {
            meta.setAttribute('content', theme === 'dark' ? '#141210' : '#F6F4EF');
        }
    }, [theme]);

    const setTheme = useCallback((t: ThemeMode) => setThemeState(t), []);
    const toggle = useCallback(() => setThemeState((p) => (p === 'light' ? 'dark' : 'light')), []);

    return (
        <ThemeContext.Provider value={{ theme, setTheme, toggle }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = (): ThemeState => {
    const ctx = useContext(ThemeContext);
    if (!ctx) {
        throw new Error('useTheme 必须在 ThemeProvider 内使用');
    }
    return ctx;
};
