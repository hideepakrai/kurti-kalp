/**
 * StorefrontProvider — UI Integration Layer.
 *
 * Connects React pages and components to the StorefrontConnector contract
 * via the separated composition boundary (`composeStorefrontConnector`).
 *
 * Guarantees:
 * - Zero static imports of `src/testing/*` or mock fixtures in UI bundles.
 * - Explicit runtime modes: 'demo', 'connected', and 'unavailable'.
 * - Honest unavailable state when backend configuration is missing.
 */

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  composeStorefrontConnector,
  resolveInitialStorefrontMode,
  StorefrontConnector,
  UnavailableStorefrontConnector,
} from '../connector';
import { AddCartItemInput, Cart } from '../domain/cart';
import { OrderResult } from '../domain/checkout';
import {
  HeroVariant,
  Navigation,
  PolicySummaryItem,
  StorefrontCapabilities,
  StorefrontConfig,
  StorefrontRuntimeMode,
} from '../domain/content';
import { isStorefrontError, StorefrontError } from '../domain/errors';

export interface StorefrontDevController {
  setSimulationOptions: (options: {
    latencyMs?: number;
    quoteTtlMs?: number;
    forceNextError?: 'NETWORK_FAILURE' | 'CART_CONFLICT' | 'QUOTE_EXPIRED' | null;
    heroVariantOverride?: HeroVariant | null;
  }) => void;
  bumpCartRevisionExternally: () => string;
  expireActiveQuotesNow: () => void;
  getOrderByReference: (ref: string) => OrderResult | null;
}

function extractDevController(connector: StorefrontConnector): StorefrontDevController | null {
  const candidate = connector as unknown as Partial<StorefrontDevController>;
  if (
    typeof candidate.setSimulationOptions === 'function' &&
    typeof candidate.bumpCartRevisionExternally === 'function' &&
    typeof candidate.expireActiveQuotesNow === 'function' &&
    typeof candidate.getOrderByReference === 'function'
  ) {
    return {
      setSimulationOptions: candidate.setSimulationOptions.bind(connector),
      bumpCartRevisionExternally: candidate.bumpCartRevisionExternally.bind(connector),
      expireActiveQuotesNow: candidate.expireActiveQuotesNow.bind(connector),
      getOrderByReference: candidate.getOrderByReference.bind(connector),
    };
  }
  return null;
}

interface StorefrontContextValue {
  connector: StorefrontConnector;
  devController: StorefrontDevController | null;
  runtimeMode: StorefrontRuntimeMode;
  setRuntimeMode: (mode: StorefrontRuntimeMode) => void;
  capabilities: StorefrontCapabilities | null;
  config: StorefrontConfig | null;
  navigation: Navigation | null;
  bootLoading: boolean;
  bootError: StorefrontError | null;
  upstreamUnavailableReason: string | null;
  retryBoot: () => Promise<void>;

  // Shared Cart State
  cart: Cart | null;
  cartLoading: boolean;
  cartError: StorefrontError | null;
  pendingLineItemIds: Record<string, boolean>;
  addingToCart: boolean;
  clearCartError: () => void;
  refreshCart: () => Promise<Cart | null>;
  addToCart: (input: Omit<AddCartItemInput, 'expectedRevision'>) => Promise<boolean>;
  updateLineItemQuantity: (lineItemId: string, quantity: number) => Promise<boolean>;
  removeLineItem: (lineItemId: string) => Promise<boolean>;

  // Global Cart Drawer
  isCartDrawerOpen: boolean;
  openCartDrawer: (triggerEl?: HTMLElement | null) => void;
  closeCartDrawer: () => void;

  // Global Policy Drawer
  activePolicy: PolicySummaryItem | null;
  openPolicyDrawer: (
    policyId: 'shipping' | 'exchange' | 'privacy' | 'terms',
    triggerEl?: HTMLElement | null
  ) => void;
  closePolicyDrawer: () => void;

  // Configurable Hero Variant (Manifest/Preview Option)
  heroVariantOverride: HeroVariant | null;
  setHeroVariantOverride: (variant: HeroVariant | null) => void;

  // Screen-reader live region
  announcement: string;
  announce: (msg: string) => void;
}

const StorefrontContext = createContext<StorefrontContextValue | null>(null);

export function StorefrontProvider({
  connector: injectedConnector,
  initialMode,
  children,
}: {
  connector?: StorefrontConnector;
  initialMode?: StorefrontRuntimeMode;
  children: React.ReactNode;
}) {
  const [runtimeMode, setRuntimeModeState] = useState<StorefrontRuntimeMode>(() =>
    initialMode ?? resolveInitialStorefrontMode()
  );
  const [activeConnector, setActiveConnector] = useState<StorefrontConnector>(
    () => injectedConnector ?? new UnavailableStorefrontConnector('Initializing storefront connector...')
  );
  const [connectorReady, setConnectorReady] = useState<boolean>(Boolean(injectedConnector));

  const [capabilities, setCapabilities] = useState<StorefrontCapabilities | null>(null);
  const [config, setConfig] = useState<StorefrontConfig | null>(null);
  const [navigation, setNavigation] = useState<Navigation | null>(null);
  const [bootLoading, setBootLoading] = useState<boolean>(true);
  const [bootError, setBootError] = useState<StorefrontError | null>(null);
  const [upstreamUnavailableReason, setUpstreamUnavailableReason] = useState<string | null>(null);

  const [cart, setCart] = useState<Cart | null>(null);
  const [cartLoading, setCartLoading] = useState<boolean>(false);
  const [cartError, setCartError] = useState<StorefrontError | null>(null);
  const [pendingLineItemIds, setPendingLineItemIds] = useState<Record<string, boolean>>({});
  const [addingToCart, setAddingToCart] = useState<boolean>(false);

  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState<boolean>(false);
  const cartDrawerTriggerRef = useRef<HTMLElement | null>(null);

  const [activePolicyId, setActivePolicyId] = useState<
    'shipping' | 'exchange' | 'privacy' | 'terms' | null
  >(null);
  const policyDrawerTriggerRef = useRef<HTMLElement | null>(null);

  const [heroVariantOverride, setHeroVariantState] = useState<HeroVariant | null>(null);
  const [announcement, setAnnouncement] = useState<string>('');

  // Mutation sequencing counter to ignore superseded cart responses
  const cartMutationSeqRef = useRef<number>(0);

  // Compose connector when runtimeMode changes (unless an explicit connector was injected for tests)
  useEffect(() => {
    if (injectedConnector) {
      setActiveConnector(injectedConnector);
      setConnectorReady(true);
      return;
    }

    let cancelled = false;
    setConnectorReady(false);
    setBootLoading(true);

    composeStorefrontConnector(runtimeMode)
      .then(({ connector: composed, effectiveMode }) => {
        if (cancelled) return;
        setActiveConnector(composed);
        if (effectiveMode !== runtimeMode) {
          setRuntimeModeState(effectiveMode);
        }
        setConnectorReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        setActiveConnector(new UnavailableStorefrontConnector());
        setRuntimeModeState('unavailable');
        setConnectorReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [runtimeMode, injectedConnector]);

  const devController = extractDevController(activeConnector);

  const announce = useCallback((msg: string) => {
    setAnnouncement(msg);
  }, []);

  const setRuntimeMode = useCallback(
    (nextMode: StorefrontRuntimeMode) => {
      setRuntimeModeState(nextMode);
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.set('mode', nextMode);
        window.history.replaceState({}, '', `${url.pathname}${url.search}`);
      }
      announce(`Storefront mode switched to ${nextMode}.`);
    },
    [announce]
  );

  const loadBootstrapData = useCallback(async () => {
    if (!connectorReady) return;
    setBootLoading(true);
    setBootError(null);
    setUpstreamUnavailableReason(null);

    try {
      const [caps, cfg, nav] = await Promise.all([
        activeConnector.getCapabilities(),
        activeConnector.getStorefrontConfig(),
        activeConnector.getNavigation(),
      ]);

      setCapabilities(caps);
      setConfig(cfg);
      setNavigation(nav);

      if (caps.mode === 'unavailable' || !caps.cartEnabled) {
        setCart(null);
        setUpstreamUnavailableReason(
          'Live Kalp Business API is not configured for this environment. Showing honest unavailable state—demo fixtures are never served silently as live data.'
        );
        return;
      }

      try {
        const initialCart = await activeConnector.getCart();
        setCart(initialCart);
      } catch (cartErr) {
        if (isStorefrontError(cartErr) && cartErr.code === 'UPSTREAM_UNAVAILABLE') {
          setCart(null);
          setUpstreamUnavailableReason(cartErr.message);
        } else {
          throw cartErr;
        }
      }
    } catch (err) {
      const sfErr = isStorefrontError(err)
        ? err
        : new StorefrontError({
            code: 'NETWORK_FAILURE',
            message: 'Unable to initialize storefront configuration.',
            recoverable: true,
          });
      if (sfErr.code === 'UPSTREAM_UNAVAILABLE') {
        setUpstreamUnavailableReason(sfErr.message);
      } else {
        setBootError(sfErr);
      }
    } finally {
      setBootLoading(false);
    }
  }, [activeConnector, connectorReady]);

  useEffect(() => {
    if (connectorReady) {
      void loadBootstrapData();
    }
  }, [connectorReady, loadBootstrapData]);

  const refreshCart = useCallback(async (): Promise<Cart | null> => {
    const seq = ++cartMutationSeqRef.current;
    setCartLoading(true);
    try {
      const latest = await activeConnector.getCart();
      if (seq === cartMutationSeqRef.current) {
        setCart(latest);
        setCartError(null);
      }
      return latest;
    } catch (err) {
      if (seq === cartMutationSeqRef.current) {
        setCartError(
          isStorefrontError(err)
            ? err
            : new StorefrontError({
                code: 'NETWORK_FAILURE',
                message: 'Failed to refresh shopping bag.',
                recoverable: true,
              })
        );
      }
      return null;
    } finally {
      if (seq === cartMutationSeqRef.current) {
        setCartLoading(false);
      }
    }
  }, [activeConnector]);

  const addToCart = useCallback(
    async (input: Omit<AddCartItemInput, 'expectedRevision'>): Promise<boolean> => {
      const seq = ++cartMutationSeqRef.current;
      setAddingToCart(true);
      setCartError(null);
      try {
        const updated = await activeConnector.addCartItem({
          ...input,
          expectedRevision: cart?.revision,
        });
        if (seq === cartMutationSeqRef.current) {
          setCart(updated);
          announce(`Added item to shopping bag. Bag now has ${updated.itemCount} items.`);
        }
        return true;
      } catch (err) {
        const sfErr = isStorefrontError(err)
          ? err
          : new StorefrontError({
              code: 'NETWORK_FAILURE',
              message: 'Could not add item to bag. Please try again.',
              recoverable: true,
            });
        setCartError(sfErr);
        if (sfErr.code === 'CART_CONFLICT') {
          const refreshed = await activeConnector.getCart().catch(() => null);
          if (refreshed) {
            setCart({
              ...refreshed,
              adjustmentNotice: sfErr.message,
            });
          }
        }
        throw sfErr;
      } finally {
        setAddingToCart(false);
      }
    },
    [activeConnector, cart?.revision, announce]
  );

  const updateLineItemQuantity = useCallback(
    async (lineItemId: string, quantity: number): Promise<boolean> => {
      const seq = ++cartMutationSeqRef.current;
      const previousConfirmedCart = cart;
      setPendingLineItemIds((prev) => ({ ...prev, [lineItemId]: true }));
      setCartError(null);

      try {
        const updated = await activeConnector.updateCartItem({
          lineItemId,
          quantity,
          expectedRevision: cart?.revision,
        });
        if (seq === cartMutationSeqRef.current) {
          setCart(updated);
          announce(
            quantity === 0
              ? 'Removed item from shopping bag.'
              : `Updated item quantity to ${quantity}.`
          );
        }
        return true;
      } catch (err) {
        const sfErr = isStorefrontError(err)
          ? err
          : new StorefrontError({
              code: 'NETWORK_FAILURE',
              message: 'Failed to update quantity. Restored your last confirmed bag.',
              recoverable: true,
            });
        setCartError(sfErr);

        if (sfErr.code === 'CART_CONFLICT') {
          const refreshed = await activeConnector.getCart().catch(() => null);
          if (refreshed) {
            setCart({ ...refreshed, adjustmentNotice: sfErr.message });
          }
        } else if (previousConfirmedCart) {
          setCart(previousConfirmedCart);
        }
        return false;
      } finally {
        setPendingLineItemIds((prev) => {
          const next = { ...prev };
          delete next[lineItemId];
          return next;
        });
      }
    },
    [activeConnector, cart, announce]
  );

  const removeLineItem = useCallback(
    async (lineItemId: string): Promise<boolean> => {
      const seq = ++cartMutationSeqRef.current;
      const previousConfirmedCart = cart;
      setPendingLineItemIds((prev) => ({ ...prev, [lineItemId]: true }));
      setCartError(null);

      try {
        const updated = await activeConnector.removeCartItem({
          lineItemId,
          expectedRevision: cart?.revision,
        });
        if (seq === cartMutationSeqRef.current) {
          setCart(updated);
          announce('Removed item from shopping bag.');
        }
        return true;
      } catch (err) {
        const sfErr = isStorefrontError(err)
          ? err
          : new StorefrontError({
              code: 'NETWORK_FAILURE',
              message: 'Failed to remove item. Restored your last confirmed bag.',
              recoverable: true,
            });
        setCartError(sfErr);
        if (sfErr.code === 'CART_CONFLICT') {
          const refreshed = await activeConnector.getCart().catch(() => null);
          if (refreshed) {
            setCart({ ...refreshed, adjustmentNotice: sfErr.message });
          }
        } else if (previousConfirmedCart) {
          setCart(previousConfirmedCart);
        }
        return false;
      } finally {
        setPendingLineItemIds((prev) => {
          const next = { ...prev };
          delete next[lineItemId];
          return next;
        });
      }
    },
    [activeConnector, cart, announce]
  );

  const openCartDrawer = useCallback((triggerEl?: HTMLElement | null) => {
    if (triggerEl) {
      cartDrawerTriggerRef.current = triggerEl;
    } else if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      cartDrawerTriggerRef.current = document.activeElement;
    }
    setIsCartDrawerOpen(true);
  }, []);

  const closeCartDrawer = useCallback(() => {
    setIsCartDrawerOpen(false);
    const trigger = cartDrawerTriggerRef.current;
    if (trigger && typeof trigger.focus === 'function') {
      requestAnimationFrame(() => trigger.focus());
    }
  }, []);

  const openPolicyDrawer = useCallback(
    (policyId: 'shipping' | 'exchange' | 'privacy' | 'terms', triggerEl?: HTMLElement | null) => {
      if (triggerEl) {
        policyDrawerTriggerRef.current = triggerEl;
      } else if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
        policyDrawerTriggerRef.current = document.activeElement;
      }
      setActivePolicyId(policyId);
    },
    []
  );

  const closePolicyDrawer = useCallback(() => {
    setActivePolicyId(null);
    const trigger = policyDrawerTriggerRef.current;
    if (trigger && typeof trigger.focus === 'function') {
      requestAnimationFrame(() => trigger.focus());
    }
  }, []);

  const setHeroVariantOverride = useCallback(
    (variant: HeroVariant | null) => {
      setHeroVariantState(variant);
      if (devController) {
        devController.setSimulationOptions({ heroVariantOverride: variant });
      }
    },
    [devController]
  );

  const activePolicy = activePolicyId && config ? config.policies[activePolicyId] : null;

  return (
    <StorefrontContext.Provider
      value={{
        connector: activeConnector,
        devController,
        runtimeMode: capabilities?.mode ?? runtimeMode,
        setRuntimeMode,
        capabilities,
        config,
        navigation,
        bootLoading,
        bootError,
        upstreamUnavailableReason,
        retryBoot: loadBootstrapData,
        cart,
        cartLoading,
        cartError,
        pendingLineItemIds,
        addingToCart,
        clearCartError: () => setCartError(null),
        refreshCart,
        addToCart,
        updateLineItemQuantity,
        removeLineItem,
        isCartDrawerOpen,
        openCartDrawer,
        closeCartDrawer,
        activePolicy,
        openPolicyDrawer,
        closePolicyDrawer,
        heroVariantOverride,
        setHeroVariantOverride,
        announcement,
        announce,
      }}
    >
      {children}
      {/* Screen-reader live region for accessible status announcements */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
    </StorefrontContext.Provider>
  );
}

export function useStorefront(): StorefrontContextValue {
  const ctx = useContext(StorefrontContext);
  if (!ctx) {
    throw new Error('useStorefront must be used within a StorefrontProvider');
  }
  return ctx;
}
