/**
 * Baseline Storefront Configuration for GAYRAA (Stage A Prototype).
 * Separates observed business attributes from configurable policy summaries.
 * Policy text reflects inspected gayraa.com/pages/shipping-policy and
 * gayraa.com/pages/refund-policy and must be reconfirmed before live publication.
 */

import { StorefrontCapabilities, StorefrontConfig } from '../domain/content';

export const GAYRAA_CAPABILITIES: StorefrontCapabilities = {
  stage: 'STAGE_A_MOCK_PROTOTYPE',
  liveKalpConnected: false,
  searchEnabled: true,
  cartEnabled: true,
  checkoutQuoteEnabled: true,
  customerAccountsEnabled: false,
  wishlistEnabled: false,
  supportedHeroVariants: ['layered-typographic', 'split-editorial'],
};

export const GAYRAA_STOREFRONT_CONFIG: StorefrontConfig = {
  businessName: 'GAYRAA',
  legalEntityName: 'ROHIT SHARMA SHREE NARAYAN MANUFACTURER',
  tagline: 'Conscious fashion that exudes style, ethnicity, comfort and elegance.',
  currency: 'INR',
  minorUnitDigits: 2,
  originCity: 'Jaipur, Rajasthan',
  contact: {
    email: 'gayraabysnm@gmail.com',
    phone: '+91 7300006707',
    hours: '11:00 AM – 6:00 PM IST (Monday – Saturday)',
    address: 'Plot No. 1–2, Jaipur Gate, Sanganer, Jaipur 302029, Rajasthan, India',
  },
  announcementBar: {
    enabled: true,
    message: 'COMPLIMENTARY STANDARD SHIPPING ACROSS INDIA · DISPATCH WITHIN 48 HOURS FROM JAIPUR',
    secondaryMessage: 'STAGE A PROTOTYPE (DEMO DATA)',
  },
  demoModeNotice:
    'Stage A Frontend Prototype — Catalog items, SKUs, prices, stock states, and studio illustrations are labelled demo fixtures. Live Kalp integration pending.',
  policies: {
    shipping: {
      id: 'shipping',
      title: 'Shipping & Dispatch Policy',
      shortSummary:
        'Free standard shipping across India. Orders dispatch within 48 hours; standard transit takes approximately 5–7 working days after dispatch.',
      sourceUrl: 'https://www.gayraa.com/pages/shipping-policy',
      lastInspectedNote:
        'Baseline derived from inspected gayraa.com shipping policy. Reconfirm with merchant before live publication.',
      bulletPoints: [
        'Free Standard Shipping on all orders across India (no minimum order threshold).',
        'Dispatch Estimate: Orders are dispatched from our Sanganer, Jaipur facility within 48 hours of placement.',
        'Transit Estimate: Standard delivery takes approximately 5–7 working days after dispatch, depending on destination PIN code.',
        'Paid Prepaid Express Service (approx. 3 business days): Available upon direct confirmation. Please contact +91 7300006707 or gayraabysnm@gmail.com between 11:00 AM and 6:00 PM IST to confirm serviceability and applicable express charges.',
      ],
      importantNotice:
        'Dispatch and transit timelines are distinct estimates. PIN-code format validation at checkout does not guarantee express courier serviceability.',
    },
    exchange: {
      id: 'exchange',
      title: 'Limited Exchange & Refund Policy',
      shortSummary:
        'No general refunds. Exchanges are accepted strictly for size issues or defective/damaged items within 3 days of delivery with a valid Order ID.',
      sourceUrl: 'https://www.gayraa.com/pages/refund-policy',
      lastInspectedNote:
        'Baseline derived from inspected gayraa.com refund/exchange policy. Reconfirm with merchant before live publication.',
      bulletPoints: [
        'No General Refunds: Monetary refunds are not applicable.',
        'Eligible Exchange Reasons: Accepted only for size fit issues or if a defective/damaged item is delivered.',
        '3-Day Request Window: Exchange requests must be initiated within 3 days of delivery by emailing gayraabysnm@gmail.com or calling +91 7300006707 with your valid Order ID.',
        'Single Exchange Limit: Only one exchange is permitted per product.',
        'Garment Condition: Items must be unused, unwashed, unworn, and returned with all original tags and packaging intact.',
        'Customer-Arranged Return Shipping: Reverse pickup is not available. Customers arrange and pay for return shipping back to our Jaipur facility.',
        'Non-Eligible Cases: Exchanges are not provided for personal material/color preference or minor screen-to-fabric shade variations.',
      ],
      importantNotice:
        'Please review the product-specific garment measurement table and set inclusions carefully before selecting your size.',
    },
    privacy: {
      id: 'privacy',
      title: 'Privacy & Data Boundaries',
      shortSummary:
        'Customer contact and delivery details are used solely to quote shipping and fulfill orders. Stage A prototype stores session data in memory only.',
      sourceUrl: 'https://www.gayraa.com/pages/privacy-policy',
      lastInspectedNote:
        'Stage A prototype boundary summary. Reconfirm legal privacy text before production launch.',
      bulletPoints: [
        'In Stage A demo mode, entered checkout details remain in temporary browser memory and no real customer record is persisted.',
        'In Stage B connected mode, customer records, cart state, and order data are governed by Kalp Business Core tenant isolation.',
        'Raw payment credentials are never collected or stored by the storefront frontend.',
      ],
      importantNotice:
        'Do not enter sensitive personal or real financial data while testing the Stage A prototype.',
    },
    terms: {
      id: 'terms',
      title: 'Terms of Service & Demo Notice',
      shortSummary:
        'Governed by ROHIT SHARMA SHREE NARAYAN MANUFACTURER (Jaipur). This preview operates in Stage A Demo Mode.',
      sourceUrl: 'https://www.gayraa.com/pages/terms-of-service',
      lastInspectedNote:
        'Baseline summary from gayraa.com. Subject to merchant verification before live deployment.',
      bulletPoints: [
        'Legal Entity: ROHIT SHARMA SHREE NARAYAN MANUFACTURER, Plot No. 1–2, Jaipur Gate, Sanganer, Jaipur 302029.',
        'All displayed products, prices, and inventory states in Stage A are labelled demo fixtures for UX and architectural verification.',
        'Submitting checkout in Stage A generates a labelled demo order result and never captures real payment.',
      ],
      importantNotice:
        'Reproducing website policy summaries is for UX completeness and does not constitute legal advice or verified compliance.',
    },
  },
};
