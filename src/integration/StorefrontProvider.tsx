/**
 * StorefrontProvider — UI Integration Layer.
 *
 * Connects React pages and components to the StorefrontConnector contract.
 * Owns temporary UI state only:
 * - Global Cart Drawer open/close & focus restoration reference
 * - Policy Drawer open/close
 * - Shared Cart state with mutation sequencing so stale responses never overwrite newer ones
 * - Accessible screen-reader announcements
 */

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { defaultMockConnector, LocalMockStorefrontConnector, StorefrontConnector } from '../connector';
import { AddCartItemInput, Cart } from '../domain/cart';
import { HeroVariant, Navigation, PolicySummaryItem, StorefrontCapabilities, StorefrontConfig } from '../domain/content';
import { isStorefrontError, StorefrontError } from '../domain/errors';

interface StorefrontContextValue {
  connector: StorefrontConnector;
  mockAdapter: LocalMockStorefrontConnector | null;
  capabilities: StorefrontCapabilities | null;
  config: StorefrontConfig | null;
  navigation: Navigation | null;
  bootLoading: boolean;
  bootError: StorefrontError | null;
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
  openPolicyDrawer: (policyId: 'shipping' | 'exchange' | 'privacy' | 'terms', triggerEl?: HTMLElement | null) => void;
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
  connector = defaultMockConnector,
  children,
}: {
  connector?: StorefrontConnector;
  children: React.ReactNode;
}) {
  const [capabilities, setCapabilities] = useState<StorefrontCapabilities | null>(null);
  const [config, setConfig] = useState<StorefrontConfig | null>(null);
  const [navigation, setNavigation] = useState<Navigation | null>(null);
  const [bootLoading, setBootLoading] = useState<boolean>(true);
  const [bootError, setBootError] = useState<StorefrontError | null>(null);

  const [cart, setCart] = useState<Cart | null>(null);
  const [cartLoading, setCartLoading] = useState<boolean>(false);
  const [cartError, setCartError] = useState<StorefrontError | null>(null);
  const [pendingLineItemIds, setPendingLineItemIds] = useState<Record<string, boolean>>({});
  const [addingToCart, setAddingToCart] = useState<boolean>(false);

  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState<boolean>(false);
  const cartDrawerTriggerRef = useRef<HTMLElement | null>(null);

  const [activePolicyId, setActivePolicyId] = useState<'shipping' | 'exchange' | 'privacy' | 'terms' | null>(null);
  const policyDrawerTriggerRef = useRef<HTMLElement | null>(null);

  const [heroVariantOverride, setHeroVariantState] = useState<HeroVariant | null>(null);
  const [announcement, setAnnouncement] = useState<string>('');

  // Mutation sequencing counter to ignore superseded cart responses
  const cartMutationSeqRef = useRef<number>(0);

  const mockAdapter = connector instanceof LocalMockStorefrontConnector ? connector : null;

  const announce = useCallback((msg: string) => {
    setAnnouncement(msg);
  }, []);

  const loadBootstrapData = useCallback(async () => {
    setBootLoading(true);
    setBootError(null);
    try {
      const [caps, cfg, nav, initialCart] = await Promise.all([
        connector.getCapabilities(),
        connector.getStorefrontConfig(),
        connector.getNavigation(),
        connector.getCart(),
      ]);
      setCapabilities(caps);
      setConfig(cfg);
      setNavigation(nav);
      setCart(initialCart);
    } catch (err) {
      const sfErr = isStorefrontError(err)
        ? err
        : new StorefrontError({
            code: 'NETWORK_FAILURE',
            message: 'Unable to initialize storefront configuration.',
            recoverable: true,
          });
      setBootError(sfErr);
    } finally {
      setBootLoading(false);
    }
  }, [connector]);

  useEffect(() => {
    void loadBootstrapData();
  }, [loadBootstrapData]);

  const refreshCart = useCallback(async (): Promise<Cart | null> => {
    const seq = ++cartMutationSeqRef.current;
    setCartLoading(true);
    try {
      const latest = await connector.getCart();
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
  }, [connector]);

  const addToCart = useCallback(
    async (input: Omit<AddCartItemInput, 'expectedRevision'>): Promise<boolean> => {
      const seq = ++cartMutationSeqRef.current;
      setAddingToCart(true);
      setCartError(null);
      try {
        const updated = await connector.addCartItem({
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
          const refreshed = await connector.getCart().catch(() => null);
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
    [connector, cart?.revision, announce]
  );

  const updateLineItemQuantity = useCallback(
    async (lineItemId: string, quantity: number): Promise<boolean> => {
      const seq = ++cartMutationSeqRef.current;
      const previousConfirmedCart = cart;
      setPendingLineItemIds((prev) => ({ ...prev, [lineItemId]: true }));
      setCartError(null);

      try {
        const updated = await connector.updateCartItem({
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
          const refreshed = await connector.getCart().catch(() => null);
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
    [connector, cart, announce]
  );

  const removeLineItem = useCallback(
    async (lineItemId: string): Promise<boolean> => {
      const seq = ++cartMutationSeqRef.current;
      const previousConfirmedCart = cart;
      setPendingLineItemIds((prev) => ({ ...prev, [lineItemId]: true }));
      setCartError(null);

      try {
        const updated = await connector.removeCartItem({
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
          const refreshed = await connector.getCart().catch(() => null);
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
    [connector, cart, announce]
  );

  const openCartDrawer = useCallback((triggerEl?: HTMLElement | null) => {
    if (triggerEl) {
      cartDrawerTriggerRef.current = triggerEl;
    } else if (document.activeElement instanceof HTMLElement) {
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
      } else if (document.activeElement instanceof HTMLElement) {
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
      if (mockAdapter) {
        mockAdapter.setSimulationOptions({ heroVariantOverride: variant });
      }
    },
    [mockAdapter]
  );

  const activePolicy = activePolicyId && config ? config.policies[activePolicyId] : null;

  return (
    <StorefrontContext.Provider
      value={{
        connector,
        mockAdapter,
        capabilities,
        config,
        navigation,
        bootLoading,
        bootError,
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
