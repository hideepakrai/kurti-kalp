/**
 * DevDiagnosticsBar — Strictly development-only simulation bar.
 * Excluded from customer screens unless running in DEV AND explicitly activated via `?dev=1`.
 * Never shown on production builds or normal customer flows.
 */

import React from 'react';
import { Wrench } from 'lucide-react';
import { useStorefront } from '../../integration/StorefrontProvider';
import { useRouter } from '../../integration/hooks/useRouter';

export function DevDiagnosticsBar() {
  const { devController, cart, heroVariantOverride, setHeroVariantOverride, refreshCart } =
    useStorefront();
  const { searchParams } = useRouter();

  // Strictly gate behind development mode AND explicit ?dev=1 query flag
  const isDevFlagged = import.meta.env.DEV && searchParams.get('dev') === '1';
  if (!isDevFlagged || !devController) return null;

  return (
    <aside
      aria-label="Developer simulation controls"
      className="border-t border-[#D6CFC2] bg-[#EAE4D8] px-4 py-2 text-xs text-[#161311]"
    >
      <div className="mx-auto flex max-w-[1360px] flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-semibold">
          <Wrench className="h-3.5 w-3.5 text-[#7A1C1D]" />
          <span>Dev Simulation (?dev=1)</span>
          <span className="font-mono text-[11px] text-[#524B44]">
            Cart Revision: {cart?.revision ?? 'none'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              setHeroVariantOverride(
                heroVariantOverride === 'split-editorial'
                  ? 'layered-typographic'
                  : 'split-editorial'
              )
            }
            className="border border-[#161311] bg-[#FAF8F5] px-2.5 py-1 text-[11px] font-semibold"
          >
            Hero: {heroVariantOverride || 'layered-typographic'}
          </button>

          <button
            type="button"
            onClick={() => {
              devController.setSimulationOptions({ forceNextError: 'NETWORK_FAILURE' });
            }}
            className="border border-[#961B1E] bg-[#FDECEC] px-2.5 py-1 text-[11px] font-semibold text-[#961B1E]"
          >
            Force Next Network Error
          </button>

          <button
            type="button"
            onClick={() => {
              devController.bumpCartRevisionExternally();
              void refreshCart();
            }}
            className="border border-[#7C4700] bg-[#FDF3E7] px-2.5 py-1 text-[11px] font-semibold text-[#7C4700]"
          >
            Simulate External Cart Bump
          </button>

          <button
            type="button"
            onClick={() => {
              devController.expireActiveQuotesNow();
            }}
            className="border border-[#7C4700] bg-[#FDF3E7] px-2.5 py-1 text-[11px] font-semibold text-[#7C4700]"
          >
            Expire Active Quotes
          </button>
        </div>
      </div>
    </aside>
  );
}
