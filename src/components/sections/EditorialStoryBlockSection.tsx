/**
 * EditorialStoryBlockSection — Dynamic CMS merchandising slot for brand/craft narrative.
 * Contains editorial story copy, craft highlights, and imagery only—never static product prices or stock.
 */

import React from 'react';
import { ArrowRight } from 'lucide-react';
import { EditorialStoryBlockSectionConfig } from '../../domain/content';
import { navigateTo } from '../../integration/hooks/useRouter';
import { StudioImage } from '../ui/StudioImage';

export function EditorialStoryBlockSection({
  config,
}: {
  config: EditorialStoryBlockSectionConfig;
}) {
  return (
    <section
      aria-labelledby={`story-heading-${config.id}`}
      className="border-b border-[#D6CFC2] bg-[#FAF8F5] py-14 sm:py-20"
    >
      <div className="mx-auto max-w-[1360px] px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-14">
          {/* Left: Story Copy & Craft Matrix */}
          <div className="space-y-6 lg:col-span-7">
            <p className="text-[11px] font-semibold tracking-[0.2em] text-[#7A1C1D] uppercase">
              {config.kicker}
            </p>
            <h2
              id={`story-heading-${config.id}`}
              className="font-editorial text-3xl font-semibold leading-tight text-[#161311] sm:text-4xl lg:text-5xl"
            >
              {config.headline}
            </h2>

            <div className="space-y-4 text-sm leading-relaxed text-[#524B44] sm:text-base">
              {config.paragraphs.map((paragraph, idx) => (
                <p key={idx}>{paragraph}</p>
              ))}
            </div>

            {config.craftHighlights.length > 0 && (
              <dl className="grid grid-cols-1 gap-4 border-y border-[#D6CFC2] py-5 sm:grid-cols-3">
                {config.craftHighlights.map((item) => (
                  <div key={item.label} className="border-l-2 border-[#7A1C1D] pl-3.5">
                    <dt className="text-xs font-semibold tracking-wider text-[#161311] uppercase">
                      {item.label}
                    </dt>
                    <dd className="mt-1 text-xs leading-relaxed text-[#524B44]">{item.detail}</dd>
                  </div>
                ))}
              </dl>
            )}

            <div className="pt-1">
              <a
                href={config.ctaHref}
                onClick={(e) => {
                  e.preventDefault();
                  navigateTo(config.ctaHref);
                }}
                className="inline-flex h-11 items-center gap-2 border border-[#161311] bg-transparent px-5 text-xs font-semibold tracking-[0.15em] text-[#161311] uppercase transition-colors duration-150 hover:bg-[#161311] hover:text-[#F4F1EA]"
              >
                <span>{config.ctaLabel}</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </div>
          </div>

          {/* Right: Editorial Textile / Atelier Image */}
          <div className="lg:col-span-5">
            <div className="border border-[#D6CFC2] bg-[#F4F1EA] p-3">
              <StudioImage asset={config.storyImage} showDemoBadge={true} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
