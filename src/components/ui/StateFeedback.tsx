/**
 * Reusable Skeleton, EmptyState, NotFoundState, and RecoverableErrorState components.
 */

import React from 'react';
import { AlertCircle, RefreshCw, SearchX, ShoppingBag } from 'lucide-react';

export function ProductGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4"
      aria-busy="true"
      aria-label="Loading products"
    >
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="flex flex-col border border-[#D6CFC2] bg-[#FAF8F5]">
          <div className="aspect-[3/4] w-full animate-pulse bg-[#EAE4D8]" />
          <div className="space-y-2 p-4">
            <div className="h-3 w-24 animate-pulse bg-[#EAE4D8]" />
            <div className="h-4 w-3/4 animate-pulse bg-[#EAE4D8]" />
            <div className="h-4 w-1/3 animate-pulse bg-[#EAE4D8]" />
          </div>
        </div>
      ))}
    </div>
  );
}

interface RecoverableErrorBannerProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export function RecoverableErrorBanner({
  title = 'Service Notice',
  message,
  onRetry,
  retryLabel = 'Try Again',
}: RecoverableErrorBannerProps) {
  return (
    <div
      role="alert"
      className="flex flex-col justify-between gap-4 border border-[#E5B4B5] bg-[#FDECEC] p-5 text-[#961B1E] sm:flex-row sm:items-center"
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-[#7A1C1D]">{message}</p>
        </div>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 border border-[#961B1E] bg-[#FAF8F5] px-4 text-xs font-semibold text-[#961B1E] transition-colors duration-150 hover:bg-[#961B1E] hover:text-[#FAF8F5]"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>{retryLabel}</span>
        </button>
      )}
    </div>
  );
}

interface EmptyStatePanelProps {
  icon?: 'search' | 'bag';
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyStatePanel({
  icon = 'search',
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStatePanelProps) {
  return (
    <div className="flex flex-col items-center justify-center border border-[#D6CFC2] bg-[#FAF8F5] px-6 py-14 text-center">
      {icon === 'bag' ? (
        <ShoppingBag className="h-9 w-9 text-[#524B44]" aria-hidden="true" />
      ) : (
        <SearchX className="h-9 w-9 text-[#524B44]" aria-hidden="true" />
      )}
      <h3 className="mt-4 font-editorial text-2xl font-semibold text-[#161311]">{title}</h3>
      <p className="mt-1.5 max-w-md text-sm text-[#524B44]">{description}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-6 inline-flex h-11 items-center justify-center bg-[#161311] px-6 text-xs font-semibold tracking-wider text-[#F4F1EA] uppercase transition-colors duration-150 hover:bg-[#7A1C1D]"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
