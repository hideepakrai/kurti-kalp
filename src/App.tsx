/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { CartDrawer } from './components/commerce/CartDrawer';
import { AnnouncementBar } from './components/layout/AnnouncementBar';
import { DevDiagnosticsBar } from './components/layout/DevDiagnosticsBar';
import { Footer } from './components/layout/Footer';
import { Header } from './components/layout/Header';
import { PolicyDrawer } from './components/layout/PolicyDrawer';
import { EmptyStatePanel, RecoverableErrorBanner } from './components/ui/StateFeedback';
import { StorefrontProvider, useStorefront } from './integration/StorefrontProvider';
import { navigateTo, useRouter } from './integration/hooks/useRouter';
import { CheckoutPage } from './pages/CheckoutPage';
import { CollectionPage } from './pages/CollectionPage';
import { HomePage } from './pages/HomePage';
import { ProductPage } from './pages/ProductPage';

function StorefrontShell() {
  const { bootLoading, bootError, retryBoot, openCartDrawer } = useStorefront();
  const { pathname } = useRouter();

  // If `/cart` is visited directly, render the storefront shell with the global cart drawer open
  useEffect(() => {
    if (pathname === '/cart') {
      openCartDrawer();
    }
  }, [pathname, openCartDrawer]);

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

    return (
      <div className="mx-auto max-w-[1360px] px-4 py-16 sm:px-6 lg:px-8">
        <EmptyStatePanel
          title="Page Not Found"
          description={`The route "${pathname}" does not match a storefront page.`}
          actionLabel="Return to Homepage"
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

      <main id="main-content" className="flex-1" aria-busy={bootLoading}>
        {renderRouteTemplate()}
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
    <StorefrontProvider>
      <StorefrontShell />
    </StorefrontProvider>
  );
}
