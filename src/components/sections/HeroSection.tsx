/**
 * HeroSection — Supports both `layered-typographic` (reference-led composition)
 * and `split-editorial` (balanced two-column fallback) via PageManifest configuration.
 *
 * Accessibility:
 * - Decorative oversized background wordmark is hidden from assistive technology (`aria-hidden="true"`).
 * - Semantic `<h1>` provides a clear, readable heading at all viewport widths.
 */

import React from 'react';
import { ArrowRight } from 'lucide-react';
import { HeroSectionConfig } from '../../domain/content';
import { useStorefront } from '../../integration/StorefrontProvider';
import { navigateTo } from '../../integration/hooks/useRouter';
import { StudioImage } from '../ui/StudioImage';

export function HeroSection({ config }: { config: HeroSectionConfig }) {
  const { heroVariantOverride, setHeroVariantOverride } = useStorefront();
  const activeVariant = heroVariantOverride ?? config.variant;

  if (activeVariant === 'split-editorial') {
    return (
      <section
        aria-labelledby="hero-heading"
        className="border-b border-[#D6CFC2] bg-[#F4F1EA] py-10 sm:py-14 lg:py-16"
      >
        <div className="mx-auto max-w-[1360px] px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 items-stretch gap-8 lg:grid-cols-12 lg:gap-12">
            <div className="flex flex-col justify-between border border-[#D6CFC2] bg-[#FAF8F5] p-6 sm:p-10 lg:col-span-7">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold tracking-[0.18em] text-[#7A1C1D] uppercase">
                  <span>{config.kicker}</span>
                  <span className="text-[#524B44]">{config.seasonTag}</span>
                </div>

                <h1
                  id="hero-heading"
                  className="mt-5 font-editorial text-4xl font-semibold leading-[1.1] tracking-tight text-[#161311] sm:text-5xl lg:text-6xl"
                  style={{ textWrap: 'balance' }}
                >
                  {config.headline}
                </h1>

                <p className="mt-5 max-w-xl text-sm leading-relaxed text-[#524B44] sm:text-base">
                  {config.subheadline}
                </p>
              </div>

              <div className="mt-8 space-y-6 border-t border-[#EAE4D8] pt-6">
                <div className="flex flex-wrap items-center gap-4">
                  <a
                    href={config.primaryCta.href}
                    onClick={(e) => {
                      e.preventDefault();
                      navigateTo(config.primaryCta.href);
                    }}
                    className="inline-flex h-12 items-center justify-center gap-2 bg-[#161311] px-7 text-xs font-semibold tracking-[0.16em] text-[#F4F1EA] uppercase whitespace-nowrap shrink-0 transition-colors duration-150 hover:bg-[#7A1C1D]"
                  >
                    <span>{config.primaryCta.label}</span>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </a>

                  <a
                    href={config.secondaryCta.href}
                    onClick={(e) => {
                      e.preventDefault();
                      navigateTo(config.secondaryCta.href);
                    }}
                    className="inline-flex h-12 items-center px-3 text-xs font-semibold tracking-[0.16em] text-[#161311] uppercase underline decoration-[#161311] underline-offset-8 whitespace-nowrap shrink-0 transition-colors duration-150 hover:text-[#7A1C1D] hover:decoration-[#7A1C1D]"
                  >
                    {config.secondaryCta.label}
                  </a>
                </div>

                <div className="flex items-center justify-between text-[11px] text-[#524B44]">
                  <span>Hero Layout: Split Editorial Fallback</span>
                  <button
                    type="button"
                    onClick={() => setHeroVariantOverride('layered-typographic')}
                    className="font-semibold text-[#7A1C1D] underline underline-offset-4 hover:text-[#161311]"
                  >
                    Switch to Layered Reference Layout
                  </button>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="h-full border border-[#D6CFC2] bg-[#FAF8F5]">
                <StudioImage
                  asset={config.heroImage}
                  priority={true}
                  showDemoBadge={true}
                  className="h-full"
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // Default: `layered-typographic` inspired by the GAZU editorial reference composition
  return (
    <section
      aria-labelledby="hero-heading"
      className="relative overflow-hidden border-b border-[#D6CFC2] bg-[#F4F1EA] py-8 sm:py-12 lg:py-14"
    >
      <div className="mx-auto max-w-[1360px] px-4 sm:px-6 lg:px-8">
        {/* Top Metadata Row */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#D6CFC2] pb-4">
          <div className="max-w-xs">
            <p className="text-xs font-semibold tracking-[0.22em] text-[#161311] uppercase">
              {config.kicker}
            </p>
            <div className="mt-2 h-0.5 w-10 bg-[#7A1C1D]" aria-hidden="true" />
          </div>

          <div className="flex items-center gap-4 text-xs text-[#524B44]">
            <span className="font-semibold tracking-[0.18em] text-[#161311] uppercase">
              {config.seasonTag}
            </span>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => setHeroVariantOverride('split-editorial')}
              className="font-semibold text-[#7A1C1D] underline underline-offset-4 hover:text-[#161311]"
            >
              Switch to Split Hero
            </button>
          </div>
        </div>

        {/* Layered Display Composition */}
        <div className="relative mt-6 grid grid-cols-1 items-center gap-8 lg:grid-cols-12">
          {/* Decorative Reference Display Wordmark (Hidden from screen readers) */}
          <div
            aria-hidden="true"
            className="pointer-events-none select-none hidden lg:flex lg:col-span-12 lg:items-center lg:justify-center lg:py-2"
          >
            <span className="font-editorial text-[9.5rem] font-semibold leading-none tracking-[0.16em] text-[#161311]/12 xl:text-[11.5rem]">
              {config.decorativeDisplayWord}
            </span>
          </div>

          {/* Left Editorial Story & CTAs */}
          <div className="z-10 flex flex-col justify-between space-y-6 lg:col-span-5">
            <div>
              <h1
                id="hero-heading"
                className="font-editorial text-4xl font-semibold leading-[1.1] tracking-tight text-[#161311] sm:text-5xl"
                style={{ textWrap: 'balance' }}
              >
                {config.headline}
              </h1>
              <p className="mt-4 text-sm leading-relaxed text-[#524B44] sm:text-base">
                {config.subheadline}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <a
                href={config.primaryCta.href}
                onClick={(e) => {
                  e.preventDefault();
                  navigateTo(config.primaryCta.href);
                }}
                className="inline-flex h-12 items-center justify-center bg-[#161311] px-7 text-xs font-semibold tracking-[0.16em] text-[#F4F1EA] uppercase whitespace-nowrap shrink-0 transition-colors duration-150 hover:bg-[#7A1C1D]"
              >
                {config.primaryCta.label}
              </a>

              <a
                href={config.secondaryCta.href}
                onClick={(e) => {
                  e.preventDefault();
                  navigateTo(config.secondaryCta.href);
                }}
                className="inline-flex h-12 items-center px-2 text-xs font-semibold tracking-[0.16em] text-[#161311] uppercase underline decoration-[#161311] underline-offset-8 whitespace-nowrap shrink-0 transition-colors duration-150 hover:text-[#7A1C1D] hover:decoration-[#7A1C1D]"
              >
                {config.secondaryCta.label}
              </a>
            </div>
          </div>

          {/* Center/Right Lookbook Portrait */}
          <div className="z-10 mx-auto w-full max-w-md lg:col-span-4">
            <div className="border border-[#161311]/20 bg-[#FAF8F5] shadow-sm">
              <StudioImage asset={config.heroImage} priority={true} showDemoBadge={true} />
            </div>
          </div>

          {/* Right Editorial Callout */}
          <div className="z-10 flex flex-col justify-end space-y-4 border-t border-[#D6CFC2] pt-4 lg:col-span-3 lg:border-t-0 lg:border-l lg:pl-6 lg:pt-0">
            <p className="text-xs font-semibold tracking-[0.2em] text-[#161311] uppercase">
              SANGANER ATELIER
            </p>
            <p className="text-xs leading-relaxed text-[#524B44]">
              Crafted in breathable mulmul cotton, Chanderi silk, and tissue organza. Free standard
              shipping across India with 48-hour dispatch.
            </p>
            <div className="h-0.5 w-8 bg-[#161311]" aria-hidden="true" />
          </div>
        </div>
      </div>
    </section>
  );
}
