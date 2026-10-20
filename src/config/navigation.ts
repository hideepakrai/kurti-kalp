/**
 * Navigation Configuration for GAYRAA Storefront.
 * Separates merchandising collections (New Arrivals, Best Sellers),
 * product categories (All Collections), and occasion queries (Shop by Occasion).
 */

import { Navigation } from '../domain/content';

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
      id: 'footer-occasions',
      title: 'Shop by Occasion',
      links: [
        { label: 'Wedding Guest Edit', href: '/collections/wedding' },
        { label: 'Festive Celebrations', href: '/collections/festive' },
        { label: 'Everyday Casual', href: '/collections/casual' },
        { label: 'Office & Workwear', href: '/collections/office' },
        { label: 'Vacation & Resort', href: '/collections/vacation' },
      ],
    },
    {
      id: 'footer-policies',
      title: 'Customer Policies',
      links: [
        { label: 'Shipping & 48h Dispatch Policy', policyId: 'shipping' },
        { label: 'Limited 3-Day Exchange Policy', policyId: 'exchange' },
        { label: 'Privacy & Data Boundaries', policyId: 'privacy' },
        { label: 'Terms of Service & Demo Info', policyId: 'terms' },
      ],
    },
  ],
};
