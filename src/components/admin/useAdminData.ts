'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { adminFetch, AdminError } from './api';

/**
 * `useEffect`-based data loader for admin screens.
 *
 * Deliberately hand-rolled rather than pulling in a data library: the admin panel
 * only ever does "fetch a JSON list, mutate it, refetch", and a 40-line hook is
 * easier to reason about than a cache we would have to invalidate correctly.
 */
export function useAdminData<T>(
  path: string | null,
  deps: unknown[] = [],
): {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
  setData: (updater: T | ((prev: T | null) => T | null)) => void;
} {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(path));
  const [nonce, setNonce] = useState(0);
  const depsRef = useRef(deps);
  depsRef.current = deps;

  useEffect(() => {
    if (!path) {
      setData(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError(null);

    adminFetch<T>(path, { signal: controller.signal })
      .then((result) => {
        if (!active) return;
        setData(result);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!active || controller.signal.aborted) return;
        setError(err instanceof AdminError ? err.message : 'Could not load this data.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, nonce, ...deps]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  const update = useCallback((updater: T | ((prev: T | null) => T | null)) => {
    setData((prev) =>
      typeof updater === 'function' ? (updater as (p: T | null) => T | null)(prev) : updater,
    );
  }, []);

  return { data, error, loading, reload, setData: update };
}

/** Async action runner with pending state and a surfaced error. */
export function useAdminAction(): {
  busy: boolean;
  error: string | null;
  message: string | null;
  run: <T>(fn: () => Promise<T>) => Promise<T | null>;
  clear: () => void;
} {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const inFlight = useRef(false);

  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | null> => {
    if (inFlight.current) return null;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      return await fn();
    } catch (err) {
      setError(err instanceof AdminError ? err.message : 'Something went wrong.');
      return null;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, []);

  const clear = useCallback(() => {
    setError(null);
    setMessage(null);
  }, []);

  return { busy, error, message, run, clear };
}
