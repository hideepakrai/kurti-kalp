/**
 * ProductGallery — Stable 3:4 portrait gallery with keyboard-accessible thumbnail selector.
 */

import React, { useState } from 'react';
import { MediaAsset } from '../../domain/catalog';
import { StudioImage } from '../ui/StudioImage';

export function ProductGallery({ gallery }: { gallery: MediaAsset[] }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const safeIndex = selectedIndex < gallery.length ? selectedIndex : 0;
  const activeAsset = gallery[safeIndex];

  if (!activeAsset) return null;

  return (
    <div className="space-y-3">
      <div className="border border-[#D6CFC2] bg-[#FAF8F5]">
        <StudioImage asset={activeAsset} priority={true} showDemoBadge={true} />
      </div>

      {gallery.length > 1 && (
        <div
          className="grid grid-cols-4 gap-3 sm:grid-cols-5"
          role="tablist"
          aria-label="Product gallery views"
        >
          {gallery.map((asset, index) => {
            const isSelected = index === safeIndex;
            return (
              <button
                key={asset.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                aria-label={`View image ${index + 1}: ${asset.alt}`}
                onClick={() => setSelectedIndex(index)}
                className={`overflow-hidden border transition-colors duration-150 ${
                  isSelected
                    ? 'border-2 border-[#7A1C1D] ring-1 ring-[#7A1C1D]'
                    : 'border-[#D6CFC2] opacity-80 hover:border-[#161311] hover:opacity-100'
                }`}
              >
                <StudioImage asset={asset} priority={false} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
