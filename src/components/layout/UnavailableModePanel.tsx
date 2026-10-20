/**
 * UnavailableModePanel — Honest unavailable state displayed when:
 * 1. The storefront is in `unavailable` mode, or
 * 2. Connected mode calls `/api/storefront/v1/*` and the BFF reports `UPSTREAM_UNAVAILABLE` (503)
 *    because the upstream Kalp Business API is not configured yet.
 *
 * Guarantees the storefront never silently serves fake live catalog or checkout data.
 */

import React from 'react';
import { PhoneCall, RefreshCw, ServerOff } from 'lucide-react';
import { useStorefront } from '../../integration/StorefrontProvider';
import { navigateTo } from '../../integration/hooks/useRouter';

export function UnavailableModePanel({ reason }: { reason?: string }) {
  const { config, runtimeMode, setRuntimeMode, retryBoot } = useStorefront();

  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 lg:px-8">
      <div
        role="region"
        aria-labelledby="unavailable-mode-heading"
        className="border-2 border-[#7A1C1D] bg-[#FAF8F5] p-6 sm:p-10"
      >
        <div className="flex items-start gap-4">
          <ServerOff className="mt-1 h-7 w-7 shrink-0 text-[#7A1C1D]" aria-hidden="true" />
          <div className="space-y-3">
            <p className="text-[11px] font-semibold tracking-[0.2em] text-[#7A1C1D] uppercase">
              {runtimeMode === 'connected'
                ? 'CONNECTED MODE · UPSTREAM KALP API NOT CONFIGURED (503)'
                : 'STOREFRONT UNAVAILABLE MODE · NO FAKE LIVE DATA'}
            </p>
            <h1
              id="unavailable-mode-heading"
              className="font-editorial text-3xl font-semibold text-[#161311] sm:text-4xl"
            >
              Live Catalog &amp; Checkout Are Currently Unavailable
            </h1>
            <p className="text-sm leading-relaxed text-[#524B44]">
              {reason ||
                'The same-origin storefront BFF (/api/storefront/v1/*) is reachable, but the upstream Kalp Business Core connection is not yet configured for this environment. To protect customer trust, GAYRAA never silently substitutes demo fixtures as live catalog or order data.'}
            </p>
          </div>
        </div>

        {/* Direct Jaipur Atelier Assistance */}
        {config && (
          <div className="mt-6 border-t border-[#D6CFC2] pt-5 text-xs text-[#524B44]">
            <h2 className="flex items-center gap-2 font-semibold tracking-wider text-[#161311] uppercase">
              <PhoneCall className="h-4 w-4 text-[#7A1C1D]" aria-hidden="true" />
              <span>GAYRAA Jaipur Atelier Direct Assistance</span>
            </h2>
            <p className="mt-1.5">
              For direct catalog inquiries or order support, contact{' '}
              <strong className="text-[#161311]">{config.contact.email}</strong> or call{' '}
              <strong className="text-[#161311]">{config.contact.phone}</strong> (
              {config.contact.hours}).
            </p>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-[#D6CFC2] pt-5">
          <button
            type="button"
            onClick={() => void retryBoot()}
            className="inline-flex h-11 items-center gap-2 border border-[#161311] bg-[#161311] px-5 text-xs font-semibold tracking-wider text-[#F4F1EA] uppercase hover:bg-[#7A1C1D]"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Retry Same-Origin BFF Connection</span>
          </button>

          {import.meta.env.DEV && (
            <button
              type="button"
              onClick={() => setRuntimeMode('demo')}
              className="inline-flex h-11 items-center border border-[#7A1C1D] bg-[#FAF8F5] px-5 text-xs font-semibold tracking-wider text-[#7A1C1D] uppercase hover:bg-[#7A1C1D] hover:text-[#F4F1EA]"
            >
              Switch to Labelled Demo Mode (Dev Only)
            </button>
          )}

          <button
            type="button"
            onClick={() => navigateTo('/support')}
            className="inline-flex h-11 items-center border border-[#D6CFC2] bg-[#F4F1EA] px-5 text-xs font-semibold tracking-wider text-[#161311] uppercase hover:border-[#161311]"
          >
            View Atelier Contact &amp; FAQ
          </button>
        </div>
      </div>
    </div>
  );
}
