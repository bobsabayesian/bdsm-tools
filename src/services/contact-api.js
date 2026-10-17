import axios from 'axios';

const send = (message) =>
  axios.post('/api/contact', message).then((res) => res.data);
const getThread = (token) =>
  axios.get(`/api/contact/thread/${token}`).then((res) => res.data);
const replyInThread = (token, body) =>
  axios.post(`/api/contact/thread/${token}`, { body }).then((res) => res.data);

export { errorMessage } from './errors';
export default { send, getThread, replyInThread };
