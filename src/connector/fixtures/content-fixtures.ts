/**
 * Homepage PageManifest Fixture (Stage A Prototype).
 * Renders the 8 ordered typed sections required by the specification:
 *  1. Announcement bar and navigation (rendered in App Shell from config)
 *  2. Editorial hero (configurable 'layered-typographic' or 'split-editorial')
 *  3. Three-category spotlight band (dark contrast strip)
 *  4. New Arrivals product section (resolved from catalog query)
 *  5. Seasonal/occasion campaign
 *  6. Best Sellers product section (resolved from catalog query)
 *  7. Accurate service and policy information
 *  8. Footer (rendered in App Shell from config)
 */

import { PageManifest } from '../../domain/content';

export const DEMO_HOMEPAGE_MANIFEST: PageManifest = {
  schemaVersion: '1.0',
  pageId: 'home-gayraa-stage-a',
  title: 'GAYRAA — Jaipur Ethnic & Fusion Storefront',
  isDemoManifest: true,
  sections: [
    {
      id: 'sec-hero',
      type: 'hero',
      enabled: true,
      variant: 'layered-typographic',
      kicker: 'CONSCIOUS FASHION THAT MOVES WITH GRACE',
      headline: 'Jaipur Heritage, Tailored for Contemporary Living',
      decorativeDisplayWord: 'GAYRAA',
      subheadline:
        'Handblock mulmul Anarkalis, festive Chanderi silk kurta sets, and architectural co-ords crafted at our Sanganer studio.',
      seasonTag: 'JAIPUR EDIT · DEMO FIXTURE',
      primaryCta: {
        label: 'Shop All Collections',
        href: '/collections/all',
      },
      secondaryCta: {
        label: 'Explore New Arrivals',
        href: '/collections/new-arrivals',
      },
      heroImage: {
        id: 'media-hero-anarkali',
        url: '/assets/demo/lookbook-anarkali-maroon.svg',
        alt: 'Demo illustration of a model in a Sindoor maroon Jaipur handblock Anarkali set with sheer organza dupatta',
        width: 900,
        height: 1200,
        aspectRatio: '3:4',
        isDemoFixture: true,
      },
    },
    {
      id: 'sec-category-spotlight',
      type: 'category-spotlight',
      enabled: true,
      sectionLabel: 'Signature Silo Collections',
      items: [
        {
          id: 'spot-anarkali',
          title: 'ANARKALI SUIT SETS',
          subtitle: 'Flared kalidar silhouettes with Kota Doria & organza dupattas.',
          ctaLabel: 'SHOP ANARKALIS',
          href: '/collections/anarkali-suit-sets',
          image: {
            id: 'spot-img-1',
            url: '/assets/demo/lookbook-anarkali-maroon.svg',
            alt: 'Anarkali Suit Sets collection thumbnail',
            width: 900,
            height: 1200,
            aspectRatio: '3:4',
            isDemoFixture: true,
          },
        },
        {
          id: 'spot-kurta',
          title: 'KURTA SETS',
          subtitle: 'Breathable Jaipur cambric & festive Zari-embroidered Chanderi.',
          ctaLabel: 'SHOP KURTA SETS',
          href: '/collections/kurta-sets',
          image: {
            id: 'spot-img-2',
            url: '/assets/demo/lookbook-kurta-emerald.svg',
            alt: 'Kurta Sets collection thumbnail',
            width: 900,
            height: 1200,
            aspectRatio: '3:4',
            isDemoFixture: true,
          },
        },
        {
          id: 'spot-coords',
          title: 'CO-ORD SETS',
          subtitle: 'Effortless two-piece fusion sets for office, travel & leisure.',
          ctaLabel: 'SHOP CO-ORDS',
          href: '/collections/co-ord-sets',
          image: {
            id: 'spot-img-3',
            url: '/assets/demo/lookbook-coord-terracotta.svg',
            alt: 'Co-ord Sets collection thumbnail',
            width: 900,
            height: 1200,
            aspectRatio: '3:4',
            isDemoFixture: true,
          },
        },
      ],
    },
    {
      id: 'sec-new-arrivals',
      type: 'product-collection',
      enabled: true,
      title: 'NEW ARRIVALS',
      subtitle: 'Freshly block-printed and tailored silhouettes from our Sanganer atelier (Demo Fixtures).',
      collectionSlug: 'new-arrivals',
      limit: 4,
      ctaLabel: 'VIEW ALL NEW ARRIVALS',
      ctaHref: '/collections/new-arrivals',
    },
    {
      id: 'sec-seasonal-campaign',
      type: 'seasonal-campaign',
      enabled: true,
      kicker: 'OCCASION & FESTIVE EDIT',
      headline: 'CELEBRATION & EVERYDAY POISE',
      description:
        'From intimate wedding gatherings in hand-embellished organza to breathable Dabu-printed workwear—discover silhouettes curated by occasion.',
      ctaLabel: 'EXPLORE FESTIVE EDIT',
      ctaHref: '/collections/festive',
      occasionLinks: [
        { label: 'Wedding', href: '/collections/wedding' },
        { label: 'Festive', href: '/collections/festive' },
        { label: 'Casual', href: '/collections/casual' },
        { label: 'Office', href: '/collections/office' },
        { label: 'Vacation', href: '/collections/vacation' },
      ],
      bannerImage: {
        id: 'media-campaign-organza',
        url: '/assets/demo/lookbook-organza-ivory.svg',
        alt: 'Demo illustration of festive ivory and zari organza ensemble',
        width: 900,
        height: 1200,
        aspectRatio: '3:4',
        isDemoFixture: true,
      },
    },
    {
      id: 'sec-best-sellers',
      type: 'product-collection',
      enabled: true,
      title: 'BEST OF GAYRAA',
      subtitle: 'Most-loved ethnic and Indo-western sets resolved live from catalog fixtures.',
      collectionSlug: 'best-sellers',
      limit: 4,
      ctaLabel: 'VIEW ALL BEST SELLERS',
      ctaHref: '/collections/best-sellers',
    },
    {
      id: 'sec-service-policy',
      type: 'service-policy-strip',
      enabled: true,
      items: [
        {
          id: 'pol-shipping',
          iconName: 'truck',
          title: 'FREE STANDARD SHIPPING',
          subtitle: 'Pan-India delivery · Dispatched in 48h from Jaipur (5–7 business days transit)',
          policyId: 'shipping',
        },
        {
          id: 'pol-exchange',
          iconName: 'refresh',
          title: 'LIMITED 3-DAY EXCHANGE',
          subtitle: 'Size or defect issues only with Order ID · Customer-shipped return · No refunds',
          policyId: 'exchange',
        },
        {
          id: 'pol-craft',
          iconName: 'sparkles',
          title: 'JAIPUR ARTISAN CRAFT',
          subtitle: 'Conscious fabrics with detailed garment measurement guides on every piece',
          policyId: 'terms',
        },
        {
          id: 'pol-checkout',
          iconName: 'shield',
          title: 'VERIFIED CHECKOUT FLOW',
          subtitle: 'Server-quoted totals with Prepaid Intent & eligible COD placeholders',
          policyId: 'privacy',
        },
      ],
    },
  ],
};
