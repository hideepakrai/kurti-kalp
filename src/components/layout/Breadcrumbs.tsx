/**
 * Breadcrumbs — Semantic breadcrumb trail for Collection, Search, Product, and Checkout pages.
 */

import React from 'react';
import { ChevronRight } from 'lucide-react';
import { navigateTo } from '../../integration/hooks/useRouter';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="py-3 text-xs text-[#524B44]">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1;
          return (
            <li key={`${item.label}-${idx}`} className="inline-flex items-center gap-1.5">
              {idx > 0 && <ChevronRight className="h-3.5 w-3.5 text-[#6B6259]" aria-hidden="true" />}
              {item.href && !isLast ? (
                <a
                  href={item.href}
                  onClick={(e) => {
                    e.preventDefault();
                    navigateTo(item.href!);
                  }}
                  className="transition-colors duration-150 hover:text-[#161311] hover:underline hover:underline-offset-4"
                >
                  {item.label}
                </a>
              ) : (
                <span aria-current={isLast ? 'page' : undefined} className="font-semibold text-[#161311]">
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
