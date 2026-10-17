import React from 'react';
import { Modal, Button, Typography, List, Alert } from 'antd';
import { PlusSquareOutlined, MinusSquareOutlined } from '@ant-design/icons';
import useCatalog from '../hooks/useCatalog';
import Cookies from 'js-cookie';
import ReactGA from 'react-ga4';

export default function MyEquipment() {
  const { items: equipment, loading, error } = useCatalog('equipment');
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      ReactGA.event('view_my_equipment');
    }
  }, [open]);

  const [myEquipment, setMyEquipment] = React.useState(
    (Cookies.get('my-equipment') || '').split('|'),
  );
  const [missingEquipment, setMissingEquipment] = React.useState(
    (Cookies.get('missing-equipment') || '').split('|'),
  );

  React.useEffect(
    () =>
      void Cookies.set('my-equipment', myEquipment.filter(Boolean).join('|'), {
        SameSite: 'Lax',
      }),
    [myEquipment],
  );
  React.useEffect(
    () =>
      void Cookies.set(
        'missing-equipment',
        missingEquipment.filter(Boolean).join('|'),
        { SameSite: 'Lax' },
      ),
    [missingEquipment],
  );

  const add = (value) => {
    ReactGA.event('add_equipment', { value });
    setMyEquipment((old) => [...old, value]);
    setMissingEquipment((old) => old.filter((a) => a !== value));
  };
  const remove = (value) => {
    ReactGA.event('remove_equipment', { value });
    setMyEquipment((old) => old.filter((a) => a !== value));
    setMissingEquipment((old) => [...old, value]);
  };

  const EquipmentItem = ({ label, value }) => {
    const actions = [];
    if (!myEquipment.includes(value) || missingEquipment.includes(value)) {
      actions.push(
        <Button icon={<PlusSquareOutlined />} onClick={() => add(value)}>
          I have
        </Button>,
      );
    }
    if (myEquipment.includes(value) || !missingEquipment.includes(value)) {
      actions.push(
        <Button icon={<MinusSquareOutlined />} onClick={() => remove(value)}>
          I don't have
        </Button>,
      );
    }
    return (
      <List.Item actions={actions}>
        <Typography.Text>{label || value}</Typography.Text>
      </List.Item>
    );
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}>My Equipment</Button>
      <Modal
        title='My Equipment'
        width='75%'
        open={open}
        okText='Done'
        onOk={() => setOpen(false)}
        onCancel={() => setOpen(false)}
        cancelButtonProps={{ style: { display: 'none' } }}
        styles={{
          body: { overflowY: 'scroll' },
          content: { height: 'calc(100vh - 150px)' },
        }}
      >
        <Typography.Paragraph>
          Let us know what equipment you have so we can tailor the tools to what
          you have.
        </Typography.Paragraph>
        {error && (
          <Alert
            type='error'
            style={{ marginBottom: 16 }}
            message='Could not load the list. Please try again later.'
          />
        )}
        <List
          header='My Equipment'
          dataSource={equipment.filter(({ value }) =>
            myEquipment.includes(value),
          )}
          bordered
          loading={loading}
          renderItem={EquipmentItem}
        />
        <br />
        <List
          header='Equipment Pool'
          dataSource={equipment.filter(
            ({ value }) =>
              !myEquipment.includes(value) && !missingEquipment.includes(value),
          )}
          bordered
          loading={loading}
          renderItem={EquipmentItem}
        />
        <br />
        <List
          header='Missing Equipment'
          dataSource={equipment.filter(({ value }) =>
            missingEquipment.includes(value),
          )}
          bordered
          loading={loading}
          renderItem={EquipmentItem}
        />
      </Modal>
    </>
  );
}
