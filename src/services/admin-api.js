import axios from 'axios';
import { errorMessage } from './errors';

const baseUrl = '/api/admin';
const TOKEN_KEY = 'admin-token';

// Session storage: the token is forgotten when the tab closes
export const getToken = () => {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};
export const setToken = (token) => {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage unavailable - the user will just need to log in again
  }
};

const request = (method, url, data, token = getToken()) =>
  axios({
    method,
    url: baseUrl + url,
    data,
    headers: { Authorization: `Bearer ${token}` },
  }).then((res) => res.data);

export { errorMessage };

export const isUnauthorized = (e) => e?.response?.status === 401;

const getCatalogs = (token) => request('get', '/catalogs', undefined, token);
const listItems = (catalog) => request('get', `/catalogs/${catalog}/items`);
const createItem = (catalog, item) =>
  request('post', `/catalogs/${catalog}/items`, item);
const updateItem = (catalog, id, item) =>
  request('put', `/catalogs/${catalog}/items/${id}`, item);
const deleteItem = (catalog, id) =>
  request('delete', `/catalogs/${catalog}/items/${id}`);

// Messages from the contact form, with the conversation in each
const messages = () => request('get', '/messages');
const replyToMessage = (id, body) =>
  request('post', `/messages/${id}/reply`, { body });
const setMessageStatus = (id, status) =>
  request('put', `/messages/${id}`, { status });
const deleteMessage = (id) => request('delete', `/messages/${id}`);

// Who may sign up, and the invite codes
const access = () => request('get', '/access');
const setSignupMode = (mode) => request('put', '/access/mode', { mode });
const createInvite = (note, days) =>
  request('post', '/invites', { note, days });
const deleteInvite = (id) => request('delete', `/invites/${id}`);

// Checking someone is who they say they are, and letting them back in
const findUsers = (q) => request('get', `/users?q=${encodeURIComponent(q)}`);
const createResetCode = (id, note) =>
  request('post', `/users/${id}/reset-code`, { note });

export default {
  getCatalogs,
  listItems,
  createItem,
  updateItem,
  deleteItem,
  messages,
  replyToMessage,
  setMessageStatus,
  deleteMessage,
  access,
  setSignupMode,
  createInvite,
  deleteInvite,
  findUsers,
  createResetCode,
};
