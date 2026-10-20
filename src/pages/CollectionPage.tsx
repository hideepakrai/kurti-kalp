/**
 * CollectionPage Template — Reused across:
 * - /collections/:slug (Categories, New Arrivals, Best Sellers, Occasion Edits, View All)
 * - /search?q=... (Search results)
 *
 * Enforces:
 * - URL query parameter synchronization for sizes, fabrics, maxPrice, inStock, sort, page, and q
 * - Request sequencing to ignore superseded responses
 * - Accessible mobile filter drawer preserving selection on close
 * - Unknown collection, empty results, loading skeleton, and recoverable error states
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { CollectionMetadata, CollectionResult, SortOption } from '../domain/catalog';
import { isStorefrontError, StorefrontError } from '../domain/errors';
import { useStorefront } from '../integration/StorefrontProvider';
import { navigateTo, useRouter } from '../integration/hooks/useRouter';
import { ProductGrid } from '../components/commerce/ProductGrid';
import { Breadcrumbs } from '../components/layout/Breadcrumbs';
import { Drawer } from '../components/ui/Drawer';
import {
  EmptyStatePanel,
  ProductGridSkeleton,
  RecoverableErrorBanner,
} from '../components/ui/StateFeedback';

interface CollectionPageProps {
  mode: 'collection' | 'search';
  collectionSlug?: string;
}

export function CollectionPage({ mode, collectionSlug = 'all' }: CollectionPageProps) {
  const { connector } = useStorefront();
  const { pathname, searchParams } = useRouter();

  const [allCollections, setAllCollections] = useState<CollectionMetadata[]>([]);
  const [result, setResult] = useState<CollectionResult | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<StorefrontError | null>(null);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState<boolean>(false);

  // Parse active filter state from URL query params
  const searchQueryText = searchParams.get('q') || '';
  const selectedSizes = (searchParams.get('sizes') || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const selectedFabrics = (searchParams.get('fabrics') || '')
    .split(',')
    .map((f) => f.trim())
    .filter(Boolean);
  const maxPriceParam = searchParams.get('maxPrice');
  const maxPriceMinor = maxPriceParam ? Number(maxPriceParam) : undefined;
  const inStockOnly = searchParams.get('inStock') === '1';
  const sort = (searchParams.get('sort') as SortOption) || 'FEATURED';
  const page = Math.max(1, Number(searchParams.get('page') || '1'));

  const requestSeqRef = useRef(0);

  // Load collection metadata pills
  useEffect(() => {
    connector
      .getCollections()
      .then(setAllCollections)
      .catch(() => {});
  }, [connector]);

  const fetchCollectionOrSearch = useCallback(async () => {
    const seq = ++requestSeqRef.current;
    setLoading(true);
    setError(null);

    try {
      const data =
        mode === 'search'
          ? await connector.searchProducts({
              q: searchQueryText,
              sizes: selectedSizes,
              fabrics: selectedFabrics,
              maxPriceMinor,
              inStockOnly,
              sort,
              page,
              pageSize: 6,
            })
          : await connector.getCollection({
              slug: collectionSlug,
              sizes: selectedSizes,
              fabrics: selectedFabrics,
              maxPriceMinor,
              inStockOnly,
              sort,
              page,
              pageSize: 6,
            });

      if (seq === requestSeqRef.current) {
        setResult(data);
      }
    } catch (err) {
      if (seq === requestSeqRef.current) {
        setError(
          isStorefrontError(err)
            ? err
            : new StorefrontError({
                code: 'NETWORK_FAILURE',
                message: 'Could not load catalog results. Please try again.',
                recoverable: true,
              })
        );
      }
    } finally {
      if (seq === requestSeqRef.current) {
        setLoading(false);
      }
    }
  }, [
    connector,
    mode,
    collectionSlug,
    searchQueryText,
    selectedSizes.join(','),
    selectedFabrics.join(','),
    maxPriceMinor,
    inStockOnly,
    sort,
    page,
  ]);

  useEffect(() => {
    void fetchCollectionOrSearch();
  }, [fetchCollectionOrSearch]);

  const updateQueryParams = (updates: {
    sizes?: string[];
    fabrics?: string[];
    maxPriceMinor?: number | null;
    inStockOnly?: boolean;
    sort?: SortOption;
    page?: number;
    q?: string;
  }) => {
    const nextParams = new URLSearchParams(searchParams.toString());

    if (updates.q !== undefined) {
      if (updates.q.trim()) nextParams.set('q', updates.q.trim());
      else nextParams.delete('q');
    }

    if (updates.sizes !== undefined) {
      if (updates.sizes.length > 0) nextParams.set('sizes', updates.sizes.join(','));
      else nextParams.delete('sizes');
    }

    if (updates.fabrics !== undefined) {
      if (updates.fabrics.length > 0) nextParams.set('fabrics', updates.fabrics.join(','));
      else nextParams.delete('fabrics');
    }

    if (updates.maxPriceMinor !== undefined) {
      if (updates.maxPriceMinor) nextParams.set('maxPrice', String(updates.maxPriceMinor));
      else nextParams.delete('maxPrice');
    }

    if (updates.inStockOnly !== undefined) {
      if (updates.inStockOnly) nextParams.set('inStock', '1');
      else nextParams.delete('inStock');
    }

    if (updates.sort !== undefined) {
      if (updates.sort !== 'FEATURED') nextParams.set('sort', updates.sort);
      else nextParams.delete('sort');
    }

    if (updates.page !== undefined) {
      if (updates.page > 1) nextParams.set('page', String(updates.page));
      else nextParams.delete('page');
    } else {
      // Reset to page 1 when filters/sort change
      nextParams.delete('page');
    }

    const qs = nextParams.toString();
    navigateTo(`${pathname}${qs ? `?${qs}` : ''}`, { preserveScroll: true });
  };

  const toggleSize = (size: string) => {
    const next = selectedSizes.includes(size)
      ? selectedSizes.filter((s) => s !== size)
      : [...selectedSizes, size];
    updateQueryParams({ sizes: next });
  };

  const toggleFabric = (fabric: string) => {
    const next = selectedFabrics.includes(fabric)
      ? selectedFabrics.filter((f) => f !== fabric)
      : [...selectedFabrics, fabric];
    updateQueryParams({ fabrics: next });
  };

  const resetAllFilters = () => {
    const nextParams = new URLSearchParams();
    if (mode === 'search' && searchQueryText) {
      nextParams.set('q', searchQueryText);
    }
    const qs = nextParams.toString();
    navigateTo(`${pathname}${qs ? `?${qs}` : ''}`, { preserveScroll: true });
  };

  const activeFilterCount =
    selectedSizes.length +
    selectedFabrics.length +
    (maxPriceMinor ? 1 : 0) +
    (inStockOnly ? 1 : 0);

  // Unknown collection state
  if (error?.code === 'NOT_FOUND') {
    return (
      <div className="mx-auto max-w-[1360px] px-4 py-12 sm:px-6 lg:px-8">
        <Breadcrumbs
          items={[
            { label: 'Home', href: '/' },
            { label: 'Collections', href: '/collections/all' },
            { label: 'Not Found' },
          ]}
        />
        <div className="mt-6">
          <EmptyStatePanel
            title="Collection Not Found"
            description={error.message}
            actionLabel="Explore All Collections"
            onAction={() => navigateTo('/collections/all')}
          />
        </div>
      </div>
    );
  }

  const renderFilterControls = () => {
    const facets = result?.facets;
    if (!facets) return null;

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between border-b border-[#D6CFC2] pb-3">
          <span className="text-xs font-semibold tracking-wider text-[#161311] uppercase">
            Filters {activeFilterCount > 0 ? `(${activeFilterCount})` : ''}
          </span>
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={resetAllFilters}
              className="text-xs font-semibold text-[#7A1C1D] underline underline-offset-4 hover:text-[#161311]"
            >
              Reset All
            </button>
          )}
        </div>

        {/* Size Facet */}
        <div>
          <h3 className="text-xs font-semibold tracking-wider text-[#161311] uppercase">Size</h3>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {facets.sizes.map((s) => {
              const active = selectedSizes.includes(s.value);
              return (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => toggleSize(s.value)}
                  aria-pressed={active}
                  className={`min-h-[38px] border px-3 py-1.5 text-xs font-semibold transition-colors duration-150 ${
                    active
                      ? 'border-[#161311] bg-[#161311] text-[#F4F1EA]'
                      : 'border-[#D6CFC2] bg-[#FAF8F5] text-[#161311] hover:border-[#161311]'
                  }`}
                >
                  {s.label} <span className="opacity-70">({s.count})</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Fabric Facet */}
        <div>
          <h3 className="text-xs font-semibold tracking-wider text-[#161311] uppercase">
            Fabric &amp; Weave
          </h3>
          <div className="mt-2.5 space-y-2">
            {facets.fabrics.map((f) => {
              const checked = selectedFabrics.includes(f.value);
              return (
                <label
                  key={f.value}
                  className="flex cursor-pointer items-center justify-between gap-2 text-xs text-[#161311]"
                >
                  <span className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleFabric(f.value)}
                      className="h-4 w-4 accent-[#7A1C1D]"
                    />
                    <span>{f.label}</span>
                  </span>
                  <span className="text-[#524B44] tabular-nums">({f.count})</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Price Tier Facet */}
        <div>
          <h3 className="text-xs font-semibold tracking-wider text-[#161311] uppercase">
            Price Ceiling
          </h3>
          <div className="mt-2.5 space-y-2">
            {facets.priceRanges.map((tier) => {
              const selected = maxPriceMinor === tier.maxPriceMinor;
              return (
                <button
                  key={tier.maxPriceMinor}
                  type="button"
                  onClick={() =>
                    updateQueryParams({
                      maxPriceMinor: selected ? null : tier.maxPriceMinor,
                    })
                  }
                  aria-pressed={selected}
                  className={`flex w-full items-center justify-between border px-3 py-2 text-xs transition-colors duration-150 ${
                    selected
                      ? 'border-[#161311] bg-[#161311] font-semibold text-[#F4F1EA]'
                      : 'border-[#D6CFC2] bg-[#FAF8F5] text-[#161311] hover:border-[#161311]'
                  }`}
                >
                  <span>{tier.label}</span>
                  <span className="tabular-nums opacity-80">({tier.count})</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Availability Toggle */}
        <div className="border-t border-[#D6CFC2] pt-4">
          <label className="flex cursor-pointer items-center gap-2.5 text-xs font-semibold text-[#161311]">
            <input
              type="checkbox"
              checked={inStockOnly}
              onChange={(e) => updateQueryParams({ inStockOnly: e.target.checked })}
              className="h-4 w-4 accent-[#7A1C1D]"
            />
            <span>In-Stock Styles Only</span>
          </label>
        </div>
      </div>
    );
  };

  const categoryLinks = allCollections.filter((c) => c.kind === 'CATEGORY' || c.kind === 'ALL');
  const occasionLinks = allCollections.filter((c) => c.kind === 'OCCASION');

  return (
    <div className="mx-auto max-w-[1360px] px-4 py-8 sm:px-6 lg:px-8">
      <Breadcrumbs
        items={[
          { label: 'Home', href: '/' },
          { label: 'Collections', href: '/collections/all' },
          { label: result?.collection.title || collectionSlug },
        ]}
      />

      {/* Editorial Collection Header */}
      <header className="mt-3 border-b border-[#D6CFC2] pb-6">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.2em] text-[#7A1C1D] uppercase">
              {mode === 'search'
                ? 'CATALOG SEARCH · DEMO FIXTURES'
                : `${result?.collection.kind || 'COLLECTION'} · DEMO FIXTURES`}
            </p>
            <h1 className="mt-1 font-editorial text-3xl font-semibold tracking-tight text-[#161311] sm:text-4xl">
              {result?.collection.title || 'Loading Collection...'}
            </h1>
          </div>

          {result && (
            <p className="text-xs font-semibold text-[#524B44] tabular-nums">
              Showing {result.products.length} of {result.totalCount} Demo Styles
            </p>
          )}
        </div>

        {result?.collection.description && (
          <p className="mt-2.5 max-w-3xl text-sm leading-relaxed text-[#524B44]">
            {result.collection.description}
          </p>
        )}

        {/* Quick Collection & Occasion Switcher Bar */}
        {categoryLinks.length > 0 && (
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {categoryLinks.map((col) => {
              const isCurrent = mode === 'collection' && collectionSlug === col.slug;
              return (
                <a
                  key={col.id}
                  href={`/collections/${col.slug}`}
                  onClick={(e) => {
                    e.preventDefault();
                    navigateTo(`/collections/${col.slug}`);
                  }}
                  aria-current={isCurrent ? 'page' : undefined}
                  className={`inline-flex h-9 items-center border px-3.5 text-xs font-semibold tracking-wider uppercase whitespace-nowrap shrink-0 transition-colors duration-150 ${
                    isCurrent
                      ? 'border-[#161311] bg-[#161311] text-[#F4F1EA]'
                      : 'border-[#D6CFC2] bg-[#FAF8F5] text-[#161311] hover:border-[#161311]'
                  }`}
                >
                  {col.title}
                </a>
              );
            })}
            {occasionLinks.map((occ) => {
              const isCurrent = mode === 'collection' && collectionSlug === occ.slug;
              return (
                <a
                  key={occ.id}
                  href={`/collections/${occ.slug}`}
                  onClick={(e) => {
                    e.preventDefault();
                    navigateTo(`/collections/${occ.slug}`);
                  }}
                  aria-current={isCurrent ? 'page' : undefined}
                  className={`inline-flex h-9 items-center border px-3 text-xs font-semibold tracking-wider uppercase whitespace-nowrap shrink-0 transition-colors duration-150 ${
                    isCurrent
                      ? 'border-[#7A1C1D] bg-[#7A1C1D] text-[#F4F1EA]'
                      : 'border-[#D6CFC2] bg-[#EAE4D8]/60 text-[#524B44] hover:border-[#161311] hover:text-[#161311]'
                  }`}
                >
                  {occ.title.replace(' Edit', '')}
                </a>
              );
            })}
          </div>
        )}
      </header>

      {/* Toolbar: Mobile Filter Trigger, Active Filter Chips & Sort Control */}
      <div className="my-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsMobileFilterOpen(true)}
            className="inline-flex h-10 items-center gap-2 border border-[#161311] bg-[#FAF8F5] px-4 text-xs font-semibold tracking-wider text-[#161311] uppercase lg:hidden"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Filters {activeFilterCount > 0 ? `(${activeFilterCount})` : ''}</span>
          </button>

          {/* Active filter indicators */}
          {selectedSizes.map((s) => (
            <button
              key={`chip-size-${s}`}
              type="button"
              onClick={() => toggleSize(s)}
              className="inline-flex h-8 items-center gap-1.5 border border-[#D6CFC2] bg-[#FAF8F5] px-2.5 text-xs text-[#161311] hover:border-[#161311]"
            >
              <span>Size: {s}</span>
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          ))}
          {selectedFabrics.map((f) => (
            <button
              key={`chip-fabric-${f}`}
              type="button"
              onClick={() => toggleFabric(f)}
              className="inline-flex h-8 items-center gap-1.5 border border-[#D6CFC2] bg-[#FAF8F5] px-2.5 text-xs text-[#161311] hover:border-[#161311]"
            >
              <span>Fabric: {f}</span>
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2.5">
          <label
            htmlFor="collection-sort-select"
            className="text-xs font-semibold tracking-wider text-[#524B44] uppercase"
          >
            Sort by:
          </label>
          <select
            id="collection-sort-select"
            value={sort}
            onChange={(e) => updateQueryParams({ sort: e.target.value as SortOption })}
            className="h-10 border border-[#D6CFC2] bg-[#FAF8F5] px-3 text-xs font-semibold text-[#161311]"
          >
            <option value="FEATURED">Featured</option>
            <option value="NEWEST">New Arrivals First</option>
            <option value="PRICE_ASC">Price: Low to High</option>
            <option value="PRICE_DESC">Price: High to Low</option>
          </select>
        </div>
      </div>

      {/* Main Content Split: Desktop Filter Sidebar + Product Grid */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <aside aria-label="Catalog filters" className="hidden lg:col-span-3 lg:block">
          <div className="sticky top-24 border border-[#D6CFC2] bg-[#FAF8F5] p-5">
            {renderFilterControls()}
          </div>
        </aside>

        <div className="lg:col-span-9">
          {error ? (
            <RecoverableErrorBanner
              title="Catalog Query Failed"
              message={error.message}
              onRetry={() => void fetchCollectionOrSearch()}
            />
          ) : loading ? (
            <ProductGridSkeleton count={6} />
          ) : !result || result.products.length === 0 ? (
            <EmptyStatePanel
              title="No Matching Silhouettes Found"
              description="No demo products matched all of your active filter or search criteria. Reset filters to view the full collection."
              actionLabel="Reset All Filters"
              onAction={resetAllFilters}
            />
          ) : (
            <>
              <ProductGrid products={result.products} prioritizeFirstRow={true} />

              {/* Pagination Controls */}
              {result.totalPages > 1 && (
                <nav
                  aria-label="Collection pagination"
                  className="mt-10 flex items-center justify-between border-t border-[#D6CFC2] pt-6"
                >
                  <button
                    type="button"
                    disabled={result.page <= 1}
                    onClick={() => updateQueryParams({ page: result.page - 1 })}
                    className="inline-flex h-10 items-center border border-[#D6CFC2] bg-[#FAF8F5] px-4 text-xs font-semibold tracking-wider text-[#161311] uppercase disabled:opacity-40"
                  >
                    Previous Page
                  </button>

                  <span className="text-xs font-semibold text-[#524B44] tabular-nums">
                    Page {result.page} of {result.totalPages}
                  </span>

                  <button
                    type="button"
                    disabled={result.page >= result.totalPages}
                    onClick={() => updateQueryParams({ page: result.page + 1 })}
                    className="inline-flex h-10 items-center border border-[#D6CFC2] bg-[#FAF8F5] px-4 text-xs font-semibold tracking-wider text-[#161311] uppercase disabled:opacity-40"
                  >
                    Next Page
                  </button>
                </nav>
              )}
            </>
          )}
        </div>
      </div>

      {/* Mobile Accessible Filter Drawer */}
      <Drawer
        isOpen={isMobileFilterOpen}
        onClose={() => setIsMobileFilterOpen(false)}
        title={`Filter Styles ${activeFilterCount > 0 ? `(${activeFilterCount})` : ''}`}
        subtitle="Selections are preserved in the URL"
        side="left"
        footer={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={resetAllFilters}
              className="h-11 flex-1 border border-[#D6CFC2] bg-[#FAF8F5] text-xs font-semibold tracking-wider text-[#161311] uppercase"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={() => setIsMobileFilterOpen(false)}
              className="h-11 flex-1 bg-[#161311] text-xs font-semibold tracking-wider text-[#F4F1EA] uppercase"
            >
              Apply ({result?.totalCount ?? 0} Styles)
            </button>
          </div>
        }
      >
        {renderFilterControls()}
      </Drawer>
    </div>
  );
}
