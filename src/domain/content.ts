/**
 * Framework-independent CMS Content, Navigation, Policy, and PageManifest domain contracts.
 */

import { MediaAsset } from './catalog';

export interface StorefrontCapabilities {
  stage: 'STAGE_A_MOCK_PROTOTYPE' | 'STAGE_B_CONNECTED';
  liveKalpConnected: boolean;
  searchEnabled: boolean;
  cartEnabled: boolean;
  checkoutQuoteEnabled: boolean;
  customerAccountsEnabled: boolean;
  wishlistEnabled: boolean;
  supportedHeroVariants: Array<'layered-typographic' | 'split-editorial'>;
}

export interface PolicySummaryItem {
  id: 'shipping' | 'exchange' | 'privacy' | 'terms';
  title: string;
  shortSummary: string;
  sourceUrl: string;
  lastInspectedNote: string;
  bulletPoints: string[];
  importantNotice: string;
}

export interface StorefrontConfig {
  businessName: string;
  legalEntityName: string;
  tagline: string;
  currency: string;
  minorUnitDigits: number;
  originCity: string;
  contact: {
    email: string;
    phone: string;
    hours: string;
    address: string;
  };
  announcementBar: {
    enabled: boolean;
    message: string;
    secondaryMessage: string;
  };
  policies: Record<'shipping' | 'exchange' | 'privacy' | 'terms', PolicySummaryItem>;
  demoModeNotice: string;
}

export interface NavigationLinkItem {
  id: string;
  label: string;
  href: string;
  description?: string;
  badge?: string;
}

export interface NavigationGroup {
  id: string;
  label: string;
  href?: string;
  children?: NavigationLinkItem[];
}

export interface Navigation {
  primary: NavigationGroup[];
  footerColumns: Array<{
    id: string;
    title: string;
    links: Array<{
      label: string;
      href?: string;
      policyId?: 'shipping' | 'exchange' | 'privacy' | 'terms';
    }>;
  }>;
}

export type HeroVariant = 'layered-typographic' | 'split-editorial';

export interface HeroSectionConfig {
  id: string;
  type: 'hero';
  enabled: boolean;
  variant: HeroVariant;
  kicker: string;
  headline: string;
  decorativeDisplayWord: string;
  subheadline: string;
  seasonTag: string;
  primaryCta: { label: string; href: string };
  secondaryCta: { label: string; href: string };
  heroImage: MediaAsset;
}

export interface CategorySpotlightSectionConfig {
  id: string;
  type: 'category-spotlight';
  enabled: boolean;
  sectionLabel: string;
  items: Array<{
    id: string;
    title: string;
    subtitle: string;
    ctaLabel: string;
    href: string;
    image: MediaAsset;
  }>;
}

export interface ProductCollectionSectionConfig {
  id: string;
  type: 'product-collection';
  enabled: boolean;
  title: string;
  subtitle: string;
  collectionSlug: string;
  limit: number;
  ctaLabel: string;
  ctaHref: string;
}

export interface SeasonalCampaignSectionConfig {
  id: string;
  type: 'seasonal-campaign';
  enabled: boolean;
  kicker: string;
  headline: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
  occasionLinks: Array<{ label: string; href: string }>;
  bannerImage: MediaAsset;
}

export interface ServicePolicyStripSectionConfig {
  id: string;
  type: 'service-policy-strip';
  enabled: boolean;
  items: Array<{
    id: string;
    iconName: 'truck' | 'refresh' | 'sparkles' | 'shield';
    title: string;
    subtitle: string;
    policyId?: 'shipping' | 'exchange' | 'privacy' | 'terms';
  }>;
}

export type HomePageSection =
  | HeroSectionConfig
  | CategorySpotlightSectionConfig
  | ProductCollectionSectionConfig
  | SeasonalCampaignSectionConfig
  | ServicePolicyStripSectionConfig;

export interface PageManifest {
  schemaVersion: '1.0';
  pageId: string;
  title: string;
  isDemoManifest: boolean;
  sections: HomePageSection[];
}
