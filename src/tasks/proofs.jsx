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
