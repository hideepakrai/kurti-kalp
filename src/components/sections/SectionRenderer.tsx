/**
 * SectionRenderer — Versioned registry mapping PageManifest sections to components.
 * Safely ignores disabled or unknown section types so CMS edits never crash the storefront.
 */

import React from 'react';
import { HomePageSection } from '../../domain/content';
import { CampaignBannerSlotSection } from './CampaignBannerSlotSection';
import { CategorySpotlightStrip } from './CategorySpotlightStrip';
import { EditorialStoryBlockSection } from './EditorialStoryBlockSection';
import { HeroSection } from './HeroSection';
import { ProductCollectionSection } from './ProductCollectionSection';
import { SeasonalCampaignSection } from './SeasonalCampaignSection';
import { ServicePolicyStrip } from './ServicePolicyStrip';

export function SectionRenderer({ sections }: { sections: HomePageSection[] }) {
  return (
    <>
      {sections.map((section) => {
        if (!section || !section.enabled) return null;

        switch (section.type) {
          case 'hero':
            return <HeroSection key={section.id} config={section} />;
          case 'category-spotlight':
            return <CategorySpotlightStrip key={section.id} config={section} />;
          case 'product-collection':
            return <ProductCollectionSection key={section.id} config={section} />;
          case 'seasonal-campaign':
            return <SeasonalCampaignSection key={section.id} config={section} />;
          case 'editorial-story-block':
            return <EditorialStoryBlockSection key={section.id} config={section} />;
          case 'campaign-banner-slot':
            return <CampaignBannerSlotSection key={section.id} config={section} />;
          case 'service-policy-strip':
            return <ServicePolicyStrip key={section.id} config={section} />;
          default:
            return null;
        }
      })}
    </>
  );
}
