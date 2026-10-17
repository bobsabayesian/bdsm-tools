import React from 'react';
import dayjs from 'dayjs';
import advancedFormat from 'dayjs/plugin/advancedFormat';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import localeData from 'dayjs/plugin/localeData';
import weekday from 'dayjs/plugin/weekday';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import weekYear from 'dayjs/plugin/weekYear';
import {
  App,
  Badge,
  Button,
  Calendar,
  Empty,
  List,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd';
import DynamicPage from '../components/DynamicPage';
import api, { errorMessage } from '../services/tasks-api';
import CompleteTaskModal from './CompleteTaskModal';
import { requirement } from './proofs';
import { Summary, windows } from './schedule';

// The calendar needs these dayjs plugins
dayjs.extend(customParseFormat);
dayjs.extend(advancedFormat);
dayjs.extend(weekday);
dayjs.extend(localeData);
dayjs.extend(weekOfYear);
dayjs.extend(weekYear);

const BADGE = {
  pending: 'processing',
  submitted: 'warning',
  done: 'success',
  'not-done': 'default',
  cancelled: 'default',
};

function Mine({ dynamicId, paused }) {
  const { message } = App.useApp();
  const [data, setData] = React.useState(null);
  const [day, setDay] = React.useState(dayjs());
  const [doing, setDoing] = React.useState(null);

  const load = () =>
    api
      .list(dynamicId)
      .then(setData)
      .catch((e) => message.error(errorMessage(e)));
  React.useEffect(() => {
    setData(null);
    load();
  }, [dynamicId]);

  if (!data) return <Spin size='large' />;
  if (!data.you.isAssignee) {
    return (
      <Empty description='Tasks you are given appear here. In this dynamic you are the one setting them - see To review for what has been submitted.' />
    );
  }

  const mine = data.assignments.filter(
    (a) => a.status !== 'cancelled' && !a.queued,
  );
  const w = windows(mine);
  const fresh = (a) => mine.find((x) => x.id === a?.id) ?? a;
  const onDay = (date) =>
    mine.filter((a) => a.dueAt && dayjs(a.dueAt).isSame(date, 'day'));
  const doIt = (a) => a.status === 'pending' && !paused && setDoing(a);

  return (
    <>
      <Space wrap align='stretch' style={{ width: '100%', marginBottom: 16 }}>
        {w.overdue.length > 0 && (
          <Summary
            title='Overdue'
            tasks={w.overdue}
            color='#d71616'
            onDo={doIt}
          />
        )}
        <Summary title='Next 24 hours' tasks={w.next24} onDo={doIt} />
        <Summary title='Next 48 hours' tasks={w.next48} onDo={doIt} />
        <Summary title='Next week' tasks={w.nextWeek} onDo={doIt} />
      </Space>

      <Calendar
        value={day}
        onSelect={setDay}
        cellRender={(date, info) => {
          if (info.type !== 'date') return info.originNode;
          const tasks = onDay(date);
          return (
            <div>
              {tasks.slice(0, 3).map((a) => (
                <div key={a.id} style={{ fontSize: 12, lineHeight: 1.3 }}>
                  <Badge
                    status={
                      a.overdue ? 'error' : (BADGE[a.status] ?? 'default')
                    }
                    text={a.task.task}
                  />
                </div>
              ))}
              {tasks.length > 3 && (
                <Typography.Text type='secondary' style={{ fontSize: 12 }}>
                  +{tasks.length - 3} more
                </Typography.Text>
              )}
            </div>
          );
        }}
      />

      <Typography.Title level={5} style={{ marginTop: 16 }}>
        {day.format('dddd D MMMM')}
      </Typography.Title>
      <List
        locale={{ emptyText: 'Nothing due this day' }}
        dataSource={onDay(day)}
        renderItem={(a) => (
          <List.Item
            actions={
              a.status === 'pending' && !paused
                ? [
                    <Button key='do' type='primary' onClick={() => doIt(a)}>
                      Do it
                    </Button>,
                  ]
                : []
            }
          >
            <List.Item.Meta
              title={
                <>
                  {a.task.task}{' '}
                  <Tag color={a.overdue ? 'red' : undefined}>
                    {a.overdue ? 'Overdue' : a.status}
                  </Tag>
                </>
              }
              description={`${requirement(a.task)} Due ${dayjs(a.dueAt).format('h:mma')}`}
            />
          </List.Item>
        )}
      />

      {w.undated.length > 0 && (
        <>
          <Typography.Title level={5} style={{ marginTop: 16 }}>
            No due date
          </Typography.Title>
          <List
            dataSource={w.undated}
            renderItem={(a) => (
              <List.Item
                actions={
                  paused
                    ? []
                    : [
                        <Button key='do' onClick={() => doIt(a)}>
                          Do it
                        </Button>,
                      ]
                }
              >
                <List.Item.Meta
                  title={a.task.task}
                  description={requirement(a.task)}
                />
              </List.Item>
            )}
          />
        </>
      )}

      <CompleteTaskModal
        dynamicId={dynamicId}
        assignment={fresh(doing)}
        open={!!doing}
        onClose={() => setDoing(null)}
        onChanged={load}
      />
    </>
  );
}

/** The tasks you have been given: what is coming up, and a calendar of them all */
export default function MyTasks() {
  return (
    <DynamicPage title='My tasks'>
      {(current) => (
        <Mine
          key={current.id}
          dynamicId={current.id}
          paused={current.status === 'paused'}
        />
      )}
    </DynamicPage>
  );
}
