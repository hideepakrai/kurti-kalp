/**
 * AnnouncementBar — Slim top policy & explicit runtime mode status strip.
 * Uses surface-contrast class so keyboard focus rings are light (#F4F1EA) on espresso (#161311).
 * Visibly labels Demo, Connected, and Unavailable modes.
 */

import React from 'react';
import { StorefrontRuntimeMode } from '../../domain/content';
import { useStorefront } from '../../integration/StorefrontProvider';

export function AnnouncementBar() {
  const { config, runtimeMode, setRuntimeMode, openPolicyDrawer } = useStorefront();

  if (!config?.announcementBar.enabled) return null;

  const modeBadgeLabel =
    runtimeMode === 'demo'
      ? 'DEMO MODE (FIXTURES · NOINDEX)'
      : runtimeMode === 'connected'
        ? 'CONNECTED MODE (/api/storefront/v1)'
        : 'UNAVAILABLE MODE';

  const modeBadgeStyle =
    runtimeMode === 'demo'
      ? 'border-[#C59B27] bg-[#C59B27]/15 text-[#F4F1EA]'
      : runtimeMode === 'connected'
        ? 'border-[#B5DBC6] bg-[#165B38] text-[#F4F1EA]'
        : 'border-[#F2B8B9] bg-[#961B1E] text-[#F4F1EA]';

  return (
    <div className="surface-contrast border-b border-[#38312C] bg-[#161311] px-4 py-2 text-[#F4F1EA]">
      <div className="mx-auto flex max-w-[1360px] flex-wrap items-center justify-between gap-2 text-[11px] tracking-wider uppercase">
        <div className="flex flex-wrap items-center gap-2.5">
          <span
            data-testid="storefront-mode-badge"
            className={`inline-flex items-center border px-2 py-0.5 text-[10px] font-semibold tracking-widest ${modeBadgeStyle}`}
          >
            {modeBadgeLabel}
          </span>
          <p className="font-semibold text-[#F4F1EA]">{config.announcementBar.message}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-[#C8C0B4]">
          <label className="inline-flex items-center gap-1.5 text-[10px]">
            <span className="sr-only">Storefront runtime mode</span>
            <select
              aria-label="Storefront runtime mode"
              value={runtimeMode}
              onChange={(e) => setRuntimeMode(e.target.value as StorefrontRuntimeMode)}
              className="border border-[#524B44] bg-[#221D1A] px-2 py-0.5 text-[10px] font-semibold tracking-wider text-[#F4F1EA] uppercase"
            >
              {import.meta.env.DEV && <option value="demo">Mode: Demo</option>}
              <option value="connected">Mode: Connected (BFF)</option>
              <option value="unavailable">Mode: Unavailable</option>
            </select>
          </label>
          <span aria-hidden="true">·</span>
          <button
            type="button"
            onClick={(e) => openPolicyDrawer('shipping', e.currentTarget)}
            className="underline decoration-[#C8C0B4]/60 underline-offset-4 transition-colors duration-150 hover:text-[#F4F1EA]"
          >
            Shipping &amp; Exchange Terms
          </button>
        </div>
      </div>
    </div>
  );
}
