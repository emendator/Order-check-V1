import React from 'react';
import { Button, Tooltip } from 'antd';
import { WarningFilled, CloseOutlined, AuditOutlined } from '@ant-design/icons';
import type { DuplicateGroup } from '../types';

interface Props {
    duplicateGroups: DuplicateGroup[];
    onClose: () => void;
    onProcessGroup: (group: DuplicateGroup) => void;
}

/** 重复告警大横幅：白卡红调 + 分组清单（参考 detail.design 的编辑卡片风格） */
const DuplicateAlert: React.FC<Props> = ({ duplicateGroups, onClose, onProcessGroup }) => {
    if (!duplicateGroups || duplicateGroups.length === 0) return null;

    const totalDuplicates = duplicateGroups.reduce((sum, g) => sum + g.count, 0);

    return (
        <div className="dd-dup-alert">
            <div className="dd-dup-top">
                <span className="dd-dup-ic">
                    <WarningFilled />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="dd-dup-title">
                        发现 {duplicateGroups.length} 组重复订单
                        <span className="dd-pill red">共 {totalDuplicates} 条记录</span>
                    </div>
                    <div className="dd-dup-sub">
                        姓名、地址、电话、产品型号完全一致的订单，建议逐个审查，选择保留的记录。
                    </div>
                </div>
                <Tooltip title="收起">
                    <Button
                        type="text"
                        size="small"
                        icon={<CloseOutlined />}
                        onClick={onClose}
                        aria-label="收起提醒"
                    />
                </Tooltip>
            </div>

            <ul className="dd-dup-list">
                {duplicateGroups.slice(0, 5).map((g, idx) => (
                    <li key={g.key} style={{ ['--i' as any]: idx } as React.CSSProperties}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {g.name} · {g.phone}
                            {g.product_model ? ' · ' + g.product_model : ''}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 'none' }}>
                            <span className="dd-pill gray">{g.count} 条重复</span>
                            <Button
                                type="link"
                                size="small"
                                icon={<AuditOutlined />}
                                onClick={() => onProcessGroup(g)}
                            >
                                去处理
                            </Button>
                        </span>
                    </li>
                ))}
                {duplicateGroups.length > 5 && (
                    <li className="dd-dup-more">还有 {duplicateGroups.length - 5} 组重复…</li>
                )}
            </ul>
        </div>
    );
};

export default DuplicateAlert;
