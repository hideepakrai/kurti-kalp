/**
 * SeasonalCampaignSection — Split editorial banner ("Occasion & Festive Edit").
 * Inspired by the GAZU "NEW SEASON / NEW VIBES" split block, adapted for GAYRAA's
 * Shop by Occasion merchandising edits (Wedding, Festive, Casual, Office, Vacation).
 */

import React from 'react';
import { ArrowRight } from 'lucide-react';
import { SeasonalCampaignSectionConfig } from '../../domain/content';
import { navigateTo } from '../../integration/hooks/useRouter';
import { StudioImage } from '../ui/StudioImage';

export function SeasonalCampaignSection({
  config,
}: {
  config: SeasonalCampaignSectionConfig;
}) {
  return (
    <section
      aria-labelledby={`campaign-${config.id}`}
      className="border-b border-[#D6CFC2] bg-[#EAE4D8] py-12 sm:py-16"
    >
      <div className="mx-auto max-w-[1360px] px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-8 border border-[#D6CFC2] bg-[#FAF8F5] p-6 sm:p-10 lg:grid-cols-12 lg:gap-12">
          <div className="space-y-6 lg:col-span-7">
            <p className="text-xs font-semibold tracking-[0.22em] text-[#7A1C1D] uppercase">
              {config.kicker}
            </p>

            <h2
              id={`campaign-${config.id}`}
              className="font-editorial text-4xl font-semibold leading-[1.08] tracking-tight text-[#161311] sm:text-5xl"
              style={{ textWrap: 'balance' }}
            >
              {config.headline}
            </h2>

            <p className="max-w-xl text-sm leading-relaxed text-[#524B44] sm:text-base">
              {config.description}
            </p>

            {/* Occasion Quick-Filter Links */}
            <div className="space-y-2 pt-2">
              <span className="block text-[11px] font-semibold tracking-wider text-[#524B44] uppercase">
                Browse by Occasion:
              </span>
              <div className="flex flex-wrap gap-2">
                {config.occasionLinks.map((occ) => (
                  <a
                    key={occ.href}
                    href={occ.href}
                    onClick={(e) => {
                      e.preventDefault();
                      navigateTo(occ.href);
                    }}
                    className="inline-flex h-9 items-center border border-[#D6CFC2] bg-[#F4F1EA] px-3.5 text-xs font-semibold tracking-wider text-[#161311] uppercase whitespace-nowrap shrink-0 transition-colors duration-150 hover:border-[#161311] hover:bg-[#161311] hover:text-[#F4F1EA]"
                  >
                    {occ.label}
                  </a>
                ))}
              </div>
            </div>

            <div className="pt-2">
              <a
                href={config.ctaHref}
                onClick={(e) => {
                  e.preventDefault();
                  navigateTo(config.ctaHref);
                }}
                className="inline-flex h-12 items-center justify-center gap-2 bg-[#161311] px-7 text-xs font-semibold tracking-[0.16em] text-[#F4F1EA] uppercase whitespace-nowrap shrink-0 transition-colors duration-150 hover:bg-[#7A1C1D]"
              >
                <span>{config.ctaLabel}</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
            </div>
          </div>

          <div className="mx-auto w-full max-w-sm lg:col-span-5">
            <div className="border border-[#D6CFC2]">
              <StudioImage asset={config.bannerImage} showDemoBadge={true} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
