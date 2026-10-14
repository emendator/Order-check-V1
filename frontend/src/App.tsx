import React from 'react';
import { ConfigProvider, App as AntApp, theme as antdTheme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { AuthProvider, useAuth } from './AuthContext';
import { ThemeProvider, useTheme } from './ThemeContext';
import Login from './pages/Login';
import CompanySetup from './pages/CompanySetup';
import Dashboard from './pages/Dashboard';
import BrandMark from './components/BrandMark';

/** 启动加载屏：品牌呼吸动画 */
const Loader: React.FC = () => (
    <div className="dd-loader">
        <div className="dd-loader-inner">
            <div className="dd-pulse">
                <BrandMark size={46} />
            </div>
            <div className="dd-loader-text">正在打开工作区…</div>
        </div>
    </div>
);

/** 页面状态机：未登录 → 登录页；待设置公司 → 公司设置页；已登录 → 主界面 */
const Router: React.FC = () => {
    const { user, loading } = useAuth();

    if (loading) {
        return <Loader />;
    }

    if (!user) {
        return <Login />;
    }

    if (user.status === 'pending_company') {
        return <CompanySetup />;
    }

    return <Dashboard />;
};

const baseTokens = {
    borderRadius: 10,
    borderRadiusLG: 16,
    borderRadiusSM: 8,
    fontSize: 14,
    controlHeight: 38,
    controlHeightLG: 46,
    fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", "Helvetica Neue", Arial, sans-serif',
};

const lightTokens = {
    ...baseTokens,
    colorPrimary: '#1C1917',
    colorInfo: '#1C1917',
    colorLink: '#1C1917',
    colorSuccess: '#16A34A',
    colorWarning: '#D97706',
    colorError: '#DC2626',
    colorTextBase: '#1C1917',
    colorText: '#1C1917',
    colorTextSecondary: '#57534E',
    colorTextTertiary: '#A8A29E',
    colorBgLayout: '#F6F4EF',
    colorBgContainer: '#FFFFFF',
    colorBorder: '#E7E5E4',
    colorBorderSecondary: '#EFEDE8',
    colorSplit: '#EFEDE8',
    boxShadow: '0 1px 2px rgba(28,25,23,0.05), 0 4px 14px rgba(28,25,23,0.05)',
    boxShadowSecondary: '0 10px 32px rgba(28,25,23,0.12)',
};

const darkTokens = {
    ...baseTokens,
    colorPrimary: '#F59E0B',
    colorInfo: '#F59E0B',
    colorLink: '#F59E0B',
    colorSuccess: '#4ADE80',
    colorWarning: '#F59E0B',
    colorError: '#F87171',
    colorTextBase: '#F5F1EA',
    colorText: '#F5F1EA',
    colorTextSecondary: '#A8A29E',
    colorTextTertiary: '#78716C',
    colorTextLightSolid: '#1C1917',
    colorBgLayout: '#141210',
    colorBgContainer: '#1E1B18',
    colorBgElevated: '#1E1B18',
    colorBorder: '#2E2A25',
    colorBorderSecondary: '#35302A',
    colorSplit: '#2E2A25',
    boxShadow: '0 1px 2px rgba(0,0,0,0.4), 0 4px 14px rgba(0,0,0,0.3)',
    boxShadowSecondary: '0 10px 32px rgba(0,0,0,0.45)',
};

const lightComponents = {
    Button: { borderRadius: 999, borderRadiusSM: 999, borderRadiusLG: 999, fontWeight: 500 },
    Input: { borderRadius: 12, borderRadiusLG: 14 },
    Select: { borderRadius: 12, borderRadiusLG: 14, optionSelectedBg: '#F1EFEA' },
    DatePicker: { borderRadius: 12, borderRadiusLG: 14 },
    Card: { borderRadiusLG: 16 },
    Modal: { borderRadiusLG: 20, titleFontSize: 17 },
    Table: {
        headerBg: '#FAF9F6',
        headerColor: '#57534E',
        headerSplitColor: 'transparent',
        rowHoverBg: '#FAF9F5',
        cellPaddingBlock: 12,
        cellPaddingInline: 12,
        borderColor: '#EFEDE8',
    },
    Tabs: {
        inkBarColor: '#1C1917',
        itemSelectedColor: '#1C1917',
        itemHoverColor: '#1C1917',
        itemColor: '#57534E',
        titleFontSize: 14,
    },
    Segmented: {
        itemSelectedBg: '#FFFFFF',
        trackBg: '#F0EEE9',
        itemSelectedColor: '#1C1917',
    },
    Spin: { colorPrimary: '#1C1917' },
    Tag: { borderRadiusSM: 999 },
};

const darkComponents = {
    Button: { borderRadius: 999, borderRadiusSM: 999, borderRadiusLG: 999, fontWeight: 500 },
    Input: { borderRadius: 12, borderRadiusLG: 14 },
    Select: { borderRadius: 12, borderRadiusLG: 14, optionSelectedBg: '#2E291F' },
    DatePicker: { borderRadius: 12, borderRadiusLG: 14 },
    Card: { borderRadiusLG: 16 },
    Modal: { borderRadiusLG: 20, titleFontSize: 17 },
    Table: {
        headerBg: '#1B1815',
        headerColor: '#A8A29E',
        headerSplitColor: 'transparent',
        rowHoverBg: '#211D19',
        cellPaddingBlock: 12,
        cellPaddingInline: 12,
        borderColor: '#2E2A25',
    },
    Tabs: {
        inkBarColor: '#F59E0B',
        itemSelectedColor: '#F5F1EA',
        itemHoverColor: '#F5F1EA',
        itemColor: '#A8A29E',
        titleFontSize: 14,
    },
    Segmented: {
        itemSelectedBg: '#3A342D',
        trackBg: '#2A2621',
        itemSelectedColor: '#F5F1EA',
    },
    Spin: { colorPrimary: '#F59E0B' },
    Tag: { borderRadiusSM: 999 },
};

/** 依据当前主题渲染 antd 外观 */
const ThemedApp: React.FC = () => {
    const { theme } = useTheme();
    const dark = theme === 'dark';

    return (
        <ConfigProvider
            locale={zhCN}
            theme={{
                algorithm: dark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
                token: dark ? darkTokens : lightTokens,
                components: dark ? darkComponents : lightComponents,
            }}
        >
            <AntApp>
                <AuthProvider>
                    <Router />
                </AuthProvider>
            </AntApp>
        </ConfigProvider>
    );
};

const App: React.FC = () => {
    return (
        <ThemeProvider>
            <ThemedApp />
        </ThemeProvider>
    );
};

export default App;
