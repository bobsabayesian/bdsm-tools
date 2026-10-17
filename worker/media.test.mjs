import test from 'node:test';
import assert from 'node:assert/strict';
import { acceptedKinds, bareType, kindOf, parseRange } from './media.js';

test('only photo, video and audio types are accepted, as the task asks', () => {
  assert.equal(bareType('Image/JPEG; charset=x'), 'image/jpeg');
  assert.equal(kindOf('image/png'), 'photo');
  assert.equal(kindOf('video/mp4'), 'video');
  assert.equal(kindOf('audio/mpeg'), 'audio');
  assert.equal(kindOf('text/html'), null);
  assert.equal(kindOf('image/svg+xml'), null, 'svg can carry scripts');
  assert.deepEqual(acceptedKinds(undefined), ['photo']);
  assert.deepEqual(acceptedKinds('video'), ['video']);
  assert.deepEqual(acceptedKinds('any'), ['photo', 'video', 'audio']);
});

test('byte ranges, for playing video', () => {
  assert.deepEqual(parseRange('bytes=0-99', 1000), { offset: 0, length: 100 });
  assert.deepEqual(parseRange('bytes=900-', 1000), {
    offset: 900,
    length: 100,
  });
  assert.deepEqual(parseRange('bytes=-100', 1000), {
    offset: 900,
    length: 100,
  });
  assert.deepEqual(parseRange('bytes=990-5000', 1000), {
    offset: 990,
    length: 10,
  });
  assert.equal(parseRange('bytes=2000-', 1000), null);
  assert.equal(parseRange('nonsense', 1000), null);
  assert.equal(parseRange(undefined, 1000), null);
});
