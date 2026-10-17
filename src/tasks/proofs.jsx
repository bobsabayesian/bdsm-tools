import React from 'react';
import { Typography } from 'antd';

export const PROOF_LABEL = {
  attestation: 'Just do it',
  media: 'Photo / video / audio',
  numeric: 'Enter a number',
  text: 'Write something',
  lines: 'Write lines',
  timer: 'Timer',
  choice: 'Choose',
  quiz: 'Quiz',
  checkin: 'Check in',
  location: 'Location',
};

/** "Question | Answer" -> "Question" (the person doing a quiz is only ever sent the question) */
export const questionOf = (entry) => String(entry).split('|')[0].trim();

const MEDIA_WORD = {
  photo: 'a photo',
  video: 'a video',
  audio: 'a recording',
};

/** What the person doing a task will be asked to do, in a sentence */
export function requirement(task) {
  const quoted = (text) => `\u201c${text}\u201d`;
  switch (task.proof ?? 'attestation') {
    case 'media':
      return `You upload ${MEDIA_WORD[task.allowedMedia] ?? 'a photo, video or recording'}.`;
    case 'numeric': {
      const unit = task.unit ? ` (${task.unit})` : '';
      const hasMin = typeof task.minValue === 'number';
      const hasMax = typeof task.maxValue === 'number';
      const range =
        hasMin && hasMax
          ? `, between ${task.minValue} and ${task.maxValue}`
          : hasMin
            ? `, at least ${task.minValue}`
            : hasMax
              ? `, at most ${task.maxValue}`
              : '';
      return `You enter a number${unit}${range}.`;
    }
    case 'text':
      return `You write ${task.minLength ? `at least ${task.minLength} characters` : 'a response'}${task.prompt ? ` to ${quoted(task.prompt)}` : ''}.`;
    case 'lines':
      return `You write ${quoted(task.phrase)} ${task.repetitions ?? 1} ${task.repetitions === 1 ? 'time' : 'times'}, one per line.`;
    case 'timer':
      return `You hold for ${Math.floor((task.seconds ?? 0) / 60)}m ${(task.seconds ?? 0) % 60}s without a break.`;
    case 'choice':
      return `You choose one: ${(task.choices ?? []).join(', ')}.`;
    case 'quiz': {
      const n = (task.questions ?? []).length;
      return `You answer ${n} ${n === 1 ? 'question' : 'questions'} correctly.`;
    }
    case 'checkin':
      return 'You check in. The time is recorded, and checking in after the due time is noted.';
    case 'location':
      return `You share your location${task.place ? ` at ${task.place}` : ''}.`;
    default:
      return 'You mark it done.';
  }
}

/** What someone submitted, in a line or two, for the list and for review */
export function ResponseSummary({ task, response, mediaUrl }) {
  if (!response) return null;
  const proof = task.proof ?? 'attestation';
  switch (proof) {
    case 'numeric':
      return (
        <Typography.Text>
          {response.value}
          {task.unit ? ` ${task.unit}` : ''}
        </Typography.Text>
      );
    case 'text':
      return (
        <Typography.Paragraph style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
          {response.text}
        </Typography.Paragraph>
      );
    case 'lines':
      return <Typography.Text>Wrote it {response.lines} times</Typography.Text>;
    case 'timer':
      return (
        <Typography.Text>
          Held for {Math.floor(response.seconds / 60)}m {response.seconds % 60}s
        </Typography.Text>
      );
    case 'choice':
      return <Typography.Text>Chose: {response.choice}</Typography.Text>;
    case 'quiz':
      return (
        <Typography.Text>Answered every question correctly</Typography.Text>
      );
    case 'media': {
      const { kind } = response.media;
      const box = { maxWidth: '100%', maxHeight: 360, display: 'block' };
      return kind === 'photo' ? (
        <a href={mediaUrl} target='_blank' rel='noreferrer'>
          <img src={mediaUrl} alt='Submitted' style={box} />
        </a>
      ) : kind === 'video' ? (
        <video src={mediaUrl} controls preload='metadata' style={box} />
      ) : (
        <audio src={mediaUrl} controls preload='metadata' />
      );
    }
    case 'checkin':
      return (
        <Typography.Text>
          Checked in {new Date(response.at).toLocaleString()}
          {response.minutesLate > 0
            ? ` - ${response.minutesLate} min late`
            : ' - on time'}
        </Typography.Text>
      );
    case 'location':
      return (
        <Typography.Text>
          <Typography.Link
            href={`https://www.openstreetmap.org/?mlat=${response.lat}&mlon=${response.lng}#map=17/${response.lat}/${response.lng}`}
            target='_blank'
            rel='noreferrer'
          >
            {response.lat}, {response.lng}
          </Typography.Link>
          {response.distanceMeters !== undefined &&
            ` - ${response.distanceMeters} m from ${task.place ?? 'the place'}`}
          {response.withinRadius === false && ' (outside the distance asked)'}
        </Typography.Text>
      );
    default:
      return <Typography.Text>Marked as done</Typography.Text>;
  }
}
