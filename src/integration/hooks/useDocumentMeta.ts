/**
 * useDocumentMeta — Synchronizes document `<title>`, `<meta name="description">`,
 * OpenGraph tags, `<meta name="robots">`, and JSON-LD structured data on route changes.
 *
 * Enforces:
 * - `noindex, nofollow` in `demo` and `unavailable` modes so search engines never index
 *   demo fixtures or unconfigured environments.
 */

import { useEffect } from 'react';
import { StorefrontRuntimeMode } from '../../domain/content';

export interface DocumentMetaOptions {
  title: string;
  description: string;
  pathname: string;
  mode: StorefrontRuntimeMode;
  jsonLd?: Record<string, unknown> | null;
}

function upsertMetaTag(attrName: 'name' | 'property', attrValue: string, content: string): void {
  if (typeof document === 'undefined') return;
  let el = document.head.querySelector(`meta[${attrName}="${attrValue}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attrName, attrValue);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

export function useDocumentMeta({
  title,
  description,
  pathname,
  mode,
  jsonLd,
}: DocumentMetaOptions): void {
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const fullTitle =
      mode === 'demo'
        ? `${title} [Demo Mode]`
        : mode === 'unavailable'
          ? `${title} [Unavailable]`
          : title;

    document.title = fullTitle;
    upsertMetaTag('name', 'description', description);
    upsertMetaTag('property', 'og:title', fullTitle);
    upsertMetaTag('property', 'og:description', description);

    // Demo and Unavailable modes MUST always emit noindex, nofollow
    const robotsValue = mode === 'connected' ? 'index, follow' : 'noindex, nofollow';
    upsertMetaTag('name', 'robots', robotsValue);

    // Canonical URL
    let canonical = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://www.gayraa.com';
    canonical.setAttribute('href', `${origin}${pathname}`);

    // Structured Data (JSON-LD)
    const scriptId = 'gayraa-jsonld-schema';
    let scriptEl = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (jsonLd) {
      if (!scriptEl) {
        scriptEl = document.createElement('script');
        scriptEl.id = scriptId;
        scriptEl.type = 'application/ld+json';
        document.head.appendChild(scriptEl);
      }
      scriptEl.textContent = JSON.stringify(jsonLd);
    } else if (scriptEl) {
      scriptEl.remove();
    }
  }, [title, description, pathname, mode, jsonLd]);
}
