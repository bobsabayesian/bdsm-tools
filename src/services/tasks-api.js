import axios from 'axios';

const call = (method, url, data) =>
  axios({ method, url: `/api/dynamics${url}`, data }).then((res) => res.data);

export { errorMessage } from './errors';

/** The machine-readable parts of a failed request: { code, ...extra } */
export const errorData = (e) => e?.response?.data ?? {};

const list = (id) => call('get', `/${id}/tasks`);
const library = (id) => call('get', `/${id}/library`);
const taskFields = (id) => call('get', `/${id}/task-fields`);
const assignOptions = (id) => call('get', `/${id}/assign-options`);
const schedules = (id) => call('get', `/${id}/schedules`);
const stopSchedule = (id, sid) =>
  call('post', `/${id}/schedules/${sid}/stop`, {});
const assign = (id, body) => call('post', `/${id}/tasks`, body);
const start = (id, aid) => call('post', `/${id}/tasks/${aid}/start`, {});
const submit = (id, aid, response) =>
  call('post', `/${id}/tasks/${aid}/submit`, { response });
// Photo / video / audio: the file goes up on its own, then the task is submitted
const mediaUrl = (id, aid) => `/api/dynamics/${id}/tasks/${aid}/media`;
const uploadMedia = (id, aid, file) =>
  axios
    .put(mediaUrl(id, aid), file, {
      headers: { 'Content-Type': file.type, 'X-Upload': '1' },
    })
    .then((res) => res.data);
const review = (id, aid, approve, note) =>
  call('post', `/${id}/tasks/${aid}/review`, { approve, note });
const startConsequence = (id, aid, dueAt) =>
  call('post', `/${id}/tasks/${aid}/start-consequence`, { dueAt });
const cancel = (id, aid) => call('post', `/${id}/tasks/${aid}/cancel`, {});
const notDone = (id, aid) => call('post', `/${id}/tasks/${aid}/not-done`, {});

const listRules = (id) => call('get', `/${id}/rules`);
const createRule = (id, rule) => call('post', `/${id}/rules`, rule);
const updateRule = (id, rid, rule) => call('put', `/${id}/rules/${rid}`, rule);
const retireRule = (id, rid) => call('post', `/${id}/rules/${rid}/retire`, {});
const restoreRule = (id, rid, body) =>
  call('post', `/${id}/rules/${rid}/restore`, body);

const comments = (id, target) =>
  call('get', `/${id}/comments?target=${encodeURIComponent(target)}`);
const comment = (id, target, body) =>
  call('post', `/${id}/comments`, { target, body });

export default {
  startConsequence,
  assignOptions,
  schedules,
  stopSchedule,
  mediaUrl,
  uploadMedia,
  list,
  library,
  taskFields,
  assign,
  start,
  submit,
  review,
  cancel,
  notDone,
  listRules,
  createRule,
  updateRule,
  retireRule,
  restoreRule,
  comments,
  comment,
};
