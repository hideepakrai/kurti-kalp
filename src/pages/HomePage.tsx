/**
 * HomePage Template — Renders the ordered PageManifest sections returned by connector.getHomePage().
 */

import React, { useCallback, useEffect, useState } from 'react';
import { PageManifest } from '../domain/content';
import { isStorefrontError, StorefrontError } from '../domain/errors';
import { useStorefront } from '../integration/StorefrontProvider';
import { SectionRenderer } from '../components/sections/SectionRenderer';
import { ProductGridSkeleton, RecoverableErrorBanner } from '../components/ui/StateFeedback';

export function HomePage() {
  const { connector, heroVariantOverride } = useStorefront();
  const [manifest, setManifest] = useState<PageManifest | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<StorefrontError | null>(null);

  const loadManifest = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await connector.getHomePage();
      setManifest(data);
    } catch (err) {
      setError(
        isStorefrontError(err)
          ? err
          : new StorefrontError({
              code: 'NETWORK_FAILURE',
              message: 'Unable to load homepage manifest.',
              recoverable: true,
            })
      );
    } finally {
      setLoading(false);
    }
  }, [connector, heroVariantOverride]);

  useEffect(() => {
    void loadManifest();
  }, [loadManifest]);

  if (loading && !manifest) {
    return (
      <div className="mx-auto max-w-[1360px] space-y-10 px-4 py-12 sm:px-6 lg:px-8">
        <div className="h-[460px] w-full animate-pulse border border-[#D6CFC2] bg-[#EAE4D8]" />
        <ProductGridSkeleton count={4} />
      </div>
    );
  }

  if (error && !manifest) {
    return (
      <div className="mx-auto max-w-[1360px] px-4 py-12 sm:px-6 lg:px-8">
        <RecoverableErrorBanner
          title="Could Not Load Homepage"
          message={error.message}
          onRetry={() => void loadManifest()}
        />
      </div>
    );
  }

  if (!manifest) return null;

  return <SectionRenderer sections={manifest.sections} />;
}
