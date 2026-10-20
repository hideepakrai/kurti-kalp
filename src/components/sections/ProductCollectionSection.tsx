/**
 * ProductCollectionSection — Homepage product grid section.
 * Resolves live pricing and stock from the catalog connector using the manifest's
 * collectionSlug reference rather than embedding prices inside the CMS manifest.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { ProductSummary } from '../../domain/catalog';
import { ProductCollectionSectionConfig } from '../../domain/content';
import { isStorefrontError, StorefrontError } from '../../domain/errors';
import { useStorefront } from '../../integration/StorefrontProvider';
import { navigateTo } from '../../integration/hooks/useRouter';
import { ProductGrid } from '../commerce/ProductGrid';
import { ProductGridSkeleton, RecoverableErrorBanner } from '../ui/StateFeedback';

export function ProductCollectionSection({
  config,
}: {
  config: ProductCollectionSectionConfig;
}) {
  const { connector } = useStorefront();
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<StorefrontError | null>(null);

  const loadSectionProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await connector.getCollection({
        slug: config.collectionSlug,
        pageSize: config.limit,
        page: 1,
      });
      setProducts(res.products);
    } catch (err) {
      setError(
        isStorefrontError(err)
          ? err
          : new StorefrontError({
              code: 'NETWORK_FAILURE',
              message: `Could not load ${config.title}.`,
              recoverable: true,
            })
      );
    } finally {
      setLoading(false);
    }
  }, [connector, config.collectionSlug, config.limit, config.title]);

  useEffect(() => {
    void loadSectionProducts();
  }, [loadSectionProducts]);

  return (
    <section
      aria-labelledby={`heading-${config.id}`}
      className="border-b border-[#D6CFC2] bg-[#F4F1EA] py-12 sm:py-16"
    >
      <div className="mx-auto max-w-[1360px] px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h2
              id={`heading-${config.id}`}
              className="font-editorial text-2xl font-semibold tracking-wider text-[#161311] uppercase sm:text-3xl"
            >
              {config.title}
            </h2>
            <p className="mt-1 text-xs text-[#524B44] sm:text-sm">{config.subtitle}</p>
          </div>

          <a
            href={config.ctaHref}
            onClick={(e) => {
              e.preventDefault();
              navigateTo(config.ctaHref);
            }}
            className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-[0.16em] text-[#161311] uppercase underline decoration-[#161311] underline-offset-8 whitespace-nowrap shrink-0 transition-colors duration-150 hover:text-[#7A1C1D] hover:decoration-[#7A1C1D]"
          >
            <span>{config.ctaLabel}</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </div>

        {loading ? (
          <ProductGridSkeleton count={config.limit} />
        ) : error ? (
          <RecoverableErrorBanner
            title={`Unable to load ${config.title}`}
            message={error.message}
            onRetry={() => void loadSectionProducts()}
          />
        ) : (
          <ProductGrid products={products} />
        )}
      </div>
    </section>
  );
}
