import axios from 'axios';

const call = (method, url, data) =>
  axios({ method, url: `/api${url}`, data }).then((res) => res.data);

export { errorMessage } from './errors';

// Accounts
const me = () => call('get', '/account/me');
const signup = (username, password) =>
  call('post', '/account/signup', { username, password });
const login = (username, password) =>
  call('post', '/account/login', { username, password });
const logout = () => call('post', '/account/logout');
const recover = (username, recoveryCode, newPassword) =>
  call('post', '/account/recover', { username, recoveryCode, newPassword });
const changePassword = (currentPassword, newPassword) =>
  call('post', '/account/password', { currentPassword, newPassword });
const deleteAccount = (password) => call('delete', '/account', { password });

// Dynamics
const listDynamics = () => call('get', '/dynamics');
const getDynamic = (id) => call('get', `/dynamics/${id}`);
const startSolo = (alias) => call('post', '/dynamics/solo', { alias });
const invite = (role, alias) =>
  call('post', '/dynamics/invite', { role, alias });
const previewInvite = (code) => call('post', '/dynamics/preview', { code });
const joinDynamic = (code, alias) =>
  call('post', '/dynamics/join', { code, alias });
const withdrawInvite = (id) => call('delete', `/dynamics/${id}`);
const setAlias = (id, alias) => call('put', `/dynamics/${id}/me`, { alias });
const pause = (id, details) => call('post', `/dynamics/${id}/pause`, details);
const resume = (id) => call('post', `/dynamics/${id}/resume`, {});
const end = (id, details) => call('post', `/dynamics/${id}/end`, details);

export default {
  me,
  signup,
  login,
  logout,
  recover,
  changePassword,
  deleteAccount,
  listDynamics,
  getDynamic,
  startSolo,
  invite,
  previewInvite,
  joinDynamic,
  withdrawInvite,
  setAlias,
  pause,
  resume,
  end,
};
