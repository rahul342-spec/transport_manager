import { useEffect, useState } from 'react';
import { api } from './api';

// Active clients / vehicles / drivers for dropdowns
export function useLookups() {
  const [data, setData] = useState({ clients: [], vehicles: [], drivers: [], loaded: false });
  useEffect(() => {
    Promise.all([
      api('/clients?limit=500'),
      api('/vehicles?limit=500'),
      api('/drivers?limit=500'),
    ]).then(([c, v, d]) => setData({ clients: c.items, vehicles: v.items, drivers: d.items, loaded: true }))
      .catch(() => setData((x) => ({ ...x, loaded: true })));
  }, []);
  return data;
}

// Keeps a currently-selected inactive record visible in the dropdown
export const activeOr = (list, selectedId) => list.filter((x) => x.active !== false || x._id === selectedId);
