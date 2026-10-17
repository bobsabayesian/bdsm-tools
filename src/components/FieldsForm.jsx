import React from 'react';
import { Form, Input, InputNumber, Select, Switch } from 'antd';

/**
 * Forms built from the field definitions in worker/catalogs.js, shared by the
 * admin tool and the "write my own task" form so they always agree.
 */

export const fieldRules = (field) => [
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
export function FieldInput({ field, options, ...formProps }) {
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
    case 'refOne':
      return <Select allowClear showSearch options={options} {...formProps} />;
    default:
      return <Input {...formProps} />;
  }
}

/** The starting value of every field that has a default */
export const fieldDefaults = (fields) =>
  Object.fromEntries(
    fields
      .filter((f) => f.default !== undefined)
      .map((f) => [f.name, f.default]),
  );

/**
 * One Form.Item per field. Fields with `showWhen` only appear while another
 * field has one of the listed values. `refOptions` maps a catalog name to
 * [{ value, label }] for fields that refer to another catalog.
 */
export function renderFields(fields, refOptions = {}) {
  return fields.map((field) => {
    const item = (
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
    );
    if (!field.showWhen) return item;

    const { field: controller, in: values } = field.showWhen;
    return (
      <Form.Item
        key={field.name}
        noStyle
        shouldUpdate={(before, after) =>
          before[controller] !== after[controller]
        }
      >
        {({ getFieldValue }) =>
          values.includes(getFieldValue(controller)) ? item : null
        }
      </Form.Item>
    );
  });
}
