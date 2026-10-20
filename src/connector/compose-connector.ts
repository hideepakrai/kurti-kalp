/**
 * Connector Composition Boundary (Separated from UI).
 *
 * Guarantees:
 * 1. Production client bundle (`vite build`, where `import.meta.env.DEV` is false)
 *    contains ZERO code or data from `src/testing/mock-connector` or `src/testing/fixtures/*`.
 * 2. Connected mode uses `HttpStorefrontConnector` calling only same-origin `/api/storefront/v1/*`.
 * 3. Unavailable mode (or missing backend config) uses `UnavailableStorefrontConnector`
 *    and never silently serves fake live data.
 */

import { StorefrontRuntimeMode } from '../domain/content';
import { HttpStorefrontConnector } from './http-connector';
import { StorefrontConnector } from './storefront-connector';
import { UnavailableStorefrontConnector } from './unavailable-connector';

export function resolveInitialStorefrontMode(): StorefrontRuntimeMode {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const queryMode = params.get('mode');
    if (queryMode === 'demo' || queryMode === 'connected' || queryMode === 'unavailable') {
      if (!import.meta.env.DEV && queryMode === 'demo') {
        return 'unavailable';
      }
      return queryMode;
    }
  }

  const envMode = import.meta.env.VITE_STOREFRONT_MODE;
  if (envMode === 'connected' || envMode === 'unavailable') {
    return envMode;
  }
  if (envMode === 'demo') {
    return import.meta.env.DEV ? 'demo' : 'unavailable';
  }

  // Default: 'demo' in local dev/test, 'connected' in production builds
  return import.meta.env.DEV ? 'demo' : 'connected';
}

export async function composeStorefrontConnector(
  mode: StorefrontRuntimeMode
): Promise<{
  connector: StorefrontConnector;
  effectiveMode: StorefrontRuntimeMode;
}> {
  if (mode === 'unavailable') {
    return {
      connector: new UnavailableStorefrontConnector(),
      effectiveMode: 'unavailable',
    };
  }

  if (mode === 'connected') {
    return {
      connector: new HttpStorefrontConnector({ basePath: '/api/storefront/v1' }),
      effectiveMode: 'connected',
    };
  }

  if (import.meta.env.DEV) {
    const devMockModule = await import('../testing/mock-connector');
    if (devMockModule?.defaultMockConnector) {
      return {
        connector: devMockModule.defaultMockConnector,
        effectiveMode: 'demo',
      };
    }
  }

  return {
    connector: new UnavailableStorefrontConnector(
      'Demo fixtures are excluded from production builds. Configure the Kalp upstream service to enable Connected mode.'
    ),
    effectiveMode: 'unavailable',
  };
}
