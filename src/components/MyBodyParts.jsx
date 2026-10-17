import React from 'react';
import { Modal, Button, Typography, List, Alert } from 'antd';
import { PlusSquareOutlined, MinusSquareOutlined } from '@ant-design/icons';
import useCatalog from '../hooks/useCatalog';
import Cookies from 'js-cookie';
import ReactGA from 'react-ga4';

export default function MyBodyParts() {
  const { items: bodyParts, loading, error } = useCatalog('bodyParts');
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      ReactGA.event('view_my_equipment');
    }
  }, [open]);

  const [myBodyParts, setMyBodyParts] = React.useState(
    (Cookies.get('body-parts') || '').split('|'),
  );

  React.useEffect(
    () =>
      void Cookies.set('body-parts', myBodyParts.filter(Boolean).join('|'), {
        SameSite: 'Lax',
      }),
    [myBodyParts],
  );

  const add = (value) => {
    ReactGA.event('add_body_part', { value });
    setMyBodyParts((old) => [...old, value]);
  };
  const remove = (value) => {
    ReactGA.event('remove_body_part', { value });
    setMyBodyParts((old) => old.filter((a) => a !== value));
  };

  const BodyPartItem = ({ label, value }) => {
    const actions = [];
    if (!myBodyParts.includes(value)) {
      actions.push(
        <Button icon={<PlusSquareOutlined />} onClick={() => add(value)}>
          I have
        </Button>,
      );
    }
    if (myBodyParts.includes(value)) {
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
      <Button onClick={() => setOpen(true)}>My Body Parts</Button>
      <Modal
        title='My Body Parts'
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
          Let us know what body parts you have and are willing to use so we can
          tailor the tools to what you have.
        </Typography.Paragraph>
        {error && (
          <Alert
            type='error'
            style={{ marginBottom: 16 }}
            message='Could not load the list. Please try again later.'
          />
        )}
        <List
          header='My Body Parts'
          dataSource={bodyParts.filter(({ value }) =>
            myBodyParts.includes(value),
          )}
          bordered
          loading={loading}
          renderItem={BodyPartItem}
        />
        <br />
        <List
          header='Body Parts'
          dataSource={bodyParts.filter(
            ({ value }) => !myBodyParts.includes(value),
          )}
          bordered
          loading={loading}
          renderItem={BodyPartItem}
        />
      </Modal>
    </>
  );
}
