import React from 'react';
import {
  App,
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import api, { errorMessage, isUnauthorized } from '../services/admin-api';

const fieldRules = (field) => [
  ...(field.required
    ? [{ required: true, message: `${field.label} is required` }]
    : []),
  ...(field.pattern
    ? [
        {
          pattern: new RegExp(field.pattern),
          message:
            field.patternMessage ?? `${field.label} has an invalid format`,
        },
      ]
    : []),
];

// Form.Item hands this component `value`/`onChange` (`checked` for switches);
// they must reach the real control or the form never sees what was typed.
function FieldInput({ field, options, ...formProps }) {
  switch (field.type) {
    case 'text':
      return (
        <Input.TextArea autoSize={{ minRows: 2, maxRows: 8 }} {...formProps} />
      );
    case 'number':
      return <InputNumber style={{ width: '100%' }} {...formProps} />;
    case 'boolean':
      return <Switch {...formProps} />;
    case 'select':
      return <Select allowClear options={field.options} {...formProps} />;
    case 'strings':
      return (
        <Select
          mode='tags'
          tokenSeparators={[',']}
          open={false}
          {...formProps}
        />
      );
    case 'ref':
      return <Select mode='tags' options={options} {...formProps} />;
    default:
      return <Input {...formProps} />;
  }
}

function renderCell(field, value) {
  if (value === undefined || value === null) return null;
  switch (field.type) {
    case 'boolean':
      return value ? <Tag color='green'>Yes</Tag> : <Tag>No</Tag>;
    case 'strings':
    case 'ref':
      return value.map((v) => <Tag key={v}>{v}</Tag>);
    case 'select':
      return field.options.find((o) => o.value === value)?.label ?? value;
    default:
      return value;
  }
}

export default function CatalogManager({
  id,
  catalog,
  catalogs,
  onUnauthorized,
}) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [items, setItems] = React.useState(null);
  const [refOptions, setRefOptions] = React.useState({});
  const [editing, setEditing] = React.useState(null); // null | 'new' | item
  const [saving, setSaving] = React.useState(false);

  const fail = (prefix) => (e) => {
    if (isUnauthorized(e)) return onUnauthorized();
    message.error(`${prefix}: ${errorMessage(e)}`);
  };

  const load = () =>
    api.listItems(id).then(setItems).catch(fail('Failed to load items'));

  React.useEffect(() => {
    load();
    // Suggestions for `ref` fields come from the referenced catalog's keys
    const refs = [
      ...new Set(
        catalog.fields.filter((f) => f.type === 'ref').map((f) => f.catalog),
      ),
    ].filter((ref) => catalogs[ref]);
    Promise.all(
      refs.map((ref) =>
        api
          .listItems(ref)
          .then((list) => [
            ref,
            list.map((i) => ({ value: i.key, label: i.label ?? i.key })),
          ]),
      ),
    )
      .then((entries) => setRefOptions(Object.fromEntries(entries)))
      .catch(() => {}); // Suggestions are a nicety; the field still accepts free text
  }, []);

  // Suggest a key from the label until the admin edits the key themselves
  const suggestKey = (changed) => {
    if (editing !== 'new' || !changed.label || form.isFieldTouched('key'))
      return;
    form.setFieldValue(
      'key',
      changed.label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, ''),
    );
  };

  const open = (item) => setEditing(item);

  // Values the form starts with when it opens
  const initialValues =
    editing === 'new'
      ? Object.fromEntries(
          catalog.fields
            .filter((f) => f.default !== undefined)
            .map((f) => [f.name, f.default]),
        )
      : editing;

  const save = (values) => {
    setSaving(true);
    const isNew = editing === 'new';
    (isNew
      ? api.createItem(id, values)
      : api.updateItem(id, editing._id, values)
    )
      .then(() => {
        message.success(isNew ? 'Created' : 'Saved');
        setEditing(null);
        return load();
      })
      .catch(fail('Failed to save'))
      .finally(() => setSaving(false));
  };

  const remove = (item) =>
    api
      .deleteItem(id, item._id)
      .then(() => {
        message.success('Deleted');
        return load();
      })
      .catch(fail('Failed to delete'));

  const columns = [
    ...catalog.fields
      .filter((f) => f.type !== 'text' || f.name === catalog.titleField)
      .map((field) => ({
        title: field.label,
        dataIndex: field.name,
        ellipsis: field.type === 'text' || field.type === 'string',
        render: (value) => renderCell(field, value),
        sorter:
          field.type === 'string' || field.type === 'text'
            ? (a, b) => (a[field.name] ?? '').localeCompare(b[field.name] ?? '')
            : undefined,
      })),
    {
      title: '',
      key: 'actions',
      width: 140,
      render: (_, item) => (
        <Space>
          <Button size='small' onClick={() => open(item)}>
            Edit
          </Button>
          <Popconfirm
            title='Delete this item?'
            description={
              catalog.keyed
                ? 'Anything referring to it will keep the old key. Consider deactivating instead.'
                : 'This cannot be undone.'
            }
            okButtonProps={{ danger: true }}
            onConfirm={() => remove(item)}
          >
            <Button size='small' danger>
              Delete
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Button
        type='primary'
        icon={<PlusOutlined />}
        style={{ marginBottom: 16 }}
        onClick={() => open('new')}
      >
        Add
      </Button>
      <Table
        rowKey='_id'
        size='small'
        loading={items === null}
        dataSource={items ?? []}
        columns={columns}
        pagination={{ pageSize: 25, hideOnSinglePage: true }}
        scroll={{ x: true }}
      />
      <Modal
        open={!!editing}
        title={editing === 'new' ? 'Add' : 'Edit'}
        okText='Save'
        confirmLoading={saving}
        onOk={() => form.submit()}
        onCancel={() => setEditing(null)}
        destroyOnHidden
      >
        <Form
          form={form}
          layout='vertical'
          initialValues={initialValues}
          preserve={false}
          onFinish={save}
          onValuesChange={suggestKey}
        >
          {catalog.fields.map((field) => (
            <Form.Item
              key={field.name}
              name={field.name}
              label={field.label}
              extra={field.help}
              rules={fieldRules(field)}
              valuePropName={field.type === 'boolean' ? 'checked' : 'value'}
            >
              <FieldInput field={field} options={refOptions[field.catalog]} />
            </Form.Item>
          ))}
        </Form>
      </Modal>
    </>
  );
}
