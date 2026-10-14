import React, { useState, useEffect, useCallback } from 'react';
import { Table, Button, Space, Input, Select, Popconfirm, message, Typography, Badge, Tooltip, Modal, Radio } from 'antd';
import {
    EditOutlined,
    DeleteOutlined,
    ReloadOutlined,
    UploadOutlined,
    PlusOutlined,
    WarningFilled,
    CheckCircleFilled,
    AuditOutlined,
    FileTextOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { Order, DuplicateGroup } from '../types';
import {
    fetchOrders, processOrderById, batchProcessOrders,
    deleteOrderById, batchDeleteOrders,
    fetchDuplicateGroups, processDuplicateGroup, fetchFilenames
} from '../api';
import CountdownCell from './CountdownCell';

const { Text } = Typography;

/** 汇总统计（上报给 Dashboard 展示） */
export interface OrderStats {
    total: number;
    groups: number;
    records: number;
}

interface Props {
    refreshTrigger: number;
    onEdit: (order: Order) => void;
    onUpload: () => void;
    onAdd: () => void;
    onDataChanged?: () => void;
    onStatsChange?: (stats: OrderStats) => void;
    /** 由外部（重复横幅）请求打开的审查分组 */
    reviewGroup?: DuplicateGroup | null;
}

const OrderTable: React.FC<Props> = ({ refreshTrigger, onEdit, onUpload, onAdd, onDataChanged, onStatsChange, reviewGroup }) => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(false);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [search, setSearch] = useState('');
    const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([]);

    // 文件名筛选
    const [filenames, setFilenames] = useState<string[]>([]);
    const [filenameFilter, setFilenameFilter] = useState<string | undefined>(undefined);

    // 重复相关状态
    const [showDuplicatesOnly, setShowDuplicatesOnly] = useState(false);
    const [duplicateOrderIds, setDuplicateOrderIds] = useState<number[]>([]);
    const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
    const [duplicatesLoading, setDuplicatesLoading] = useState(false);

    // 重复处理弹窗
    const [processModalVisible, setProcessModalVisible] = useState(false);
    const [currentDupGroup, setCurrentDupGroup] = useState<DuplicateGroup | null>(null);
    const [selectedKeepId, setSelectedKeepId] = useState<number | null>(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetchOrders(page, pageSize, search || undefined, filenameFilter);
            if (res.success) {
                setOrders(res.data.items);
                setTotal(res.data.total);
            }
        } catch {
            message.error('加载数据失败');
        } finally {
            setLoading(false);
        }
    }, [page, pageSize, search, filenameFilter]);

    // 加载文件名列表
    const loadFilenames = useCallback(async () => {
        try {
            const res = await fetchFilenames();
            if (res.success) {
                setFilenames(res.data);
            }
        } catch {
            // 静默失败
        }
    }, []);

    // 加载重复数据
    const loadDuplicates = useCallback(async () => {
        setDuplicatesLoading(true);
        try {
            const res = await fetchDuplicateGroups();
            if (res.success) {
                setDuplicateGroups(res.data.groups);
                setDuplicateOrderIds(res.data.duplicate_order_ids);
            }
        } catch {
            // 静默失败
        } finally {
            setDuplicatesLoading(false);
        }
    }, []);

    // 初始加载 + 每次刷新时重新获取
    useEffect(() => {
        loadData();
        loadDuplicates();
        loadFilenames();
    }, [loadData, loadDuplicates, loadFilenames, refreshTrigger]);

    // 汇总统计 → 上报 Dashboard
    useEffect(() => {
        onStatsChange?.({
            total,
            groups: duplicateGroups.length,
            records: duplicateGroups.reduce((sum, g) => sum + g.count, 0),
        });
    }, [total, duplicateGroups, onStatsChange]);

    // 外部请求（重复横幅「去处理」）→ 打开审查弹窗
    useEffect(() => {
        if (reviewGroup) {
            openProcessModal(reviewGroup);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reviewGroup]);

    // 筛选重复时切换数据源：重复审查模式下直接使用 duplicateGroups 中的所有订单
    const getDisplayOrders = useCallback(() => {
        if (!showDuplicatesOnly) return orders;
        // 从 duplicateGroups 中提取所有订单（不按组分，平铺展示）
        const allDupOrders: Order[] = [];
        for (const g of duplicateGroups) {
            for (const o of g.orders) {
                if (!allDupOrders.some((x) => x.id === o.id)) {
                    allDupOrders.push(o);
                }
            }
        }
        return allDupOrders;
    }, [orders, duplicateGroups, showDuplicatesOnly]);

    const handleProcess = async (id: number) => {
        try {
            await processOrderById(id);
            message.success('已标记为已处理');
            loadData();
            loadDuplicates();
            onDataChanged?.();
        } catch {
            message.error('处理失败');
        }
    };

    const handleBatchProcess = async () => {
        if (selectedRowKeys.length === 0) {
            message.warning('请先选择要处理的记录');
            return;
        }
        try {
            await batchProcessOrders(selectedRowKeys);
            message.success('批量处理成功');
            setSelectedRowKeys([]);
            loadData();
            loadDuplicates();
            onDataChanged?.();
        } catch {
            message.error('批量处理失败');
        }
    };

    const handleDelete = async (id: number) => {
        try {
            await deleteOrderById(id);
            message.success('处理成功');
            loadData();
            loadDuplicates();
            onDataChanged?.();
        } catch {
            message.error('处理失败');
        }
    };

    // 打开重复组处理弹窗
    const openProcessModal = (group: DuplicateGroup) => {
        setCurrentDupGroup(group);
        // 默认选中“未处理”记录里 expire_at 最大的（倒计时最长的）
        // 避免误保留已被标记为已处理的记录
        const sorted = [...group.orders].sort(
            (a, b) => new Date(b.expire_at).getTime() - new Date(a.expire_at).getTime()
        );
        const keepCandidate = sorted.find((o) => !o.processed) || sorted[0];
        setSelectedKeepId(keepCandidate?.id ?? null);
        setProcessModalVisible(true);
    };

    // 确认处理重复组
    const confirmProcessGroup = async () => {
        if (!currentDupGroup || !selectedKeepId) return;
        try {
            const ids = currentDupGroup.orders.map((o) => o.id);
            await processDuplicateGroup({ keep_id: selectedKeepId, group_order_ids: ids });
            message.success('已处理，保留订单 #' + selectedKeepId + '，其余重复记录已处理');
            setProcessModalVisible(false);
            setCurrentDupGroup(null);
            setSelectedKeepId(null);
            loadData();
            loadDuplicates();
            onDataChanged?.();
        } catch (e: any) {
            const errMsg = e?.response?.data?.detail || e?.message || '处理失败';
            message.error(errMsg);
        }
    };

    // 手动查重
    const handleRecheck = async () => {
        setDuplicatesLoading(true);
        try {
            const res = await fetchDuplicateGroups();
            if (res.success) {
                setDuplicateGroups(res.data.groups);
                setDuplicateOrderIds(res.data.duplicate_order_ids);
                if (res.data.groups.length > 0) {
                    message.warning('发现 ' + res.data.total_groups + ' 组重复，共 ' + res.data.duplicate_order_ids.length + ' 条重复记录');
                } else {
                    message.success('未发现重复订单');
                }
                onDataChanged?.();
            }
        } catch {
            message.error('查重失败');
        } finally {
            setDuplicatesLoading(false);
        }
    };

    // 切换筛选重复模式
    const toggleDuplicatesFilter = () => {
        const next = !showDuplicatesOnly;
        setShowDuplicatesOnly(next);
        setPage(1);
        if (next) {
            loadDuplicates();
        }
    };

    // 判断某行是否为重复行
    const isDuplicateRow = (record: Order) => duplicateOrderIds.includes(record.id);

    const columns: ColumnsType<Order> = [
        {
            title: '序号',
            key: 'index',
            width: 55,
            align: 'center' as const,
            render: (_: any, __: any, index: number) => {
                return (page - 1) * pageSize + index + 1;
            },
        },
        {
            title: '状态',
            key: 'status_flag',
            width: 60,
            align: 'center' as const,
            render: (_, record) => {
                if (record.processed) {
                    return (
                        <Tooltip title="已处理">
                            <CheckCircleFilled style={{ color: '#16A34A', fontSize: 16 }} />
                        </Tooltip>
                    );
                }
                if (isDuplicateRow(record)) {
                    return (
                        <Tooltip title="此订单存在重复">
                            <WarningFilled style={{ color: '#DC2626', fontSize: 16 }} />
                        </Tooltip>
                    );
                }
                return null;
            },
        },
        {
            title: '姓名',
            dataIndex: 'name',
            width: 100,
            ellipsis: true,
        },
        {
            title: '地址',
            dataIndex: 'address',
            width: 220,
            ellipsis: true,
            render: (text: string) => (
                <Text ellipsis={{ tooltip: text }} style={{ maxWidth: 200 }}>
                    {text}
                </Text>
            ),
        },
        {
            title: '电话',
            dataIndex: 'phone',
            width: 120,
        },
        {
            title: '产品型号',
            dataIndex: 'product_model',
            width: 120,
            ellipsis: true,
            render: (text: string) => {
                if (!text) return <Text type="secondary">-</Text>;
                return <Text>{text}</Text>;
            },
        },
        {
            title: '来源文件',
            dataIndex: 'filename',
            width: 150,
            ellipsis: true,
            render: (text: string | null) => {
                if (!text) return <Text type="secondary">-</Text>;
                return (
                    <Tooltip title={text}>
                        <FileTextOutlined style={{ marginRight: 4 }} />
                        <Text ellipsis={{ tooltip: text }} style={{ maxWidth: 120 }}>
                            {text}
                        </Text>
                    </Tooltip>
                );
            },
        },
        {
            title: '发货状态',
            dataIndex: 'shipped',
            width: 90,
            align: 'center' as const,
            render: (shipped: boolean) =>
                shipped
                    ? <span className="dd-pill blue">已发货</span>
                    : <span className="dd-pill gray">未发货</span>,
        },
        {
            title: '已处理',
            dataIndex: 'processed',
            width: 80,
            align: 'center' as const,
            render: (processed: boolean) =>
                processed
                    ? <span className="dd-pill green">是</span>
                    : <span className="dd-pill gray">否</span>,
        },
        {
            title: '剩余时间',
            dataIndex: 'expire_at',
            width: 150,
            render: (expireAt: string) => <CountdownCell expireAt={expireAt} />,
            sorter: (a, b) => new Date(a.expire_at).getTime() - new Date(b.expire_at).getTime(),
        },
        {
            title: '录入时间',
            dataIndex: 'created_at',
            width: 170,
            render: (text: string) => {
                const d = new Date(text);
                return d.toLocaleString('zh-CN');
            },
        },
        {
            title: '操作',
            key: 'action',
            width: 170,
            fixed: 'right' as const,
            render: (_, record) => (
                <Space size="small">
                    <Button
                        type="link"
                        size="small"
                        icon={<EditOutlined />}
                        onClick={() => onEdit(record)}
                    >
                        编辑
                    </Button>
                    {record.processed ? (
                        <Text type="secondary" style={{ fontSize: 12 }}>已处理</Text>
                    ) : isDuplicateRow(record) ? (
                        <Button
                            type="link"
                            size="small"
                            icon={<WarningFilled />}
                            onClick={() => {
                                // 找到该订单所属的重复组
                                const g = duplicateGroups.find((grp) =>
                                    grp.orders.some((o) => o.id === record.id)
                                );
                                if (g) openProcessModal(g);
                                else handleProcess(record.id);
                            }}
                            style={{ color: '#D97706' }}
                        >
                            处理重复
                        </Button>
                    ) : null}
                    {!showDuplicatesOnly && (
                        <Popconfirm
                            title="确认处理此记录？"
                            onConfirm={() => handleDelete(record.id)}
                            okText="确认"
                            cancelText="取消"
                        >
                            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                                处理
                            </Button>
                        </Popconfirm>
                    )}
                </Space>
            ),
        },
    ];

    const displayOrders = getDisplayOrders();

    const emptyHint = showDuplicatesOnly
        ? '没有待处理的重复订单，干得漂亮'
        : '暂无订单数据 · 点击「上传表格」导入第一份表格';
    const renderEmpty = (
        <div style={{ padding: '48px 0', textAlign: 'center' }}>
            <FileTextOutlined style={{ fontSize: 34, color: '#D6D3D1' }} />
            <div style={{ marginTop: 12, color: '#A8A29E', fontSize: 13 }}>
                {emptyHint}
            </div>
        </div>
    );

    return (
        <div>
            {/* 工具栏 */}
            <div className="dd-toolbar">
                <Space wrap>
                    <Button type="primary" icon={<UploadOutlined />} onClick={onUpload}>
                        上传表格
                    </Button>
                    <Button icon={<PlusOutlined />} onClick={onAdd}>
                        手动新增
                    </Button>
                    <Popconfirm
                        title="确认批量处理所选记录？"
                        onConfirm={() => {
                            batchDeleteOrders(selectedRowKeys).then(() => {
                                message.success('批量处理成功');
                                setSelectedRowKeys([]);
                                loadData();
                                loadDuplicates();
                                onDataChanged?.();
                            }).catch(() => message.error('批量处理失败'));
                        }}
                        okText="确认"
                        cancelText="取消"
                        disabled={selectedRowKeys.length === 0}
                    >
                        <Button danger icon={<DeleteOutlined />} disabled={selectedRowKeys.length === 0}>
                            批量处理 {selectedRowKeys.length > 0 ? '(' + selectedRowKeys.length + ')' : ''}
                        </Button>
                    </Popconfirm>
                </Space>
                <Space wrap>
                    {/* 文件名筛选 */}
                    {filenames.length > 0 && (
                        <Select
                            placeholder="按文件名筛选"
                            allowClear
                            style={{ width: 180 }}
                            value={filenameFilter}
                            onChange={(val) => {
                                setFilenameFilter(val);
                                setPage(1);
                            }}
                        >
                            {filenames.map((fn) => (
                                <Select.Option key={fn} value={fn}>
                                    <Tooltip title={fn}>
                                        <Text ellipsis style={{ maxWidth: 150 }}>{fn}</Text>
                                    </Tooltip>
                                </Select.Option>
                            ))}
                        </Select>
                    )}

                    <Button
                        icon={<AuditOutlined />}
                        onClick={handleRecheck}
                        loading={duplicatesLoading}
                    >
                        查重
                    </Button>
                    <Badge count={duplicateOrderIds.length} size="small" offset={[-4, 4]} showZero={false}>
                        <Button
                            type={showDuplicatesOnly ? 'primary' : 'default'}
                            danger={showDuplicatesOnly}
                            icon={<WarningFilled />}
                            onClick={toggleDuplicatesFilter}
                            loading={duplicatesLoading}
                        >
                            重复审查 {showDuplicatesOnly ? '(审查中)' : ''}
                        </Button>
                    </Badge>
                    <Input.Search
                        placeholder="搜索姓名 / 电话"
                        allowClear
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onSearch={() => {
                            setPage(1);
                            loadData();
                        }}
                        style={{ width: 220 }}
                    />
                    <Button icon={<ReloadOutlined />} onClick={() => { loadData(); loadDuplicates(); loadFilenames(); }}>
                        刷新
                    </Button>
                </Space>
            </div>

            {/* 筛选重复时的提示横幅 */}
            {showDuplicatesOnly && duplicateGroups.length > 0 && (
                <div className="dd-dup-banner">
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <WarningFilled style={{ color: '#DC2626' }} />
                        <Text strong style={{ color: '#991B1B' }}>
                            发现 {duplicateGroups.length} 组重复订单，共 {duplicateOrderIds.length} 条记录等待处理
                        </Text>
                    </span>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                        红色背景 = 重复订单 ｜ 点击「处理重复」审查并选择要保留的记录
                    </Text>
                </div>
            )}

            {/* 数据表格 */}
            <Table
                key={'dd-table-' + page + '-' + pageSize}
                className="dd-table"
                rowKey="id"
                columns={columns}
                dataSource={displayOrders}
                loading={loading}
                rowSelection={{
                    selectedRowKeys,
                    onChange: (keys) => setSelectedRowKeys(keys as number[]),
                }}
                onRow={(record, index) => ({
                    style: ({ ['--row-i' as any]: index ?? 0 } as React.CSSProperties),
                })}
                rowClassName={(record) =>
                    isDuplicateRow(record) && !record.processed
                        ? 'dd-row-dup'
                        : record.processed
                            ? 'dd-row-processed'
                            : ''
                }
                pagination={{
                    current: page,
                    pageSize: pageSize,
                    total: showDuplicatesOnly ? duplicateOrderIds.length : total,
                    showSizeChanger: true,
                    showQuickJumper: true,
                    showTotal: (t) => '共 ' + t + ' 条记录',
                    onChange: (p, ps) => {
                        setPage(p);
                        setPageSize(ps);
                    },
                }}
                locale={{ emptyText: renderEmpty }}
                scroll={{ x: 1400 }}
                size="middle"
            />

            {/* 重复组处理弹窗 */}
            <Modal
                title="审查重复订单"
                open={processModalVisible}
                onOk={confirmProcessGroup}
                onCancel={() => {
                    setProcessModalVisible(false);
                    setCurrentDupGroup(null);
                }}
                okText="确认处理"
                cancelText="取消"
                okButtonProps={{ disabled: !selectedKeepId }}
                width={1000}
            >
                {currentDupGroup && (
                    <div>
                        <div className="dd-modal-summary">
                            <Text strong>姓名：</Text><Text>{currentDupGroup.name}</Text>
                            <Text strong style={{ marginLeft: 16 }}>地址：</Text><Text>{currentDupGroup.address}</Text>
                            <Text strong style={{ marginLeft: 16 }}>电话：</Text><Text>{currentDupGroup.phone}</Text>
                            {currentDupGroup.product_model && (
                                <>
                                    <Text strong style={{ marginLeft: 16 }}>产品型号：</Text>
                                    <Text>{currentDupGroup.product_model}</Text>
                                </>
                            )}
                        </div>
                        <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
                            请选择要<Text strong style={{ color: '#16A34A' }}>保留</Text>的记录，其余重复记录将被<Text strong style={{ color: '#DC2626' }}>处理</Text>（不可恢复）：
                        </Text>
                        <Radio.Group
                            value={selectedKeepId}
                            onChange={(e) => setSelectedKeepId(e.target.value)}
                        >
                            <Table
                                dataSource={[...currentDupGroup.orders].sort(
                                    (a, b) => new Date(b.expire_at).getTime() - new Date(a.expire_at).getTime()
                                )}
                                rowKey="id"
                                pagination={false}
                                size="small"
                                columns={[
                                    {
                                        title: '保留',
                                        width: 60,
                                        render: (_, record) => (
                                            <Radio value={record.id} />
                                        ),
                                    },
                                    { title: 'ID', dataIndex: 'id', width: 60 },
                                    {
                                        title: '状态',
                                        key: 'status',
                                        width: 90,
                                        render: (_: unknown, record: Order) =>
                                            record.processed ? (
                                                <span className="dd-pill gray">已处理</span>
                                            ) : (
                                                <span className="dd-pill green">未处理</span>
                                            ),
                                    },
                                    { title: '姓名', dataIndex: 'name', width: 100 },
                                    { title: '电话', dataIndex: 'phone', width: 110 },
                                    {
                                        title: '产品型号',
                                        dataIndex: 'product_model',
                                        width: 100,
                                        render: (t: string) => t || '-',
                                    },
                                    {
                                        title: '来源文件',
                                        dataIndex: 'filename',
                                        width: 130,
                                        ellipsis: true,
                                        render: (t: string | null) => t || '-',
                                    },
                                    {
                                        title: '倒计时',
                                        dataIndex: 'expire_at',
                                        width: 130,
                                        render: (t: string) => <CountdownCell expireAt={t} />,
                                    },
                                    {
                                        title: '导入时间',
                                        dataIndex: 'created_at',
                                        width: 160,
                                        render: (t: string) => new Date(t).toLocaleString('zh-CN'),
                                    },
                                ]}
                            />
                        </Radio.Group>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default OrderTable;