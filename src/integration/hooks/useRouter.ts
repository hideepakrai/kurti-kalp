/**
 * Lightweight History API Router Hook for the 4 Reusable Templates + Global Cart Drawer.
 * Supports browser back/forward navigation, direct URL loads, and URL query parameters.
 */

import { useCallback, useEffect, useState } from 'react';

export interface RouteState {
  pathname: string;
  search: string;
  searchParams: URLSearchParams;
}

function getLocationState(): RouteState {
  const pathname = window.location.pathname || '/';
  const search = window.location.search || '';
  return {
    pathname,
    search,
    searchParams: new URLSearchParams(search),
  };
}

export function navigateTo(href: string, options?: { replace?: boolean; preserveScroll?: boolean }): void {
  if (options?.replace) {
    window.history.replaceState({}, '', href);
  } else {
    window.history.pushState({}, '', href);
  }
  window.dispatchEvent(new PopStateEvent('popstate'));
  if (!options?.preserveScroll) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

export function useRouter() {
  const [route, setRoute] = useState<RouteState>(() => getLocationState());

  useEffect(() => {
    const handlePopState = () => {
      setRoute(getLocationState());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = useCallback(
    (href: string, options?: { replace?: boolean; preserveScroll?: boolean }) => {
      navigateTo(href, options);
    },
    []
  );

  return {
    ...route,
    navigate,
  };
}
