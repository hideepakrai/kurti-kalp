/**
 * StudioImage — Resilient, aspect-ratio-locked image component.
 * Prioritizes hero images when requested and lazy-loads lower-page assets.
 * Provides an editorial fallback surface if an asset ever fails to load.
 */

import React, { useState } from 'react';
import { MediaAsset } from '../../domain/catalog';

interface StudioImageProps {
  asset: MediaAsset;
  priority?: boolean;
  className?: string;
  imageClassName?: string;
  showDemoBadge?: boolean;
}

export function StudioImage({
  asset,
  priority = false,
  className = '',
  imageClassName = '',
  showDemoBadge = false,
}: StudioImageProps) {
  const [hasError, setHasError] = useState(false);

  const aspectClass =
    asset.aspectRatio === '16:9'
      ? 'aspect-video'
      : asset.aspectRatio === '1:1'
        ? 'aspect-square'
        : asset.aspectRatio === '4:3'
          ? 'aspect-[4/3]'
          : 'aspect-[3/4]';

  return (
    <div
      className={`relative overflow-hidden bg-[#EAE4D8] ${aspectClass} ${className}`}
    >
      {!hasError ? (
        <img
          src={asset.url}
          alt={asset.alt}
          width={asset.width}
          height={asset.height}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          referrerPolicy="no-referrer"
          onError={() => setHasError(true)}
          className={`h-full w-full object-cover transition-transform duration-200 ease-out ${imageClassName}`}
        />
      ) : (
        <div
          className="flex h-full w-full flex-col items-center justify-center border border-[#D6CFC2] bg-[#EAE4D8] p-6 text-center text-[#524B44]"
          role="img"
          aria-label={asset.alt}
        >
          <span className="font-editorial text-xl tracking-wide text-[#161311]">GAYRAA</span>
          <span className="mt-1 text-xs">{asset.alt}</span>
        </div>
      )}
      {showDemoBadge && asset.isDemoFixture && (
        <span className="pointer-events-none absolute bottom-2 left-2 bg-[#161311]/75 px-2 py-0.5 text-[10px] tracking-wider text-[#F4F1EA] uppercase">
          Demo Fixture
        </span>
      )}
    </div>
  );
}
