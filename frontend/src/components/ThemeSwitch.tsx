import React from 'react';
import { Button, Tooltip } from 'antd';
import { SunOutlined, MoonOutlined } from '@ant-design/icons';
import { useTheme } from '../ThemeContext';

interface ThemeSwitchProps {
    /** fab = 认证页右上角悬浮球；plain = 顶栏内普通按钮 */
    variant?: 'fab' | 'plain';
}

const ThemeSwitch: React.FC<ThemeSwitchProps> = ({ variant = 'plain' }) => {
    const { theme, toggle } = useTheme();
    const dark = theme === 'dark';

    return (
        <Tooltip title={dark ? '切换为浅色外观' : '切换为深色外观'}>
            <Button
                type="text"
                aria-label="切换深浅外观"
                className={variant === 'fab' ? 'dd-theme-fab' : 'dd-theme-btn'}
                icon={dark ? <SunOutlined /> : <MoonOutlined />}
                onClick={toggle}
            />
        </Tooltip>
    );
};

export default ThemeSwitch;
