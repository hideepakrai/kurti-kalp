/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, useEffect, useMemo, useRef } from 'react';
import { CartDrawer } from './components/commerce/CartDrawer';
import { AnnouncementBar } from './components/layout/AnnouncementBar';
import { DevDiagnosticsBar } from './components/layout/DevDiagnosticsBar';
import { ErrorBoundary } from './components/layout/ErrorBoundary';
import { Footer } from './components/layout/Footer';
import { Header } from './components/layout/Header';
import { PolicyDrawer } from './components/layout/PolicyDrawer';
import {
  EmptyStatePanel,
  ProductGridSkeleton,
  RecoverableErrorBanner,
} from './components/ui/StateFeedback';
import { StorefrontProvider, useStorefront } from './integration/StorefrontProvider';
import { useDocumentMeta } from './integration/hooks/useDocumentMeta';
import { navigateTo, useRouter } from './integration/hooks/useRouter';

const HomePage = React.lazy(() =>
  import('./pages/HomePage').then((m) => ({ default: m.HomePage }))
);
const CollectionPage = React.lazy(() =>
  import('./pages/CollectionPage').then((m) => ({ default: m.CollectionPage }))
);
const ProductPage = React.lazy(() =>
  import('./pages/ProductPage').then((m) => ({ default: m.ProductPage }))
);
const CheckoutPage = React.lazy(() =>
  import('./pages/CheckoutPage').then((m) => ({ default: m.CheckoutPage }))
);
const CustomerRouteShells = React.lazy(() =>
  import('./pages/CustomerRouteShells').then((m) => ({
    default: function CustomerRouteDispatcher({
      routeType,
      orderId,
    }: {
      routeType: 'order-lookup' | 'account-orders' | 'support' | 'faq' | 'exchange' | 'saved';
      orderId?: string;
    }) {
      switch (routeType) {
        case 'order-lookup':
          return <m.OrderLookupRouteShell />;
        case 'account-orders':
          return <m.AccountOrdersRouteShell orderId={orderId} />;
        case 'support':
          return <m.SupportRouteShell />;
        case 'faq':
          return <m.FaqRouteShell />;
        case 'exchange':
          return <m.ExchangeRequestRouteShell />;
        case 'saved':
          return <m.SavedStylesRouteShell />;
      }
    },
  }))
);

function resolveRouteSeo(pathname: string, searchParams: URLSearchParams): {
  title: string;
  description: string;
} {
  if (pathname === '/' || pathname === '/cart') {
    return {
      title: 'GAYRAA — Jaipur Ethnic & Fusion Storefront',
      description:
        'Conscious Jaipur ethnic and fusion fashion: Anarkali suit sets, Chanderi kurta sets, co-ord sets, sarees, and festive Indo-western silhouettes with free pan-India standard shipping.',
    };
  }
  if (pathname === '/search') {
    const q = searchParams.get('q') || '';
    return {
      title: q ? `Search "${q}" — GAYRAA Jaipur` : 'Search Catalog — GAYRAA Jaipur',
      description: 'Search GAYRAA ethnic and fusion collections by silhouette, fabric, size, and occasion.',
    };
  }
  if (pathname.startsWith('/collections')) {
    const slug = decodeURIComponent(pathname.replace('/collections/', '').replace('/collections', '') || 'all');
    const formatted = slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    return {
      title: `${formatted} Collection — GAYRAA Jaipur`,
      description: `Explore GAYRAA ${formatted} crafted in Sanganer, Jaipur. Filter by size, weave, and price with free standard pan-India shipping.`,
    };
  }
  if (pathname.startsWith('/products/')) {
    const slug = decodeURIComponent(pathname.replace('/products/', '').split('/')[0] || '');
    const formatted = slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    return {
      title: `${formatted} — GAYRAA Jaipur`,
      description: `View garment measurements, set inclusions, fabric specifications, and live size availability for ${formatted}.`,
    };
  }
  if (pathname === '/checkout') {
    return {
      title: 'Checkout & Delivery Quote — GAYRAA',
      description: 'Review your GAYRAA shopping bag, pan-India delivery quote, and payment method options.',
    };
  }
  if (pathname === '/order-lookup') {
    return {
      title: 'Order Status Lookup — GAYRAA',
      description: 'Look up your GAYRAA order reference and payment status.',
    };
  }
  if (pathname.startsWith('/account/orders')) {
    return {
      title: 'Customer Account Orders — GAYRAA',
      description: 'GAYRAA customer account order history and guest lookup assistance.',
    };
  }
  if (pathname === '/support') {
    return {
      title: 'Atelier Client Care & Support — GAYRAA Jaipur',
      description: 'Contact GAYRAA at Sanganer, Jaipur for sizing, prepaid express shipping, and 3-day exchange support.',
    };
  }
  if (pathname === '/faq') {
    return {
      title: 'FAQ & Garment Care Guide — GAYRAA Jaipur',
      description: 'Frequently asked questions on free pan-India shipping, 3-day size/defect exchanges, and fabric care.',
    };
  }
  if (pathname === '/exchange/request') {
    return {
      title: '3-Day Size & Defect Exchange Request — GAYRAA',
      description: 'Guided 3-day size or defect exchange request preparation for GAYRAA orders.',
    };
  }
  if (pathname === '/saved') {
    return {
      title: 'Saved Styles — GAYRAA',
      description: 'Saved silhouettes and wishlist capability notice.',
    };
  }
  return {
    title: 'Page Not Found (404) — GAYRAA',
    description: 'The requested page could not be found on the GAYRAA storefront.',
  };
}

function StorefrontShell() {
  const { bootLoading, bootError, runtimeMode, config, retryBoot, openCartDrawer } = useStorefront();
  const { pathname, searchParams } = useRouter();
  const mainRef = useRef<HTMLElement | null>(null);
  const previousPathnameRef = useRef<string>(pathname);

  const seo = useMemo(() => resolveRouteSeo(pathname, searchParams), [pathname, searchParams]);
  const orgJsonLd = useMemo(
    () =>
      config
        ? {
            '@context': 'https://schema.org',
            '@type': 'ClothingStore',
            name: config.businessName,
            legalName: config.legalEntityName,
            description: config.tagline,
            email: config.contact.email,
            telephone: config.contact.phone,
            address: {
              '@type': 'PostalAddress',
              streetAddress: config.contact.address,
              addressLocality: 'Jaipur',
              addressRegion: 'Rajasthan',
              postalCode: '302029',
              addressCountry: 'IN',
            },
          }
        : null,
    [config]
  );

  useDocumentMeta({
    title: seo.title,
    description: seo.description,
    pathname,
    mode: runtimeMode,
    jsonLd: orgJsonLd,
  });

  // If `/cart` is visited directly, render the storefront shell with the global cart drawer open
  useEffect(() => {
    if (pathname === '/cart') {
      openCartDrawer();
    }
  }, [pathname, openCartDrawer]);

  // Restore keyboard focus to main landmark on route transitions
  useEffect(() => {
    if (previousPathnameRef.current !== pathname) {
      previousPathnameRef.current = pathname;
      if (mainRef.current && pathname !== '/cart') {
        mainRef.current.focus({ preventScroll: true });
      }
    }
  }, [pathname]);

  const renderRouteTemplate = () => {
    if (bootError) {
      return (
        <div className="mx-auto max-w-[1360px] px-4 py-12 sm:px-6 lg:px-8">
          <RecoverableErrorBanner
            title="Storefront Initialization Failed"
            message={bootError.message}
            onRetry={() => void retryBoot()}
          />
        </div>
      );
    }

    if (pathname === '/' || pathname === '/cart') {
      return <HomePage />;
    }

    if (pathname === '/collections' || pathname === '/collections/') {
      return <CollectionPage mode="collection" collectionSlug="all" />;
    }

    if (pathname.startsWith('/collections/')) {
      const slug = decodeURIComponent(pathname.replace('/collections/', '').split('/')[0] || 'all');
      return <CollectionPage mode="collection" collectionSlug={slug} />;
    }

    if (pathname === '/search') {
      return <CollectionPage mode="search" />;
    }

    if (pathname.startsWith('/products/')) {
      const slug = decodeURIComponent(pathname.replace('/products/', '').split('/')[0] || '');
      return <ProductPage slug={slug} />;
    }

    if (pathname === '/checkout') {
      return <CheckoutPage />;
    }

    if (pathname === '/order-lookup') {
      return <CustomerRouteShells routeType="order-lookup" />;
    }

    if (pathname === '/account/orders' || pathname === '/account/orders/') {
      return <CustomerRouteShells routeType="account-orders" />;
    }

    if (pathname.startsWith('/account/orders/')) {
      const orderId = decodeURIComponent(
        pathname.replace('/account/orders/', '').split('/')[0] || ''
      );
      return <CustomerRouteShells routeType="account-orders" orderId={orderId} />;
    }

    if (pathname === '/support') {
      return <CustomerRouteShells routeType="support" />;
    }

    if (pathname === '/faq') {
      return <CustomerRouteShells routeType="faq" />;
    }

    if (pathname === '/exchange/request') {
      return <CustomerRouteShells routeType="exchange" />;
    }

    if (pathname === '/saved') {
      return <CustomerRouteShells routeType="saved" />;
    }

    return (
      <div className="mx-auto max-w-[1360px] px-4 py-16 sm:px-6 lg:px-8">
        <EmptyStatePanel
          title="Page Not Found (404)"
          description={`The route "${pathname}" does not match an active GAYRAA storefront page. Explore our Jaipur collections or return to the homepage.`}
          actionLabel="Return to Storefront Home"
          onAction={() => navigateTo('/')}
        />
      </div>
    );
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#F4F1EA] text-[#161311]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-[#161311] focus:px-4 focus:py-2 focus:text-xs focus:font-semibold focus:text-[#F4F1EA]"
      >
        Skip to main content
      </a>

      <AnnouncementBar />
      <Header />

      <main
        id="main-content"
        ref={mainRef}
        tabIndex={-1}
        className="flex-1 outline-none"
        aria-busy={bootLoading}
      >
        <ErrorBoundary>
          <Suspense
            fallback={
              <div className="mx-auto max-w-[1360px] px-4 py-12 sm:px-6 lg:px-8">
                <ProductGridSkeleton count={3} />
              </div>
            }
          >
            {renderRouteTemplate()}
          </Suspense>
        </ErrorBoundary>
      </main>

      <DevDiagnosticsBar />
      <Footer />

      {/* Global Overlays */}
      <CartDrawer />
      <PolicyDrawer />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <StorefrontProvider>
        <StorefrontShell />
      </StorefrontProvider>
    </ErrorBoundary>
  );
}
