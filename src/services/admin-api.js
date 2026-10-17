import axios from 'axios';

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

/** Pull the most useful message out of a failed request */
export const errorMessage = (e) =>
  e?.response?.data?.errors?.join('. ') ??
  e?.response?.data?.error ??
  e?.message ??
  'Unknown error';

export const isUnauthorized = (e) => e?.response?.status === 401;

const getCatalogs = (token) => request('get', '/catalogs', undefined, token);
const listItems = (catalog) => request('get', `/catalogs/${catalog}/items`);
const createItem = (catalog, item) =>
  request('post', `/catalogs/${catalog}/items`, item);
const updateItem = (catalog, id, item) =>
  request('put', `/catalogs/${catalog}/items/${id}`, item);
const deleteItem = (catalog, id) =>
  request('delete', `/catalogs/${catalog}/items/${id}`);

export default { getCatalogs, listItems, createItem, updateItem, deleteItem };
