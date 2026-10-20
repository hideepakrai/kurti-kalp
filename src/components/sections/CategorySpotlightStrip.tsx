/**
 * CategorySpotlightStrip — Three-category dark contrast spotlight band.
 * Inspired by the GAZU dark 3-card strip, adapted to GAYRAA's ethnic & fusion categories.
 * Applies `.surface-contrast` so focus rings are high-contrast warm alabaster (#F4F1EA).
 */

import React from 'react';
import { ArrowRight } from 'lucide-react';
import { CategorySpotlightSectionConfig } from '../../domain/content';
import { navigateTo } from '../../integration/hooks/useRouter';
import { StudioImage } from '../ui/StudioImage';

export function CategorySpotlightStrip({ config }: { config: CategorySpotlightSectionConfig }) {
  return (
    <section
      aria-label={config.sectionLabel}
      className="surface-contrast border-b border-[#38312C] bg-[#161311] py-12 text-[#F4F1EA] sm:py-16"
    >
      <div className="mx-auto max-w-[1360px] px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3 lg:gap-10">
          {config.items.map((item) => (
            <a
              key={item.id}
              href={item.href}
              onClick={(e) => {
                e.preventDefault();
                navigateTo(item.href);
              }}
              className="group flex items-center gap-5 border border-[#38312C] bg-[#241F1C]/60 p-4 transition-colors duration-200 hover:border-[#C8C0B4]"
            >
              <div className="w-28 shrink-0 overflow-hidden border border-[#38312C] sm:w-32">
                <StudioImage
                  asset={item.image}
                  imageClassName="group-hover:scale-[1.03]"
                />
              </div>

              <div className="flex flex-1 flex-col justify-between">
                <div>
                  <h2 className="font-editorial text-xl font-semibold tracking-wider text-[#F4F1EA] uppercase sm:text-2xl">
                    {item.title}
                  </h2>
                  <p className="mt-1.5 text-xs leading-relaxed text-[#C8C0B4]">
                    {item.subtitle}
                  </p>
                </div>

                <div className="mt-4 inline-flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-[#F4F1EA] uppercase">
                  <span className="underline decoration-[#C8C0B4] underline-offset-4 transition-colors duration-150 group-hover:decoration-[#F4F1EA]">
                    {item.ctaLabel}
                  </span>
                  <ArrowRight
                    className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-1"
                    aria-hidden="true"
                  />
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
