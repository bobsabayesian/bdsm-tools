import React from 'react';
import { App, Button, Form, Modal, Popconfirm, Space, Table, Tag } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { fieldDefaults, renderFields } from '../components/FieldsForm';
import api, { errorMessage, isUnauthorized } from '../services/admin-api';

function renderCell(field, value, options) {
  if (value === undefined || value === null) return null;
  switch (field.type) {
    case 'boolean':
      return value ? <Tag color='green'>Yes</Tag> : <Tag>No</Tag>;
    case 'strings':
    case 'ref':
      return value.map((v) => <Tag key={v}>{v}</Tag>);
    case 'select':
      return field.options.find((o) => o.value === value)?.label ?? value;
    case 'refOne':
      return options?.find((o) => o.value === value)?.label ?? value;
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
        catalog.fields
          .filter((f) => f.type === 'ref' || f.type === 'refOne')
          .map((f) => f.catalog),
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
  const defaults = fieldDefaults(catalog.fields);
  const initialValues =
    editing === 'new' ? defaults : { ...defaults, ...editing };

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
      .filter((f) => f.inTable !== false)
      .filter((f) => f.type !== 'text' || f.name === catalog.titleField)
      .map((field) => ({
        title: field.label,
        dataIndex: field.name,
        ellipsis: field.type === 'text' || field.type === 'string',
        render: (value) => renderCell(field, value, refOptions[field.catalog]),
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
          {renderFields(catalog.fields, refOptions)}
        </Form>
      </Modal>
    </>
  );
}
