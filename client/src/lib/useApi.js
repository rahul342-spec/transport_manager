import { useCallback, useEffect, useState } from 'react';
import { api } from './api';

// Loads `path` and reloads whenever it changes. Returns { data, loading, error, reload }.
export function useApi(path, { skip = false } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(!skip);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    if (skip || !path) return;
    setLoading(true);
    setError('');
    try {
      setData(await api(path));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [path, skip]);

  useEffect(() => { reload(); }, [reload]);
  return { data, loading, error, reload, setData };
}
