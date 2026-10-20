/**
 * Navigation Configuration for GAYRAA Storefront.
 * Includes primary catalog/occasion navigation and footer links to lean customer-facing route shells.
 */

import type { Navigation } from '../domain/content';

export const GAYRAA_NAVIGATION: Navigation = {
  primary: [
    {
      id: 'nav-new-arrivals',
      label: 'New Arrivals',
      href: '/collections/new-arrivals',
    },
    {
      id: 'nav-best-sellers',
      label: 'Best Sellers',
      href: '/collections/best-sellers',
    },
    {
      id: 'nav-all-collections',
      label: 'All Collections',
      href: '/collections/all',
      children: [
        {
          id: 'col-all',
          label: 'View All Collections',
          href: '/collections/all',
          description: 'Complete Jaipur ethnic & fusion catalog',
        },
        {
          id: 'col-anarkali',
          label: 'Anarkali Suit Sets',
          href: '/collections/anarkali-suit-sets',
          description: 'Flared mulmul, organza & handblock sets',
        },
        {
          id: 'col-kurta',
          label: 'Kurta Sets',
          href: '/collections/kurta-sets',
          description: 'Straight & A-line sets with tailored pants',
        },
        {
          id: 'col-coords',
          label: 'Co-ord Sets',
          href: '/collections/co-ord-sets',
          description: 'Contemporary two-piece ethnic-fusion sets',
        },
        {
          id: 'col-indowestern',
          label: 'Indo-Western',
          href: '/collections/indo-western',
          description: 'Draped tunics, silhouettes & festive fusion',
        },
        {
          id: 'col-sarees',
          label: 'Sarees',
          href: '/collections/sarees',
          description: 'Lightweight organza, tissue & block-printed drapes',
        },
        {
          id: 'col-dresses',
          label: 'Dresses',
          href: '/collections/dresses',
          description: 'Breezy Jaipur cotton & tiered ethnic midi dresses',
        },
      ],
    },
    {
      id: 'nav-occasions',
      label: 'Shop by Occasion',
      href: '/collections/festive',
      children: [
        {
          id: 'occ-wedding',
          label: 'Wedding',
          href: '/collections/wedding',
          description: 'Zari-embellished Chanderi & heirloom organza',
        },
        {
          id: 'occ-festive',
          label: 'Festive',
          href: '/collections/festive',
          description: 'Celebratory Sindoor maroon, Bandhani & gold edits',
        },
        {
          id: 'occ-casual',
          label: 'Casual',
          href: '/collections/casual',
          description: 'Breathable everyday cambric & mulmul cottons',
        },
        {
          id: 'occ-office',
          label: 'Office',
          href: '/collections/office',
          description: 'Structured straight kurtas & tailored co-ords',
        },
        {
          id: 'occ-vacation',
          label: 'Vacation',
          href: '/collections/vacation',
          description: 'Relaxed Dabu prints, kaftans & resort co-ords',
        },
      ],
    },
  ],
  footerColumns: [
    {
      id: 'footer-collections',
      title: 'Collections',
      links: [
        { label: 'New Arrivals', href: '/collections/new-arrivals' },
        { label: 'Best Sellers', href: '/collections/best-sellers' },
        { label: 'Anarkali Suit Sets', href: '/collections/anarkali-suit-sets' },
        { label: 'Kurta Sets', href: '/collections/kurta-sets' },
        { label: 'Co-ord Sets', href: '/collections/co-ord-sets' },
        { label: 'Indo-Western', href: '/collections/indo-western' },
        { label: 'Sarees & Dresses', href: '/collections/sarees' },
      ],
    },
    {
      id: 'footer-care-support',
      title: 'Client Care & Assistance',
      links: [
        { label: 'Order Status Lookup', href: '/order-lookup', requiresCapability: 'orderLookupEnabled' },
        { label: '3-Day Exchange Request', href: '/exchange/request', requiresCapability: 'selfServeExchangeEnabled' },
        { label: 'Atelier Support & Contact', href: '/support' },
        { label: 'Frequently Asked Questions', href: '/faq' },
        { label: 'Customer Account Orders', href: '/account/orders', requiresCapability: 'customerAccountsEnabled' },
        { label: 'Address Book', href: '/account/addresses', requiresCapability: 'customerAddressesEnabled' },
        { label: 'Saved Styles', href: '/saved', requiresCapability: 'wishlistEnabled' },
      ],
    },
    {
      id: 'footer-policies',
      title: 'Policies & Legal',
      links: [
        { label: 'Shipping & 48h Dispatch Policy', policyId: 'shipping' },
        { label: 'Limited 3-Day Exchange Policy', policyId: 'exchange' },
        { label: 'Privacy & Data Boundaries', policyId: 'privacy' },
        { label: 'Terms of Service & Mode Info', policyId: 'terms' },
      ],
    },
  ],
};
