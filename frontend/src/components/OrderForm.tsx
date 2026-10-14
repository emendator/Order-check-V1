import React, { useEffect } from 'react';
import { Modal, Form, Input, Checkbox, Switch, Space, Typography, message } from 'antd';
import type { Order, OrderFormData } from '../types';
import { createOrder, updateOrderById } from '../api';
import type { DuplicateInfo } from '../types';

const { Text } = Typography;

interface Props {
    visible: boolean;
    editingOrder: Order | null; // null = 新增模式
    onClose: () => void;
    onSuccess: (duplicate: DuplicateInfo | null) => void;
}

const OrderForm: React.FC<Props> = ({ visible, editingOrder, onClose, onSuccess }) => {
    const [form] = Form.useForm<OrderFormData>();
    const isEdit = editingOrder !== null;

    useEffect(() => {
        if (visible) {
            if (editingOrder) {
                form.setFieldsValue({
                    name: editingOrder.name,
                    address: editingOrder.address,
                    phone: editingOrder.phone,
                    product_model: editingOrder.product_model || '',
                    shipped: editingOrder.shipped,
                });
            } else {
                form.resetFields();
                form.setFieldsValue({ shipped: false, product_model: '' });
            }
        }
    }, [visible, editingOrder, form]);

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();
            if (isEdit && editingOrder) {
                const res = await updateOrderById(editingOrder.id, values);
                if (res.success) {
                    message.success(res.message);
                    onSuccess(
                        res.data.has_duplicate
                            ? { new_record: values, existing_record: res.data.duplicate! }
                            : null
                    );
                }
            } else {
                const res = await createOrder(values);
                if (res.success) {
                    message.success(res.message);
                    onSuccess(
                        res.data.has_duplicate
                            ? { new_record: values, existing_record: res.data.duplicate! }
                            : null
                    );
                }
            }
            onClose();
        } catch {
            // 表单验证失败
        }
    };

    return (
        <Modal
            title={isEdit ? '编辑订单' : '新增订单'}
            open={visible}
            onOk={handleSubmit}
            onCancel={onClose}
            okText="保存"
            cancelText="取消"
            width={520}
            destroyOnHidden
        >
            <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
                <Form.Item
                    name="name"
                    label="姓名"
                    rules={[{ required: true, message: '请输入姓名' }]}
                >
                    <Input placeholder="收件人姓名" maxLength={100} />
                </Form.Item>
                <Form.Item
                    name="address"
                    label="地址"
                    rules={[{ required: true, message: '请输入地址' }]}
                >
                    <Input.TextArea placeholder="收货地址" maxLength={300} rows={2} />
                </Form.Item>
                <Form.Item
                    name="phone"
                    label="电话"
                    rules={[
                        { required: true, message: '请输入电话' },
                        { pattern: /^[\d\-+()（）\s]+$/, message: '电话格式不正确' },
                    ]}
                >
                    <Input placeholder="联系电话" maxLength={30} />
                </Form.Item>
                <Form.Item
                    name="product_model"
                    label="产品型号"
                    rules={[{ required: true, message: '请输入产品型号' }]}
                >
                    <Input placeholder="产品型号（必填）" maxLength={100} />
                </Form.Item>
                <Form.Item name="shipped" valuePropName="checked" label=" ">
                    <Space>
                        <Switch checkedChildren="已发货" unCheckedChildren="未发货" />
                        <Text type="secondary" style={{ fontSize: 13 }}>
                            {form.getFieldValue('shipped') ? '标记为已发货' : '标记为未发货'}
                        </Text>
                    </Space>
                </Form.Item>
            </Form>
        </Modal>
    );
};

export default OrderForm;