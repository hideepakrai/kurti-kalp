/**
 * Framework-independent Catalog domain contracts.
 * Separates categories, merchandising collections, option definitions, and purchasable variants.
 */

import { Money } from './money';

export type AvailabilityStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';

export interface MediaAsset {
  id: string;
  url: string;
  alt: string;
  width: number;
  height: number;
  aspectRatio: '3:4' | '16:9' | '1:1' | '4:3';
  isDemoFixture?: boolean;
}

export interface ProductOptionDefinition {
  id: string;
  name: string;
  values: string[];
}

export interface ProductVariant {
  id: string;
  sku: string;
  title: string;
  selectedOptions: Record<string, string>;
  price: Money;
  compareAtPrice?: Money;
  availability: AvailabilityStatus;
  unavailableReason?: string;
}

export interface GarmentMeasurementRow {
  size: string;
  bustInches: string;
  waistInches: string;
  hipInches: string;
  garmentLengthInches: string;
}

export interface ProductSpecification {
  fabric: string;
  craftTechnique: string;
  setInclusions: string[];
  washCare: string;
  silhouetteNote: string;
  origin: string;
}

export interface ProductSummary {
  id: string;
  slug: string;
  title: string;
  categorySlug: string;
  categoryName: string;
  occasions: string[];
  isNewArrival: boolean;
  isBestSeller: boolean;
  primaryImage: MediaAsset;
  secondaryImage?: MediaAsset;
  startingPrice: Money;
  compareAtPrice?: Money;
  availableSizes: string[];
  availability: AvailabilityStatus;
  fabricTag: string;
  setSummary: string;
  isDemoFixture: boolean;
}

export interface ProductDetail extends ProductSummary {
  description: string;
  gallery: MediaAsset[];
  optionDefinitions: ProductOptionDefinition[];
  variants: ProductVariant[];
  specifications: ProductSpecification;
  measurements: GarmentMeasurementRow[];
  relatedProductIds: string[];
  relatedProducts?: ProductSummary[];
  demoFixtureNotice: string;
}

export type CollectionKind = 'CATEGORY' | 'MERCHANDISING' | 'OCCASION' | 'ALL';

export interface CollectionMetadata {
  id: string;
  slug: string;
  title: string;
  description: string;
  kind: CollectionKind;
  editorialImage?: MediaAsset;
  isDemoFixture: boolean;
}

export type SortOption = 'FEATURED' | 'NEWEST' | 'PRICE_ASC' | 'PRICE_DESC';

export interface CollectionQuery {
  slug: string;
  sizes?: string[];
  fabrics?: string[];
  maxPriceMinor?: number;
  inStockOnly?: boolean;
  sort?: SortOption;
  page?: number;
  pageSize?: number;
}

export interface SearchQuery {
  q: string;
  sizes?: string[];
  fabrics?: string[];
  maxPriceMinor?: number;
  inStockOnly?: boolean;
  sort?: SortOption;
  page?: number;
  pageSize?: number;
}

export interface ProductQuery {
  slug: string;
}

export interface FacetValue {
  value: string;
  label: string;
  count: number;
}

export interface CollectionFacets {
  sizes: FacetValue[];
  fabrics: FacetValue[];
  priceRanges: Array<{
    maxPriceMinor: number;
    label: string;
    count: number;
  }>;
}

export interface CollectionResult {
  collection: CollectionMetadata;
  products: ProductSummary[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  facets: CollectionFacets;
  appliedQuery: {
    searchText?: string;
    sizes: string[];
    fabrics: string[];
    maxPriceMinor?: number;
    inStockOnly: boolean;
    sort: SortOption;
  };
}
