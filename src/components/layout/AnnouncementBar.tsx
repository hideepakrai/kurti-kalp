/**
 * AnnouncementBar — Slim top policy & demo status strip.
 * Uses surface-contrast class so keyboard focus rings are light (#F4F1EA) on espresso (#161311).
 */

import React from 'react';
import { useStorefront } from '../../integration/StorefrontProvider';

export function AnnouncementBar() {
  const { config, openPolicyDrawer } = useStorefront();

  if (!config?.announcementBar.enabled) return null;

  return (
    <div className="surface-contrast border-b border-[#38312C] bg-[#161311] px-4 py-2 text-[#F4F1EA]">
      <div className="mx-auto flex max-w-[1360px] flex-wrap items-center justify-between gap-2 text-[11px] tracking-wider uppercase">
        <p className="font-semibold text-[#F4F1EA]">{config.announcementBar.message}</p>
        <div className="flex items-center gap-4 text-[#C8C0B4]">
          <span>{config.announcementBar.secondaryMessage}</span>
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
