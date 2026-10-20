/**
 * ProductPage Template — Product-detail view (/products/:slug).
 *
 * Enforces:
 * - No arbitrary size auto-selection on load (`selectedOptions` starts empty `{}`).
 * - Resolves a real purchasable `variantId` from `product.variants` matching user selections.
 * - Explains unavailable choices and validates option completeness before Add to Bag.
 * - Shows inline Add to Bag progress, announces success, and opens the global CartDrawer.
 * - Preserves selected options and quantity after a recoverable error.
 * - Displays product-specific garment measurements, exact set inclusions, fabric/care,
 *   and GAYRAA shipping & limited 3-day exchange policy summaries.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Loader2, RefreshCw, Ruler, ShieldAlert, ShoppingBag, Truck } from 'lucide-react';
import { ProductDetail, ProductVariant } from '../domain/catalog';
import { isStorefrontError, StorefrontError } from '../domain/errors';
import { formatMoney } from '../domain/money';
import { useStorefront } from '../integration/StorefrontProvider';
import { navigateTo } from '../integration/hooks/useRouter';
import { ProductGallery } from '../components/commerce/ProductGallery';
import { ProductGrid } from '../components/commerce/ProductGrid';
import { ProductOptionSelector } from '../components/commerce/ProductOptionSelector';
import { SizeGuideModal } from '../components/commerce/SizeGuideModal';
import { Breadcrumbs } from '../components/layout/Breadcrumbs';
import { UnavailableModePanel } from '../components/layout/UnavailableModePanel';
import { QuantityStepper } from '../components/ui/QuantityStepper';
import { EmptyStatePanel, RecoverableErrorBanner } from '../components/ui/StateFeedback';

export function ProductPage({ slug }: { slug: string }) {
  const {
    connector,
    addToCart,
    addingToCart,
    openCartDrawer,
    openPolicyDrawer,
    upstreamUnavailableReason,
  } = useStorefront();

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<StorefrontError | null>(null);

  // Never pre-select an arbitrary size automatically
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState<number>(1);
  const [optionValidationMsg, setOptionValidationMsg] = useState<string | null>(null);
  const [addActionError, setAddActionError] = useState<string | null>(null);
  const [justAddedSuccess, setJustAddedSuccess] = useState<boolean>(false);

  const [isSizeGuideOpen, setIsSizeGuideOpen] = useState<boolean>(false);
  const sizeGuideTriggerRef = useRef<HTMLElement | null>(null);

  const loadProduct = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const detail = await connector.getProduct({ slug });
      setProduct(detail);
      // Reset option selection when switching to a different product
      setSelectedOptions({});
      setQuantity(1);
      setOptionValidationMsg(null);
      setAddActionError(null);
      setJustAddedSuccess(false);
    } catch (err) {
      setError(
        isStorefrontError(err)
          ? err
          : new StorefrontError({
              code: 'NETWORK_FAILURE',
              message: 'Unable to load product details.',
              recoverable: true,
            })
      );
    } finally {
      setLoading(false);
    }
  }, [connector, slug]);

  useEffect(() => {
    void loadProduct();
  }, [loadProduct]);

  const handleSelectOption = (optionName: string, value: string) => {
    if (!product) return;

    setOptionValidationMsg(null);
    setAddActionError(null);
    setJustAddedSuccess(false);

    const nextSelections: Record<string, string> = {
      ...selectedOptions,
      [optionName]: value,
    };

    // Verify if the exact combination exists in product.variants; if not, adapt secondary axis to a valid variant
    const exactMatch = product.variants.find((v) =>
      Object.entries(nextSelections).every(([k, val]) => !val || v.selectedOptions[k] === val)
    );

    if (!exactMatch && Object.keys(nextSelections).length > 1) {
      const fallbackVariant = product.variants.find(
        (v) => v.selectedOptions[optionName] === value && v.availability !== 'OUT_OF_STOCK'
      );
      if (fallbackVariant) {
        setSelectedOptions({ ...fallbackVariant.selectedOptions });
        return;
      }
    }

    setSelectedOptions(nextSelections);
  };

  // Resolve exact purchasable variant only when all required optionDefinitions are selected
  const resolvedVariant: ProductVariant | null = React.useMemo(() => {
    if (!product) return null;
    const allAxesSelected = product.optionDefinitions.every(
      (def) => Boolean(selectedOptions[def.name])
    );
    if (!allAxesSelected) return null;

    return (
      product.variants.find((v) =>
        product.optionDefinitions.every(
          (def) => v.selectedOptions[def.name] === selectedOptions[def.name]
        )
      ) ?? null
    );
  }, [product, selectedOptions]);

  const displayPrice = resolvedVariant ? resolvedVariant.price : product?.startingPrice;
  const displayCompareAt = resolvedVariant
    ? resolvedVariant.compareAtPrice
    : product?.compareAtPrice;

  const maxAllowedQty =
    resolvedVariant?.availability === 'LOW_STOCK' ? 2 : 5;

  const handleAddToBag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;

    setOptionValidationMsg(null);
    setAddActionError(null);
    setJustAddedSuccess(false);

    const missingAxes = product.optionDefinitions
      .filter((def) => !selectedOptions[def.name])
      .map((def) => def.name);

    if (missingAxes.length > 0) {
      setOptionValidationMsg(
        `Please select a valid ${missingAxes.join(' and ')} before adding to bag.`
      );
      return;
    }

    if (!resolvedVariant) {
      setOptionValidationMsg(
        'The selected option combination is not available for this style.'
      );
      return;
    }

    if (resolvedVariant.availability === 'OUT_OF_STOCK') {
      setOptionValidationMsg(
        resolvedVariant.unavailableReason || 'This variant is currently out of stock.'
      );
      return;
    }

    try {
      await addToCart({
        productId: product.id,
        variantId: resolvedVariant.id,
        quantity,
      });
      setJustAddedSuccess(true);
      openCartDrawer();
    } catch (err) {
      const msg = isStorefrontError(err)
        ? err.message
        : 'Unable to add item to bag. Your selection has been preserved—please try again.';
      setAddActionError(msg);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-[1360px] px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
          <div className="aspect-[3/4] w-full animate-pulse border border-[#D6CFC2] bg-[#EAE4D8] lg:col-span-6" />
          <div className="space-y-5 lg:col-span-6">
            <div className="h-4 w-1/3 animate-pulse bg-[#EAE4D8]" />
            <div className="h-10 w-3/4 animate-pulse bg-[#EAE4D8]" />
            <div className="h-6 w-1/4 animate-pulse bg-[#EAE4D8]" />
            <div className="h-32 w-full animate-pulse bg-[#EAE4D8]" />
          </div>
        </div>
      </div>
    );
  }

  if (upstreamUnavailableReason || error?.code === 'UPSTREAM_UNAVAILABLE') {
    return (
      <UnavailableModePanel reason={error?.message || upstreamUnavailableReason || undefined} />
    );
  }

  if (error?.code === 'NOT_FOUND') {
    return (
      <div className="mx-auto max-w-[1360px] px-4 py-12 sm:px-6 lg:px-8">
        <Breadcrumbs
          items={[
            { label: 'Home', href: '/' },
            { label: 'Collections', href: '/collections/all' },
            { label: 'Product Not Found' },
          ]}
        />
        <div className="mt-6">
          <EmptyStatePanel
            title="Product Not Found"
            description={error.message}
            actionLabel="Browse All Collections"
            onAction={() => navigateTo('/collections/all')}
          />
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="mx-auto max-w-[1360px] px-4 py-12 sm:px-6 lg:px-8">
        <RecoverableErrorBanner
          title="Could Not Load Product"
          message={error?.message || 'Unexpected error loading product details.'}
          onRetry={() => void loadProduct()}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1360px] px-4 py-8 sm:px-6 lg:px-8">
      <Breadcrumbs
        items={[
          { label: 'Home', href: '/' },
          { label: product.categoryName, href: `/collections/${product.categorySlug}` },
          { label: product.title },
        ]}
      />

      {/* Primary Two-Column Contiguous PDP Layout */}
      <div className="mt-4 grid grid-cols-1 items-start gap-10 lg:grid-cols-12 lg:gap-12">
        {/* Left: Sticky Portrait Gallery */}
        <div className="lg:sticky lg:top-24 lg:col-span-6">
          <ProductGallery gallery={product.gallery} />
        </div>

        {/* Right: Contiguous Purchase & Specification Module */}
        <div className="space-y-6 border border-[#D6CFC2] bg-[#FAF8F5] p-6 sm:p-8 lg:col-span-6">
          {/* Unboxed Metadata Kicker */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#524B44]">
            <span className="font-semibold tracking-wider text-[#7A1C1D] uppercase">
              {product.categoryName}
            </span>
            <span aria-hidden="true">·</span>
            <span>{product.fabricTag}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono text-[11px]">
              {resolvedVariant ? `SKU: ${resolvedVariant.sku}` : 'Select size for SKU'}
            </span>
          </div>

          <div>
            <h1 className="font-editorial text-3xl font-semibold leading-tight text-[#161311] sm:text-4xl">
              {product.title}
            </h1>
            <p className="mt-1.5 text-xs font-semibold text-[#524B44]">{product.setSummary}</p>
          </div>

          {/* Dynamic Price & Availability */}
          <div className="border-y border-[#EAE4D8] py-4">
            <div className="flex flex-wrap items-baseline justify-between gap-4">
              <div className="flex items-baseline gap-3 tabular-nums">
                {displayPrice && (
                  <span className="text-2xl font-semibold text-[#161311]">
                    {formatMoney(displayPrice)}
                  </span>
                )}
                {displayCompareAt &&
                  displayPrice &&
                  displayCompareAt.amountMinor > displayPrice.amountMinor && (
                    <span className="text-sm text-[#6B6259] line-through">
                      MRP {formatMoney(displayCompareAt)}
                    </span>
                  )}
              </div>

              <div className="text-xs font-semibold">
                {resolvedVariant ? (
                  resolvedVariant.availability === 'IN_STOCK' ? (
                    <span className="text-[#165B38]">In Stock · Ready for 48h Jaipur Dispatch</span>
                  ) : resolvedVariant.availability === 'LOW_STOCK' ? (
                    <span className="text-[#7C4700]">Low Stock · Max 2 units per order</span>
                  ) : (
                    <span className="text-[#961B1E]">Out of Stock</span>
                  )
                ) : (
                  <span className="text-[#524B44]">Select your size to check live availability</span>
                )}
              </div>
            </div>
            <p className="mt-1 text-[11px] text-[#6B6259]">
              Inclusive of all taxes · Free standard shipping across India
            </p>
          </div>

          {/* Purchase Form: Product-Specific Options, Quantity & Add to Bag */}
          <form onSubmit={handleAddToBag} className="space-y-6">
            <ProductOptionSelector
              optionDefinitions={product.optionDefinitions}
              variants={product.variants}
              selectedOptions={selectedOptions}
              onSelectOption={handleSelectOption}
              onOpenSizeGuide={(triggerEl) => {
                sizeGuideTriggerRef.current = triggerEl;
                setIsSizeGuideOpen(true);
              }}
              validationMessage={optionValidationMsg}
            />

            {addActionError && (
              <RecoverableErrorBanner
                title="Could Not Add to Bag"
                message={addActionError}
                onRetry={() => setAddActionError(null)}
                retryLabel="Dismiss"
              />
            )}

            {justAddedSuccess && (
              <div
                role="status"
                className="flex items-center gap-2 border border-[#B5DBC6] bg-[#EBF5EF] px-4 py-3 text-xs font-semibold text-[#165B38]"
              >
                <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Added {resolvedVariant?.title} to your shopping bag.</span>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-4 pt-1">
              <div>
                <span className="mb-1.5 block text-[11px] font-semibold tracking-wider text-[#524B44] uppercase">
                  Quantity
                </span>
                <QuantityStepper
                  quantity={quantity}
                  maxQuantity={maxAllowedQty}
                  minQuantity={1}
                  disabled={addingToCart}
                  onChange={(next) => setQuantity(next)}
                  label="Purchase quantity"
                />
              </div>

              <div className="flex-1 pt-5">
                <button
                  type="submit"
                  disabled={addingToCart}
                  aria-busy={addingToCart}
                  className="inline-flex h-12 w-full items-center justify-center gap-2.5 bg-[#161311] px-6 text-xs font-semibold tracking-[0.16em] text-[#F4F1EA] uppercase transition-colors duration-150 hover:bg-[#7A1C1D] disabled:opacity-60"
                >
                  {addingToCart ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      <span>Adding to Bag...</span>
                    </>
                  ) : (
                    <>
                      <ShoppingBag className="h-4 w-4" aria-hidden="true" />
                      <span>
                        {resolvedVariant
                          ? `Add to Bag — ${formatMoney(resolvedVariant.price)}`
                          : 'Select Size to Add to Bag'}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>

          {/* Editorial Description */}
          <div className="space-y-3 border-t border-[#D6CFC2] pt-5 text-sm leading-relaxed text-[#524B44]">
            <h2 className="text-xs font-semibold tracking-wider text-[#161311] uppercase">
              Craft &amp; Silhouette Notes
            </h2>
            <p>{product.description}</p>
            <p className="text-xs text-[#6B6259]">{product.demoFixtureNotice}</p>
          </div>

          {/* Exact Set Inclusions & Fabric Specifications */}
          <div className="space-y-4 border-t border-[#D6CFC2] pt-5 text-xs">
            <div>
              <h2 className="font-semibold tracking-wider text-[#161311] uppercase">
                Exact Set Inclusions ({product.specifications.setInclusions.length} Pieces)
              </h2>
              <ul className="mt-2 space-y-1.5 text-[#524B44]">
                {product.specifications.setInclusions.map((inc, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 bg-[#7A1C1D]" aria-hidden="true" />
                    <span>{inc}</span>
                  </li>
                ))}
              </ul>
            </div>

            <dl className="grid grid-cols-1 gap-3 border-t border-[#EAE4D8] pt-4 sm:grid-cols-2">
              <div>
                <dt className="font-semibold text-[#161311]">Fabric Composition</dt>
                <dd className="mt-0.5 text-[#524B44]">{product.specifications.fabric}</dd>
              </div>
              <div>
                <dt className="font-semibold text-[#161311]">Artisan Technique</dt>
                <dd className="mt-0.5 text-[#524B44]">{product.specifications.craftTechnique}</dd>
              </div>
              <div>
                <dt className="font-semibold text-[#161311]">Wash &amp; Garment Care</dt>
                <dd className="mt-0.5 text-[#524B44]">{product.specifications.washCare}</dd>
              </div>
              <div>
                <dt className="font-semibold text-[#161311]">Origin</dt>
                <dd className="mt-0.5 text-[#524B44]">{product.specifications.origin}</dd>
              </div>
            </dl>
          </div>

          {/* Inline Garment Measurements Table */}
          <div className="space-y-3 border-t border-[#D6CFC2] pt-5">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-xs font-semibold tracking-wider text-[#161311] uppercase">
                <Ruler className="h-4 w-4 text-[#7A1C1D]" aria-hidden="true" />
                <span>Product-Specific Garment Measurements (Inches)</span>
              </h2>
            </div>

            <div className="overflow-x-auto border border-[#D6CFC2]">
              <table className="w-full border-collapse text-left text-xs tabular-nums">
                <thead>
                  <tr className="border-b border-[#D6CFC2] bg-[#EAE4D8] text-[11px] font-semibold uppercase text-[#161311]">
                    <th className="px-3 py-2">Size</th>
                    <th className="px-3 py-2">Bust</th>
                    <th className="px-3 py-2">Waist</th>
                    <th className="px-3 py-2">Hip</th>
                    <th className="px-3 py-2">Length</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAE4D8] bg-[#FAF8F5]">
                  {product.measurements.map((m) => (
                    <tr
                      key={m.size}
                      className={
                        selectedOptions.Size === m.size ? 'bg-[#EAE4D8]/60 font-semibold' : ''
                      }
                    >
                      <td className="px-3 py-2 text-[#161311]">{m.size}</td>
                      <td className="px-3 py-2 text-[#524B44]">{m.bustInches}</td>
                      <td className="px-3 py-2 text-[#524B44]">{m.waistInches}</td>
                      <td className="px-3 py-2 text-[#524B44]">{m.hipInches}</td>
                      <td className="px-3 py-2 text-[#524B44]">{m.garmentLengthInches}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Accurate GAYRAA Shipping & Limited Exchange Summary */}
          <div className="space-y-3 border-t border-[#D6CFC2] pt-5 text-xs text-[#524B44]">
            <div className="flex items-start gap-3">
              <Truck className="mt-0.5 h-4 w-4 shrink-0 text-[#7A1C1D]" aria-hidden="true" />
              <div>
                <p className="font-semibold text-[#161311]">
                  Free Standard Shipping Across India
                </p>
                <p className="mt-0.5 leading-relaxed">
                  Dispatched within 48 hours from Jaipur. Standard delivery takes approximately 5–7
                  working days after dispatch. Paid prepaid express delivery (3 business days)
                  requires direct confirmation between 11 AM and 6 PM IST.{' '}
                  <button
                    type="button"
                    onClick={(e) => openPolicyDrawer('shipping', e.currentTarget)}
                    className="font-semibold text-[#7A1C1D] underline underline-offset-2"
                  >
                    Shipping policy
                  </button>
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 text-[#7A1C1D]" aria-hidden="true" />
              <div>
                <p className="font-semibold text-[#161311]">
                  Limited 3-Day Size &amp; Defect Exchange Policy
                </p>
                <p className="mt-0.5 leading-relaxed">
                  No general refunds. Exchanges are accepted strictly for size issues or defective
                  items within 3 days of delivery with a valid Order ID (one exchange per product;
                  unused/unwashed with tags; customer-arranged and customer-paid return shipping; no
                  reverse pickup).{' '}
                  <button
                    type="button"
                    onClick={(e) => openPolicyDrawer('exchange', e.currentTarget)}
                    className="font-semibold text-[#7A1C1D] underline underline-offset-2"
                  >
                    Exchange policy
                  </button>
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#6B6259]" aria-hidden="true" />
              <p className="text-[11px] text-[#6B6259]">
                Policy baseline reflects inspected gayraa.com terms and must be reconfirmed with the
                business before live publication.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Related Creations Section */}
      {product.relatedProducts && product.relatedProducts.length > 0 && (
        <section
          aria-labelledby="related-heading"
          className="mt-16 border-t border-[#D6CFC2] pt-12"
        >
          <h2
            id="related-heading"
            className="mb-6 font-editorial text-2xl font-semibold tracking-wider text-[#161311] uppercase sm:text-3xl"
          >
            COMPLEMENTARY JAIPUR SILHOUETTES
          </h2>
          <ProductGrid products={product.relatedProducts} />
        </section>
      )}

      {/* Size Guide Drawer */}
      <SizeGuideModal
        isOpen={isSizeGuideOpen}
        onClose={() => {
          setIsSizeGuideOpen(false);
          if (sizeGuideTriggerRef.current) {
            sizeGuideTriggerRef.current.focus();
          }
        }}
        productTitle={product.title}
        silhouetteNote={product.specifications.silhouetteNote}
        measurements={product.measurements}
      />
    </div>
  );
}
