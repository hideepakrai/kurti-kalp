/**
 * CartDrawer — Global slide-over shopping bag drawer.
 *
 * Displays:
 * - Item image, title, selected product-specific options, SKU
 * - QuantityStepper with inline pending state (without layout shift)
 * - Remove action
 * - Connector-returned line totals and bag summary
 * - Estimated shipping/tax wording and policy link
 * - Continue Shopping and Proceed to Checkout actions
 * - Recoverable error and conflict adjustment states
 */

import React from 'react';
import { AlertCircle, ArrowRight, Loader2, Trash2 } from 'lucide-react';
import { formatMoney } from '../../domain/money';
import { useStorefront } from '../../integration/StorefrontProvider';
import { navigateTo } from '../../integration/hooks/useRouter';
import { Drawer } from '../ui/Drawer';
import { QuantityStepper } from '../ui/QuantityStepper';
import { EmptyStatePanel, RecoverableErrorBanner } from '../ui/StateFeedback';
import { StudioImage } from '../ui/StudioImage';

export function CartDrawer() {
  const {
    cart,
    cartLoading,
    cartError,
    pendingLineItemIds,
    isCartDrawerOpen,
    closeCartDrawer,
    updateLineItemQuantity,
    removeLineItem,
    clearCartError,
    refreshCart,
    openPolicyDrawer,
  } = useStorefront();

  const itemCount = cart?.itemCount ?? 0;

  const handleCheckoutNavigate = () => {
    closeCartDrawer();
    navigateTo('/checkout');
  };

  const handleContinueShopping = () => {
    closeCartDrawer();
    if (window.location.pathname === '/cart') {
      navigateTo('/collections/all');
    }
  };

  return (
    <Drawer
      isOpen={isCartDrawerOpen}
      onClose={closeCartDrawer}
      title={`Shopping Bag (${itemCount})`}
      subtitle="Stage A Demo Bag · Server-Authoritative Totals"
      footer={
        cart && cart.items.length > 0 ? (
          <div className="space-y-3.5">
            <div className="space-y-1.5 text-xs">
              {cart.totals.discountTotal.amountMinor > 0 && (
                <div className="flex justify-between text-[#524B44] tabular-nums">
                  <span>MRP Total</span>
                  <span className="line-through">{formatMoney(cart.totals.subtotal)}</span>
                </div>
              )}
              {cart.totals.discountTotal.amountMinor > 0 && (
                <div className="flex justify-between font-semibold text-[#165B38] tabular-nums">
                  <span>Catalog Savings</span>
                  <span>− {formatMoney(cart.totals.discountTotal)}</span>
                </div>
              )}
              <div className="flex items-baseline justify-between border-t border-[#D6CFC2] pt-2 text-base font-semibold text-[#161311] tabular-nums">
                <span>Estimated Subtotal</span>
                <span>{formatMoney(cart.totals.payableSubtotal)}</span>
              </div>
              <p className="text-[11px] text-[#524B44]">{cart.totals.estimatedShippingNote}</p>
              <p className="text-[11px] text-[#6B6259]">{cart.totals.taxIncludedNote}</p>
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                onClick={handleCheckoutNavigate}
                className="inline-flex h-12 w-full items-center justify-center gap-2 bg-[#161311] px-6 text-xs font-semibold tracking-wider text-[#F4F1EA] uppercase transition-colors duration-150 hover:bg-[#7A1C1D]"
              >
                <span>Proceed to Checkout</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={handleContinueShopping}
                className="inline-flex h-10 w-full items-center justify-center border border-[#D6CFC2] bg-[#FAF8F5] px-4 text-xs font-semibold tracking-wider text-[#161311] uppercase transition-colors duration-150 hover:bg-[#EAE4D8]"
              >
                Continue Shopping
              </button>
            </div>
          </div>
        ) : undefined
      }
    >
      <div className="space-y-4">
        {cartError && (
          <RecoverableErrorBanner
            title="Bag Update Issue"
            message={cartError.message}
            onRetry={() => {
              clearCartError();
              void refreshCart();
            }}
            retryLabel="Dismiss & Sync"
          />
        )}

        {cart?.adjustmentNotice && (
          <div
            role="status"
            className="flex items-start gap-2.5 border border-[#E8C79B] bg-[#FDF3E7] p-3 text-xs text-[#7C4700]"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{cart.adjustmentNotice}</span>
          </div>
        )}

        {cartLoading && !cart ? (
          <div className="flex items-center justify-center py-14 text-xs text-[#524B44]">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            <span>Loading shopping bag...</span>
          </div>
        ) : !cart || cart.items.length === 0 ? (
          <EmptyStatePanel
            icon="bag"
            title="Your Shopping Bag is Empty"
            description="Explore our Jaipur handblock Anarkalis, Chanderi silk kurta sets, and contemporary co-ords."
            actionLabel="Browse Collections"
            onAction={() => {
              closeCartDrawer();
              navigateTo('/collections/all');
            }}
          />
        ) : (
          <ul className="divide-y divide-[#D6CFC2]">
            {cart.items.map((item) => {
              const isPending = Boolean(pendingLineItemIds[item.lineItemId]);
              const optionSummary = Object.entries(item.selectedOptions)
                .map(([k, v]) => `${k}: ${v}`)
                .join(' · ');

              return (
                <li key={item.lineItemId} className="py-4 first:pt-0">
                  <div className="flex gap-4">
                    <a
                      href={`/products/${item.productSlug}`}
                      onClick={(e) => {
                        e.preventDefault();
                        closeCartDrawer();
                        navigateTo(`/products/${item.productSlug}`);
                      }}
                      className="w-20 shrink-0 border border-[#D6CFC2]"
                    >
                      <StudioImage asset={item.image} />
                    </a>

                    <div className="flex flex-1 flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <a
                            href={`/products/${item.productSlug}`}
                            onClick={(e) => {
                              e.preventDefault();
                              closeCartDrawer();
                              navigateTo(`/products/${item.productSlug}`);
                            }}
                            className="text-xs font-semibold leading-snug text-[#161311] hover:text-[#7A1C1D] hover:underline"
                          >
                            {item.productTitle}
                          </a>

                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => void removeLineItem(item.lineItemId)}
                            aria-label={`Remove ${item.productTitle} from bag`}
                            className="flex h-8 w-8 shrink-0 items-center justify-center text-[#524B44] transition-colors duration-150 hover:bg-[#EAE4D8] hover:text-[#961B1E] disabled:opacity-40"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <p className="mt-1 text-[11px] font-semibold text-[#524B44]">
                          {optionSummary}
                        </p>
                        <p className="mt-0.5 text-[11px] text-[#6B6259]">
                          Unit: {formatMoney(item.unitPrice)} · Demo SKU: {item.sku}
                        </p>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-2">
                        <QuantityStepper
                          quantity={item.quantity}
                          maxQuantity={item.maxAllowedQuantity}
                          minQuantity={1}
                          pending={isPending}
                          onChange={(nextQty) =>
                            void updateLineItemQuantity(item.lineItemId, nextQty)
                          }
                          label={`Quantity for ${item.productTitle}`}
                        />

                        <div className="text-right tabular-nums">
                          <span className="text-xs font-semibold text-[#161311]">
                            {formatMoney(item.lineSubtotal)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="border-t border-[#D6CFC2] pt-3 text-[11px] text-[#524B44]">
          <p>
            <strong>Policy Summary:</strong> Free standard shipping across India (48h dispatch).
            Limited exchanges within 3 days of delivery for size or defect issues only (no general
            refunds).{' '}
            <button
              type="button"
              onClick={(e) => openPolicyDrawer('exchange', e.currentTarget)}
              className="font-semibold text-[#7A1C1D] underline underline-offset-2"
            >
              Read full terms
            </button>
          </p>
        </div>
      </div>
    </Drawer>
  );
}
