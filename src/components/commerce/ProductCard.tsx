/**
 * ProductCard — Editorial 3:4 portrait product card.
 * Uses clean unboxed metadata with typographic separators (·), tabular numerals,
 * and subtle image scale/alternate view on hover while keeping dimensions fixed.
 */

import React, { useState } from 'react';
import { ProductSummary } from '../../domain/catalog';
import { formatMoney } from '../../domain/money';
import { navigateTo } from '../../integration/hooks/useRouter';
import { StudioImage } from '../ui/StudioImage';

export function ProductCard({
  product,
  priority = false,
}: {
  product: ProductSummary;
  priority?: boolean;
}) {
  const [isHovered, setIsHovered] = useState(false);

  const activeImage =
    isHovered && product.secondaryImage ? product.secondaryImage : product.primaryImage;

  const href = `/products/${product.slug}`;

  return (
    <article
      className="group flex flex-col border border-[#D6CFC2] bg-[#FAF8F5] transition-colors duration-200 hover:border-[#161311]"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <a
        href={href}
        onClick={(e) => {
          e.preventDefault();
          navigateTo(href);
        }}
        className="block focus-visible:outline-offset-[-2px]"
      >
        <StudioImage
          asset={activeImage}
          priority={priority}
          showDemoBadge={true}
          imageClassName="group-hover:scale-[1.02]"
        />
      </a>

      <div className="flex flex-1 flex-col justify-between p-4">
        <div>
          {/* Unboxed metadata row with typographic separators */}
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[#524B44]">
            <span className="uppercase tracking-wider">{product.categoryName}</span>
            <span aria-hidden="true">·</span>
            <span>{product.fabricTag}</span>
            {product.availability === 'LOW_STOCK' && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-semibold text-[#7C4700]">Few Left</span>
              </>
            )}
          </div>

          <h3 className="mt-1.5 text-sm font-semibold leading-snug text-[#161311]">
            <a
              href={href}
              onClick={(e) => {
                e.preventDefault();
                navigateTo(href);
              }}
              className="transition-colors duration-150 group-hover:text-[#7A1C1D] group-hover:underline group-hover:underline-offset-4"
            >
              {product.title}
            </a>
          </h3>

          <p className="mt-1 line-clamp-1 text-xs text-[#524B44]">{product.setSummary}</p>
        </div>

        <div className="mt-3.5 border-t border-[#EAE4D8] pt-3">
          <div className="flex items-baseline justify-between gap-2">
            <div className="flex items-baseline gap-2 tabular-nums">
              <span className="text-sm font-semibold text-[#161311]">
                {formatMoney(product.startingPrice)}
              </span>
              {product.compareAtPrice &&
                product.compareAtPrice.amountMinor > product.startingPrice.amountMinor && (
                  <span className="text-xs text-[#6B6259] line-through">
                    {formatMoney(product.compareAtPrice)}
                  </span>
                )}
            </div>

            <span className="text-[11px] text-[#524B44]">
              Sizes: {product.availableSizes.join(', ')}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}
