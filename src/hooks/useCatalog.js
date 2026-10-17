import React from 'react';
import axios from 'axios';
import { alphabeticalSort } from '../util';

// One request per catalog per page load, shared by every component using it
const requests = {};
const fetchCatalog = (name) => {
  if (!requests[name]) {
    requests[name] = axios
      .get(`/api/catalog/${name}`)
      .then((res) => res.data.sort(alphabeticalSort(({ label }) => label)))
      .catch((e) => {
        delete requests[name]; // allow a retry next time
        throw e;
      });
  }
  return requests[name];
};

/** The `{ label, value }` items of a public catalog (see worker/catalogs.js) */
export default function useCatalog(name) {
  const [state, setState] = React.useState({ items: [], loading: true });

  React.useEffect(() => {
    let cancelled = false;
    fetchCatalog(name)
      .then((items) => !cancelled && setState({ items, loading: false }))
      .catch(
        (error) => !cancelled && setState({ items: [], loading: false, error }),
      );
    return () => {
      cancelled = true;
    };
  }, [name]);

  return state;
}
