// Photo, video and audio proofs live in R2 (binding MEDIA), one object per task:
//   dynamics/<dynamic id>/<assignment id>
// They are only ever served to the two people in the dynamic, and are deleted
// by the same retention rules as every other submission.

const MB = 1024 * 1024;

export const MEDIA_KINDS = {
  photo: {
    maxBytes: 10 * MB,
    types: [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'image/heic',
      'image/heif',
    ],
  },
  video: {
    maxBytes: 50 * MB,
    types: ['video/mp4', 'video/webm', 'video/quicktime'],
  },
  audio: {
    maxBytes: 20 * MB,
    types: [
      'audio/mpeg',
      'audio/mp4',
      'audio/x-m4a',
      'audio/aac',
      'audio/webm',
      'audio/ogg',
      'audio/wav',
    ],
  },
};

/** "image/jpeg; charset=x" -> "image/jpeg" */
export const bareType = (header = '') =>
  header.split(';')[0].trim().toLowerCase();

/** 'photo' | 'video' | 'audio' for an allowed content type, else null */
export const kindOf = (type) =>
  Object.entries(MEDIA_KINDS).find(([, k]) => k.types.includes(type))?.[0] ??
  null;

/** Which kinds a task accepts (its "Accepted proof" setting; default photo) */
export const acceptedKinds = (allowedMedia = 'photo') =>
  allowedMedia === 'any'
    ? Object.keys(MEDIA_KINDS)
    : MEDIA_KINDS[allowedMedia]
      ? [allowedMedia]
      : ['photo'];

export const mediaKey = (dynamicId, assignmentId) =>
  `dynamics/${dynamicId}/${assignmentId}`;

/** "bytes=0-99" -> { offset, length } (a single range only), or null */
export const parseRange = (header, size) => {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header ?? '');
  if (!match || (!match[1] && !match[2])) return null;
  let start;
  let end;
  if (!match[1]) {
    start = Math.max(0, size - Number(match[2]));
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  }
  if (start > end || start >= size) return null;
  return { offset: start, length: end - start + 1 };
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Daily: remove files that belong to nothing - their task is gone, or they were
 * uploaded but never submitted (or sent back) a day ago.
 */
export const sweepMedia = async (env) => {
  if (!env.MEDIA) return;
  let cursor;
  do {
    const page = await env.MEDIA.list({
      prefix: 'dynamics/',
      cursor,
      limit: 500,
    });
    for (const object of page.objects) {
      const assignmentId = object.key.split('/')[2];
      const row = await env.DB.prepare(
        'SELECT response FROM assignments WHERE id = ?',
      )
        .bind(assignmentId)
        .first();
      const stale =
        !row ||
        (row.response === null &&
          Date.now() - new Date(object.uploaded).getTime() > DAY_MS);
      if (stale) await env.MEDIA.delete(object.key);
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
};
