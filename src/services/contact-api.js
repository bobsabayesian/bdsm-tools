import axios from 'axios';

const send = (message) =>
  axios.post('/api/contact', message).then((res) => res.data);

export { errorMessage } from './errors';
export default { send };
