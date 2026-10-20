/**
 * CampaignBannerSlotSection — Dynamic CMS campaign/banner slot.
 * Supports configurable 'stone' or 'contrast' surface themes with surface-aware focus rings.
 */

import React from 'react';
import { ArrowRight } from 'lucide-react';
import { CampaignBannerSlotSectionConfig } from '../../domain/content';
import { navigateTo } from '../../integration/hooks/useRouter';

export function CampaignBannerSlotSection({
  config,
}: {
  config: CampaignBannerSlotSectionConfig;
}) {
  const isContrast = config.surfaceTheme === 'contrast';

  return (
    <section
      aria-labelledby={`slot-heading-${config.id}`}
      data-slot-key={config.slotKey}
      className={`border-b border-[#D6CFC2] py-12 sm:py-16 ${
        isContrast
          ? 'surface-contrast bg-[#161311] text-[#F4F1EA]'
          : 'bg-[#EAE4D8] text-[#161311]'
      }`}
    >
      <div className="mx-auto max-w-[1360px] px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-6 border border-[#D6CFC2]/60 p-6 sm:p-10 lg:flex-row lg:items-center">
          <div className="max-w-2xl space-y-2">
            <p
              className={`text-[11px] font-semibold tracking-[0.2em] uppercase ${
                isContrast ? 'text-[#C8C0B4]' : 'text-[#7A1C1D]'
              }`}
            >
              {config.eyebrow}
            </p>
            <h2
              id={`slot-heading-${config.id}`}
              className="font-editorial text-2xl font-semibold leading-snug sm:text-3xl"
            >
              {config.headline}
            </h2>
            <p
              className={`text-xs leading-relaxed sm:text-sm ${
                isContrast ? 'text-[#C8C0B4]' : 'text-[#524B44]'
              }`}
            >
              {config.subcopy}
            </p>
          </div>

          <div className="shrink-0">
            <a
              href={config.ctaHref}
              onClick={(e) => {
                e.preventDefault();
                navigateTo(config.ctaHref);
              }}
              className={`inline-flex h-12 items-center gap-2.5 px-6 text-xs font-semibold tracking-[0.16em] uppercase whitespace-nowrap transition-colors duration-150 ${
                isContrast
                  ? 'bg-[#F4F1EA] text-[#161311] hover:bg-[#C59B27] hover:text-[#161311]'
                  : 'bg-[#161311] text-[#F4F1EA] hover:bg-[#7A1C1D]'
              }`}
            >
              <span>{config.ctaLabel}</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
