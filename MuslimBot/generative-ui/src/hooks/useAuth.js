'use client';

import { useEffect, useState } from 'react';

// useAuth reads the current identity from the orchestrator (/v1/auth/me, proxied
// via next.config rewrite). Authentik/ForwardAuth injects identity headers; a 401
// means the visitor is unauthenticated.
//
// status: 'loading' | 'authenticated' | 'guest'
export function useAuth({ skip = false } = {}) {
  const [state, setState] = useState({ status: skip ? 'guest' : 'loading', user: null });

  useEffect(() => {
    if (skip) {
      setState({ status: 'guest', user: null });
      return;
    }
    let alive = true;
    fetch('/v1/auth/me', {
      headers: { Accept: 'application/json' },
      credentials: 'include',
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!alive) return;
        setState({ status: data && data.email ? 'authenticated' : 'guest', user: data });
      })
      .catch(() => {
        if (alive) setState({ status: 'guest', user: null });
      });
    return () => {
      alive = false;
    };
  }, [skip]);

  return state;
}
