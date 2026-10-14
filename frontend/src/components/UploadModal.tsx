import React, { useState, useCallback } from 'react';
import {
    Modal, Upload, Button, Space, Select, Table, message, Typography,
    Steps, Tag, Tooltip, Switch, Spin,
} from 'antd';
import {
    InboxOutlined, CheckCircleOutlined, CloseCircleOutlined,
    FileTextOutlined, SettingOutlined, ArrowRightOutlined,
} from '@ant-design/icons';
import type { UploadFile } from 'antd';
import type { DuplicateInfo, FilePreviewItem, UploadPreview } from '../types';
import { uploadPreview, uploadBatchImport } from '../api';

const { Dragger } = Upload;
const { Text } = Typography;

interface Props {
    visible: boolean;
    onClose: () => void;
    onSuccess: (duplicates: DuplicateInfo[]) => void;
}

/** 单个文件的列映射配置弹窗内容 */
const FileMappingEditor: React.FC<{
    item: FilePreviewItem;
    onUpdate: (item: FilePreviewItem) => void;
}> = ({ item, onUpdate }) => {
    const update = (field: 'name_col' | 'address_col' | 'phone_col' | 'product_model_col', val: string | undefined) => {
        onUpdate({ ...item, [field]: val });
    };
    const headers = item.preview?.headers || [];
    const matched = item.preview?.matched;

    return (
        <Table
            dataSource={[
                {
                    key: 'name', field: '姓名',
                    icon: matched?.name
                        ? <CheckCircleOutlined style={{ color: '#52c41a' }} />
                        : <CloseCircleOutlined style={{ color: '#ff4d4f' }} />,
                    value: item.name_col,
                    setter: (v: string | undefined) => update('name_col', v),
                },
                {
                    key: 'address', field: '地址',
                    icon: matched?.address
                        ? <CheckCircleOutlined style={{ color: '#52c41a' }} />
                        : <CloseCircleOutlined style={{ color: '#ff4d4f' }} />,
                    value: item.address_col,
                    setter: (v: string | undefined) => update('address_col', v),
                },
                {
                    key: 'phone', field: '电话',
                    icon: matched?.phone
                        ? <CheckCircleOutlined style={{ color: '#52c41a' }} />
                        : <CloseCircleOutlined style={{ color: '#ff4d4f' }} />,
                    value: item.phone_col,
                    setter: (v: string | undefined) => update('phone_col', v),
                },
                {
                    key: 'product_model', field: '产品型号',
                    icon: matched?.product_model
                        ? <CheckCircleOutlined style={{ color: '#52c41a' }} />
                        : <CloseCircleOutlined style={{ color: '#ff4d4f' }} />,
                    value: item.product_model_col,
                    setter: (v: string | undefined) => update('product_model_col', v),
                },
            ]}
            columns={[
                { title: '匹配', dataIndex: 'icon', width: 60, align: 'center' as const },
                { title: '需求字段', dataIndex: 'field', width: 100 },
                {
                    title: '对应列',
                    dataIndex: 'key',
                    render: (_: string, record: any) => (
                        <Select
                            value={record.value}
                            onChange={record.setter}
                            placeholder="请选择列"
                            style={{ width: '100%' }}
                            allowClear
                        >
                            {headers.map((h: string) => (
                                <Select.Option key={h} value={h}>{h}</Select.Option>
                            ))}
                        </Select>
                    ),
                },
            ]}
            pagination={false}
            size="small"
        />
    );
};

const UploadModal: React.FC<Props> = ({ visible, onClose, onSuccess }) => {
    const [step, setStep] = useState<0 | 1 | 2>(0);
    const [fileItems, setFileItems] = useState<FilePreviewItem[]>([]);
    const [importing, setImporting] = useState(false);

    const handleReset = useCallback(() => {
        setStep(0);
        setFileItems([]);
        setImporting(false);
    }, []);

    const handleCancel = () => {
        handleReset();
        onClose();
    };

    // 处理文件选择：对每个文件预览
    const handleFilesSelected = useCallback(async (uploadFiles: UploadFile[]) => {
        const files: File[] = [];
        for (const uf of uploadFiles) {
            const raw = uf.originFileObj || (uf as unknown as File);
            if (raw && (raw.name.endsWith('.xlsx') || raw.name.endsWith('.xls') || raw.name.endsWith('.csv'))) {
                files.push(raw);
            }
        }
        if (files.length === 0) {
            message.warning('请选择 .xlsx / .xls / .csv 格式的文件');
            return false;
        }

        // 初始化文件项
        const items: FilePreviewItem[] = files.map((f) => ({
            file: f,
            preview: null,
            name_col: undefined,
            address_col: undefined,
            phone_col: undefined,
            product_model_col: undefined,
            shipped: false,
            status: 'pending' as const,
        }));
        setFileItems(items);
        setStep(1);

        // 逐个预览
        const updated = [...items];
        for (let i = 0; i < updated.length; i++) {
            updated[i] = { ...updated[i], status: 'previewing' };
            setFileItems([...updated]);
            try {
                const res = await uploadPreview(updated[i].file);
                if (res.success) {
                    updated[i] = {
                        ...updated[i],
                        preview: res.data,
                        name_col: res.data.matched.name || undefined,
                        address_col: res.data.matched.address || undefined,
                        phone_col: res.data.matched.phone || undefined,
                        product_model_col: res.data.matched.product_model || undefined,
                        status: 'ready',
                    };
                } else {
                    updated[i] = { ...updated[i], status: 'error', error_msg: res.message };
                }
            } catch (e: any) {
                const detail = e?.response?.data?.detail;
                updated[i] = {
                    ...updated[i],
                    status: 'error' as const,
                    error_msg: detail || '预览失败',
                };
            }
            setFileItems([...updated]);
        }
        return false;
    }, []);

    // 更新单个文件项
    const updateFileItem = useCallback((index: number, item: FilePreviewItem) => {
        const updated = [...fileItems];
        updated[index] = item;
        setFileItems(updated);
    }, [fileItems]);

    // 批量导入
    const handleBatchImport = async () => {
        const invalidFiles = fileItems.filter(
            (it) => !it.name_col || !it.address_col || !it.phone_col || !it.product_model_col
        );
        if (invalidFiles.length > 0) {
            message.warning(
                `有 ${invalidFiles.length} 个文件尚未配置完整的列映射：${invalidFiles.map((f) => f.file.name).join(', ')}`
            );
            return;
        }

        setImporting(true);
        setStep(2);
        try {
            // 只发送状态为 ready 的文件，跳过有错误的文件
            const validItems = fileItems.filter((it) => it.status === 'ready');
            const skippedCount = fileItems.length - validItems.length;
            const files = validItems.map((it) => it.file);
            const mappings = validItems.map((it) => ({
                name_col: it.name_col!,
                address_col: it.address_col!,
                phone_col: it.phone_col!,
                product_model_col: it.product_model_col || undefined,
                shipped: it.shipped,
            }));

            const res = await uploadBatchImport(files, mappings);
            if (res.success) {
                const succeeded = res.data.file_results.filter((r) => r.success).length;
                const failed = res.data.file_results.filter((r) => !r.success).length;
                let msg = `导入完成：成功 ${succeeded} 个文件，${res.data.total_inserted} 条记录`;
                if (failed) msg += `，${failed} 个文件失败`;
                if (skippedCount) msg += `，${skippedCount} 个文件因错误被跳过`;
                if (res.data.has_duplicates) msg += `，发现 ${res.data.total_duplicates} 条重复`;
                message.success(msg);

                onSuccess(res.data.duplicates);
                handleReset();
                onClose();
            }
        } catch {
            message.error('批量导入失败，请重试');
            setStep(1);
        } finally {
            setImporting(false);
        }
    };

    const hasReadyFiles = fileItems.some((it) => it.status === 'ready');
    const allConfigured =
        hasReadyFiles &&
        fileItems.every(
            (it) =>
                it.status !== 'ready' ||
                (!!it.name_col && !!it.address_col && !!it.phone_col && !!it.product_model_col)
        );

    return (
        <Modal
            title="上传订单表格"
            open={visible}
            onCancel={handleCancel}
            width={720}
            footer={null}
            destroyOnHidden
        >
            <Steps
                className="dd-steps"
                current={step}
                size="small"
                style={{ marginBottom: 24 }}
                items={[
                    { title: '选择文件' },
                    { title: '确认列映射' },
                    { title: '导入数据' },
                ]}
            />

            {/* 步骤0：多文件拖拽上传 */}
            {step === 0 && (
                <Dragger
                    accept=".xlsx,.xls,.csv"
                    multiple
                    showUploadList={false}
                    beforeUpload={(file, allFiles) => {
                        handleFilesSelected(allFiles);
                        return false;
                    }}
                >
                    <p className="ant-upload-drag-icon">
                        <InboxOutlined />
                    </p>
                    <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
                    <p className="ant-upload-hint">
                        支持 .xlsx / .xls / .csv 格式，可一次选择多个文件
                    </p>
                </Dragger>
            )}

            {/* 步骤1：文件列表 + 列映射 */}
            {step === 1 && (
                <div>
                    <Text type="secondary" style={{ marginBottom: 12, display: 'block' }}>
                        已选择 {fileItems.length} 个文件，每个文件可单独调整列映射。
                    </Text>

                    <Table
                        dataSource={fileItems.map((it, idx) => ({ ...it, idx }))}
                        rowKey="idx"
                        pagination={false}
                        size="small"
                        expandable={{
                            expandedRowRender: (record: any) => (
                                <FileMappingEditor
                                    item={record}
                                    onUpdate={(updated) => updateFileItem(record.idx, updated)}
                                />
                            ),
                            rowExpandable: () => true,
                            expandIcon: ({ expanded, onExpand, record }: any) => (
                                <Tooltip title="配置列映射">
                                    <SettingOutlined
                                        style={{ cursor: 'pointer', color: '#1677ff' }}
                                        onClick={(e) => onExpand(record, e)}
                                    />
                                </Tooltip>
                            ),
                        }}
                        columns={[
                            {
                                title: '文件名',
                                dataIndex: 'file',
                                render: (file: File) => (
                                    <Space>
                                        <FileTextOutlined />
                                        <Text ellipsis style={{ maxWidth: 280 }}>{file.name}</Text>
                                    </Space>
                                ),
                            },
                            {
                                title: '状态',
                                dataIndex: 'status',
                                width: 160,
                                render: (status: string, record: FilePreviewItem) => {
                                    if (status === 'pending') return <Tag color="default">待预览</Tag>;
                                    if (status === 'previewing') return <Tag color="processing">分析中...</Tag>;
                                    if (status === 'error') {
                                        const errMsg = record.error_msg || '未知错误';
                                        return (
                                            <Tooltip title={errMsg}>
                                                <Tag color="error" style={{ cursor: 'pointer' }}>失败</Tag>
                                            </Tooltip>
                                        );
                                    }
                                    const allOk = !!record.name_col && !!record.address_col && !!record.phone_col && !!record.product_model_col;
                                    return allOk
                                        ? <Tag color="success">就绪</Tag>
                                        : <Tag color="warning">需配置</Tag>;
                                },
                            },
                            {
                                title: '姓名列',
                                dataIndex: 'name_col',
                                width: 120,
                                render: (v: string | undefined) => v || <Text type="danger">未设置</Text>,
                            },
                            {
                                title: '地址列',
                                dataIndex: 'address_col',
                                width: 120,
                                render: (v: string | undefined) => v || <Text type="danger">未设置</Text>,
                            },
                            {
                                title: '电话列',
                                dataIndex: 'phone_col',
                                width: 120,
                                render: (v: string | undefined) => v || <Text type="danger">未设置</Text>,
                            },
                            {
                                title: '产品型号列',
                                dataIndex: 'product_model_col',
                                width: 120,
                                render: (v: string | undefined) => v || <Text type="danger">未设置(必填)</Text>,
                            },
                            {
                                title: '发货',
                                dataIndex: 'shipped',
                                width: 80,
                                align: 'center' as const,
                                render: (shipped: boolean, record: any) => (
                                    <Switch
                                        size="small"
                                        checked={shipped}
                                        onChange={(checked) => {
                                            const updated = { ...record, shipped: checked };
                                            updateFileItem(record.idx, updated);
                                        }}
                                        checkedChildren="是"
                                        unCheckedChildren="否"
                                    />
                                ),
                            },
                        ]}
                    />

                    <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Space>
                            <Button onClick={() => setStep(0)}>返回选择文件</Button>
                        </Space>
                        <Space>
                            <Button onClick={handleCancel}>取消</Button>
                            <Button
                                type="primary"
                                onClick={handleBatchImport}
                                disabled={!allConfigured}
                                loading={importing}
                                icon={<ArrowRightOutlined />}
                            >
                                导入全部 ({fileItems.length} 个文件)
                            </Button>
                        </Space>
                    </div>
                </div>
            )}

            {/* 步骤2：导入中 */}
            {step === 2 && (
                <div className="dd-importing">
                    <Spin size="large" />
                    <div style={{ marginTop: 14, color: 'var(--ink-3)', fontSize: 13.5 }}>
                        正在批量导入数据并进行重复检测…
                    </div>
                    <div className="dd-importing-list">
                        {fileItems.map((it, i) => (
                            <div key={i}>{it.file.name}</div>
                        ))}
                    </div>
                </div>
            )}
        </Modal>
    );
};

export default UploadModal;