/**
 * CheckoutPage Template (/checkout) — Includes live quote evaluation and
 * clearly labelled demo order-result state.
 *
 * Enforces:
 * - Minor-unit Money totals from CheckoutQuote
 * - Cart revision synchronization (`cartRevision`)
 * - Quote expiration monitoring (`expiresAt`) and 1-click Refresh Quote recovery
 * - Connector-driven shipping & payment eligibility (never universally enabling COD or express)
 * - PIN-format validation with explicit notice that format validation does not guarantee courier serviceability
 * - Idempotent submission (`idempotencyKey` reused on retry, regenerated on logical payload edits)
 * - Strict separation of `orderStatus` and `paymentStatus`
 * - Explicit demo mode disclaimer that no real order or payment was created
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Info,
  Loader2,
  Lock,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import {
  CheckoutQuote,
  CustomerContact,
  OrderResult,
  PaymentMethodCode,
  PostalAddress,
} from '../domain/checkout';
import { isStorefrontError, StorefrontError } from '../domain/errors';
import { formatMoney } from '../domain/money';
import { useStorefront } from '../integration/StorefrontProvider';
import { navigateTo } from '../integration/hooks/useRouter';
import { Breadcrumbs } from '../components/layout/Breadcrumbs';
import { EmptyStatePanel, RecoverableErrorBanner } from '../components/ui/StateFeedback';
import { StudioImage } from '../components/ui/StudioImage';

function generateIdempotencyKey(): string {
  return `idem_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function CheckoutPage() {
  const { connector, cart, refreshCart, openPolicyDrawer } = useStorefront();

  // Preserve customer form inputs across quote refreshes or recoverable errors
  const [contact, setContact] = useState<CustomerContact>({
    fullName: '',
    email: '',
    phone: '',
  });

  const [shippingAddress, setShippingAddress] = useState<PostalAddress>({
    recipientName: '',
    line1: '',
    line2: '',
    city: 'Jaipur',
    state: 'Rajasthan',
    postalCode: '302029',
    countryCode: 'IN',
  });

  const [billingSameAsShipping, setBillingSameAsShipping] = useState<boolean>(true);
  const [billingAddress, setBillingAddress] = useState<PostalAddress>({
    recipientName: '',
    line1: '',
    line2: '',
    city: '',
    state: '',
    postalCode: '',
    countryCode: 'IN',
  });

  const [selectedShippingMethodId, setSelectedShippingMethodId] =
    useState<string>('ship-standard-free');
  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState<PaymentMethodCode>('PREPAID_INTENT');

  const [quote, setQuote] = useState<CheckoutQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState<boolean>(false);
  const [quoteError, setQuoteError] = useState<StorefrontError | null>(null);
  const [isQuoteExpiredClientCheck, setIsQuoteExpiredClientCheck] = useState<boolean>(false);

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<StorefrontError | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [orderResult, setOrderResult] = useState<OrderResult | null>(null);

  // Scoped idempotency key for the current logical submission
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => generateIdempotencyKey());
  const quoteSeqRef = useRef(0);

  // Regenerate idempotency key whenever the customer intentionally edits logical submission fields
  const markLogicalInputEdited = () => {
    setIdempotencyKey(generateIdempotencyKey());
    setSubmitError(null);
  };

  const requestCheckoutQuote = useCallback(
    async (overrideRevision?: string) => {
      const activeRevision = overrideRevision ?? cart?.revision;
      if (!activeRevision || !cart || cart.items.length === 0) return;

      const seq = ++quoteSeqRef.current;
      setQuoteLoading(true);
      setQuoteError(null);
      setIsQuoteExpiredClientCheck(false);

      try {
        const nextQuote = await connector.getCheckoutQuote({
          cartRevision: activeRevision,
          shippingAddress: {
            postalCode: shippingAddress.postalCode,
            state: shippingAddress.state,
            city: shippingAddress.city,
            countryCode: 'IN',
          },
          shippingMethodId: selectedShippingMethodId,
        });

        if (seq === quoteSeqRef.current) {
          setQuote(nextQuote);
          setSelectedShippingMethodId(nextQuote.selectedShippingMethodId);
          // If current selectedPaymentMethod became ineligible in the new quote, fall back to first eligible method
          const currentPaymentOption = nextQuote.paymentMethods.find(
            (p) => p.code === selectedPaymentMethod
          );
          if (!currentPaymentOption || !currentPaymentOption.eligible) {
            const firstEligible = nextQuote.paymentMethods.find((p) => p.eligible);
            if (firstEligible) {
              setSelectedPaymentMethod(firstEligible.code);
            }
          }
          // Updating the quote establishes a new logical submission state
          setIdempotencyKey(generateIdempotencyKey());
        }
      } catch (err) {
        if (seq === quoteSeqRef.current) {
          const sfErr = isStorefrontError(err)
            ? err
            : new StorefrontError({
                code: 'NETWORK_FAILURE',
                message: 'Could not calculate checkout quote. Please retry.',
                recoverable: true,
              });
          setQuoteError(sfErr);
          if (sfErr.code === 'CART_CONFLICT') {
            const refreshed = await refreshCart();
            if (refreshed && refreshed.items.length > 0) {
              void requestCheckoutQuote(refreshed.revision);
            }
          }
        }
      } finally {
        if (seq === quoteSeqRef.current) {
          setQuoteLoading(false);
        }
      }
    },
    [
      connector,
      cart,
      shippingAddress.postalCode,
      shippingAddress.state,
      shippingAddress.city,
      selectedShippingMethodId,
      selectedPaymentMethod,
      refreshCart,
    ]
  );

  // Request quote when cart revision or 6-digit PIN / shipping method changes
  useEffect(() => {
    if (!orderResult && cart && cart.items.length > 0) {
      void requestCheckoutQuote(cart.revision);
    }
  }, [cart?.revision, selectedShippingMethodId, shippingAddress.postalCode]);

  // Client-side UX assistance timer checking whether the active quote has passed its expiresAt timestamp
  useEffect(() => {
    if (!quote || orderResult) return;
    const checkExpiry = () => {
      const expired = Date.now() > Date.parse(quote.expiresAt);
      setIsQuoteExpiredClientCheck(expired);
    };
    checkExpiry();
    const interval = window.setInterval(checkExpiry, 2000);
    return () => window.clearInterval(interval);
  }, [quote, orderResult]);

  const handlePlaceDemoOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quote || !cart) return;

    setSubmitting(true);
    setSubmitError(null);
    setFieldErrors({});

    try {
      const result = await connector.createOrder({
        idempotencyKey,
        quoteId: quote.quoteId,
        cartRevision: cart.revision,
        contact,
        shippingAddress: {
          ...shippingAddress,
          recipientName: shippingAddress.recipientName || contact.fullName,
        },
        billingSameAsShipping,
        billingAddress: billingSameAsShipping ? undefined : billingAddress,
        shippingMethodId: selectedShippingMethodId,
        paymentMethodCode: selectedPaymentMethod,
      });

      setOrderResult(result);
      await refreshCart();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      const sfErr = isStorefrontError(err)
        ? err
        : new StorefrontError({
            code: 'NETWORK_FAILURE',
            message: 'Submission failed. Your form entries are preserved—please retry.',
            recoverable: true,
          });
      setSubmitError(sfErr);

      if (sfErr.fieldIssues && sfErr.fieldIssues.length > 0) {
        const map: Record<string, string> = {};
        for (const issue of sfErr.fieldIssues) {
          map[issue.field] = issue.message;
        }
        setFieldErrors(map);
      }

      if (sfErr.code === 'IDEMPOTENCY_CONFLICT') {
        setIdempotencyKey(generateIdempotencyKey());
      } else if (sfErr.code === 'CART_CONFLICT') {
        await refreshCart();
      }
    } finally {
      setSubmitting(false);
    }
  };

  // 1. Render Demo Order Result State if an order was created in this session
  if (orderResult) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <Breadcrumbs
          items={[
            { label: 'Home', href: '/' },
            { label: 'Checkout', href: '/checkout' },
            { label: `Demo Order ${orderResult.orderReference}` },
          ]}
        />

        {/* Explicit Demo Disclaimer Banner */}
        <div
          role="region"
          aria-label="Demo mode notice"
          className="mt-4 border-2 border-[#7A1C1D] bg-[#FAF8F5] p-6"
        >
          <div className="flex items-start gap-3.5">
            <ShieldAlert className="mt-0.5 h-6 w-6 shrink-0 text-[#7A1C1D]" aria-hidden="true" />
            <div>
              <p className="text-xs font-semibold tracking-[0.18em] text-[#7A1C1D] uppercase">
                Stage A Demo Order Result — No Real Order or Payment Created
              </p>
              <h1 className="mt-1 font-editorial text-3xl font-semibold text-[#161311]">
                Demo Reference: {orderResult.orderReference}
              </h1>
              <p className="mt-2 text-xs leading-relaxed text-[#524B44]">
                {orderResult.demoDisclaimer}
              </p>
            </div>
          </div>

          {/* Strictly Separated Order Status vs. Payment Status */}
          <div className="mt-6 grid grid-cols-1 gap-4 border-t border-[#D6CFC2] pt-5 sm:grid-cols-2">
            <div className="border border-[#D6CFC2] bg-[#F4F1EA] p-4">
              <span className="block text-[11px] font-semibold tracking-wider text-[#524B44] uppercase">
                Order Lifecycle Status
              </span>
              <div className="mt-1.5 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#165B38]" aria-hidden="true" />
                <span className="font-mono text-xs font-semibold text-[#161311]">
                  {orderResult.orderStatus}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-[#524B44]">
                Order record held in Stage A mock adapter memory.
              </p>
            </div>

            <div className="border border-[#E8C79B] bg-[#FDF3E7] p-4">
              <span className="block text-[11px] font-semibold tracking-wider text-[#7C4700] uppercase">
                Payment Lifecycle Status (Not Paid)
              </span>
              <div className="mt-1.5 flex items-center gap-2">
                <Clock className="h-4 w-4 text-[#7C4700]" aria-hidden="true" />
                <span className="font-mono text-xs font-semibold text-[#7C4700]">
                  {orderResult.paymentStatus}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-[#7C4700]">
                {orderResult.paymentAction.summary}: {orderResult.paymentAction.nextStepInstruction}
              </p>
            </div>
          </div>

          {/* Delivery, Contact & Item Summary */}
          <div className="mt-6 grid grid-cols-1 gap-6 border-t border-[#D6CFC2] pt-6 text-xs sm:grid-cols-2">
            <div>
              <h2 className="font-semibold tracking-wider text-[#161311] uppercase">
                Customer &amp; Delivery Address
              </h2>
              <p className="mt-2 font-semibold text-[#161311]">
                {orderResult.shippingAddress.recipientName}
              </p>
              <p className="text-[#524B44]">{orderResult.shippingAddress.line1}</p>
              {orderResult.shippingAddress.line2 && (
                <p className="text-[#524B44]">{orderResult.shippingAddress.line2}</p>
              )}
              <p className="text-[#524B44]">
                {orderResult.shippingAddress.city}, {orderResult.shippingAddress.state} —{' '}
                {orderResult.shippingAddress.postalCode}
              </p>
              <p className="mt-2 text-[#524B44]">
                {orderResult.contact.email} · {orderResult.contact.phone}
              </p>
            </div>

            <div>
              <h2 className="font-semibold tracking-wider text-[#161311] uppercase">
                Shipping &amp; Policy Baseline
              </h2>
              <p className="mt-2 font-semibold text-[#161311]">
                {orderResult.shippingMethod.title}
              </p>
              <p className="text-[#524B44]">{orderResult.shippingMethod.dispatchEstimate}</p>
              <p className="text-[#524B44]">{orderResult.shippingMethod.transitEstimate}</p>
              <p className="mt-2 text-[11px] text-[#6B6259]">
                Limited 3-day exchange for size/defective issues with Order ID (no general refunds;
                customer-arranged return shipping).
              </p>
            </div>
          </div>

          {/* Itemized Receipt Breakdown */}
          <div className="mt-6 border-t border-[#D6CFC2] pt-6">
            <h2 className="text-xs font-semibold tracking-wider text-[#161311] uppercase">
              Demo Order Line Items
            </h2>
            <ul className="mt-3 divide-y divide-[#EAE4D8] border-y border-[#D6CFC2]">
              {orderResult.items.map((item) => (
                <li
                  key={item.lineItemId}
                  className="flex items-center justify-between gap-4 py-3 text-xs"
                >
                  <div>
                    <p className="font-semibold text-[#161311]">
                      {item.productTitle} × {item.quantity}
                    </p>
                    <p className="text-[#524B44]">
                      {Object.entries(item.selectedOptions)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(' · ')}{' '}
                      · SKU: {item.sku}
                    </p>
                  </div>
                  <span className="font-semibold text-[#161311] tabular-nums">
                    {formatMoney(item.lineSubtotal)}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-4 space-y-1.5 text-xs tabular-nums">
              <div className="flex justify-between text-[#524B44]">
                <span>Items MRP Total</span>
                <span>{formatMoney(orderResult.totals.itemsSubtotal)}</span>
              </div>
              {orderResult.totals.discountTotal.amountMinor > 0 && (
                <div className="flex justify-between text-[#165B38]">
                  <span>Catalog Discount</span>
                  <span>− {formatMoney(orderResult.totals.discountTotal)}</span>
                </div>
              )}
              <div className="flex justify-between text-[#524B44]">
                <span>Standard Pan-India Shipping</span>
                <span>
                  {orderResult.totals.shippingFee.amountMinor === 0
                    ? 'FREE'
                    : formatMoney(orderResult.totals.shippingFee)}
                </span>
              </div>
              <div className="flex justify-between text-[#6B6259]">
                <span>Included GST Estimate</span>
                <span>{formatMoney(orderResult.totals.taxTotal)}</span>
              </div>
              <div className="flex justify-between border-t border-[#D6CFC2] pt-2 text-base font-semibold text-[#161311]">
                <span>Demo Order Total (Unpaid)</span>
                <span>{formatMoney(orderResult.totals.payableTotal)}</span>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => navigateTo('/collections/all')}
              className="inline-flex h-11 items-center justify-center bg-[#161311] px-6 text-xs font-semibold tracking-wider text-[#F4F1EA] uppercase hover:bg-[#7A1C1D]"
            >
              Continue Exploring Demo Storefront
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. Empty Bag Guard
  if (!cart || cart.items.length === 0) {
    return (
      <div className="mx-auto max-w-[1360px] px-4 py-12 sm:px-6 lg:px-8">
        <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Checkout' }]} />
        <div className="mt-6">
          <EmptyStatePanel
            icon="bag"
            title="Your Shopping Bag is Empty"
            description="Add a Jaipur Anarkali, kurta set, or co-ord set to your bag before proceeding to checkout."
            actionLabel="Explore All Collections"
            onAction={() => navigateTo('/collections/all')}
          />
        </div>
      </div>
    );
  }

  const cartOutOfSyncWithQuote = Boolean(quote && quote.cartRevision !== cart.revision);
  const quoteNeedsRefresh = isQuoteExpiredClientCheck || cartOutOfSyncWithQuote;

  return (
    <div className="mx-auto max-w-[1360px] px-4 py-8 sm:px-6 lg:px-8">
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Checkout' }]} />

      <div className="mt-3 border-b border-[#D6CFC2] pb-5">
        <p className="text-[11px] font-semibold tracking-[0.2em] text-[#7A1C1D] uppercase">
          STAGE A PROTOTYPE CHECKOUT · NO REAL PAYMENT CAPTURED
        </p>
        <h1 className="mt-1 font-editorial text-3xl font-semibold text-[#161311] sm:text-4xl">
          Checkout &amp; Delivery Quote
        </h1>
      </div>

      <form
        onSubmit={handlePlaceDemoOrder}
        noValidate
        className="mt-8 grid grid-cols-1 items-start gap-10 lg:grid-cols-12"
      >
        {/* Left Column: Customer Contact, Address, Shipping & Payment Selection */}
        <div className="space-y-8 lg:col-span-7">
          {submitError && (
            <RecoverableErrorBanner
              title={
                submitError.code === 'QUOTE_EXPIRED'
                  ? 'Checkout Quote Expired'
                  : submitError.code === 'CART_CONFLICT'
                    ? 'Shopping Bag Updated'
                    : submitError.code === 'IDEMPOTENCY_CONFLICT'
                      ? 'Submission Conflict Detected'
                      : 'Checkout Issue'
              }
              message={submitError.message}
              onRetry={
                submitError.code === 'QUOTE_EXPIRED' || submitError.code === 'CART_CONFLICT'
                  ? () => void requestCheckoutQuote(cart.revision)
                  : undefined
              }
              retryLabel="Refresh Quote Now"
            />
          )}

          {/* 1. Contact Information */}
          <section
            aria-labelledby="checkout-contact-heading"
            className="border border-[#D6CFC2] bg-[#FAF8F5] p-6"
          >
            <h2
              id="checkout-contact-heading"
              className="font-editorial text-2xl font-semibold text-[#161311]"
            >
              1. Contact Information
            </h2>
            <p className="mt-1 text-xs text-[#524B44]">
              Used for dispatch notifications and Order ID reference.
            </p>

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label
                  htmlFor="contact-fullname"
                  className="block text-xs font-semibold tracking-wider text-[#161311] uppercase"
                >
                  Full Name *
                </label>
                <input
                  id="contact-fullname"
                  name="name"
                  type="text"
                  autoComplete="name"
                  required
                  value={contact.fullName}
                  onChange={(e) => {
                    markLogicalInputEdited();
                    setContact((prev) => ({ ...prev, fullName: e.target.value }));
                  }}
                  aria-invalid={Boolean(fieldErrors['contact.fullName'])}
                  aria-describedby={
                    fieldErrors['contact.fullName'] ? 'err-contact-fullname' : undefined
                  }
                  placeholder="e.g. Ananya Sharma"
                  className={`mt-1.5 h-11 w-full border bg-[#F4F1EA] px-3.5 text-sm text-[#161311] ${
                    fieldErrors['contact.fullName'] ? 'border-2 border-[#961B1E]' : 'border-[#D6CFC2]'
                  }`}
                />
                {fieldErrors['contact.fullName'] && (
                  <p id="err-contact-fullname" className="mt-1 text-xs font-semibold text-[#961B1E]">
                    {fieldErrors['contact.fullName']}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="contact-email"
                  className="block text-xs font-semibold tracking-wider text-[#161311] uppercase"
                >
                  Email Address *
                </label>
                <input
                  id="contact-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={contact.email}
                  onChange={(e) => {
                    markLogicalInputEdited();
                    setContact((prev) => ({ ...prev, email: e.target.value }));
                  }}
                  aria-invalid={Boolean(fieldErrors['contact.email'])}
                  aria-describedby={fieldErrors['contact.email'] ? 'err-contact-email' : undefined}
                  placeholder="name@example.com"
                  className={`mt-1.5 h-11 w-full border bg-[#F4F1EA] px-3.5 text-sm text-[#161311] ${
                    fieldErrors['contact.email'] ? 'border-2 border-[#961B1E]' : 'border-[#D6CFC2]'
                  }`}
                />
                {fieldErrors['contact.email'] && (
                  <p id="err-contact-email" className="mt-1 text-xs font-semibold text-[#961B1E]">
                    {fieldErrors['contact.email']}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="contact-phone"
                  className="block text-xs font-semibold tracking-wider text-[#161311] uppercase"
                >
                  Mobile Number (India) *
                </label>
                <input
                  id="contact-phone"
                  name="tel"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  required
                  value={contact.phone}
                  onChange={(e) => {
                    markLogicalInputEdited();
                    setContact((prev) => ({ ...prev, phone: e.target.value }));
                  }}
                  aria-invalid={Boolean(fieldErrors['contact.phone'])}
                  aria-describedby={fieldErrors['contact.phone'] ? 'err-contact-phone' : undefined}
                  placeholder="9876543210"
                  className={`mt-1.5 h-11 w-full border bg-[#F4F1EA] px-3.5 text-sm text-[#161311] ${
                    fieldErrors['contact.phone'] ? 'border-2 border-[#961B1E]' : 'border-[#D6CFC2]'
                  }`}
                />
                {fieldErrors['contact.phone'] && (
                  <p id="err-contact-phone" className="mt-1 text-xs font-semibold text-[#961B1E]">
                    {fieldErrors['contact.phone']}
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* 2. Shipping & Billing Address */}
          <section
            aria-labelledby="checkout-address-heading"
            className="border border-[#D6CFC2] bg-[#FAF8F5] p-6"
          >
            <h2
              id="checkout-address-heading"
              className="font-editorial text-2xl font-semibold text-[#161311]"
            >
              2. Shipping Address
            </h2>

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label
                  htmlFor="ship-recipient"
                  className="block text-xs font-semibold tracking-wider text-[#161311] uppercase"
                >
                  Recipient Name *
                </label>
                <input
                  id="ship-recipient"
                  name="shipping-name"
                  type="text"
                  autoComplete="shipping name"
                  required
                  value={shippingAddress.recipientName}
                  onChange={(e) => {
                    markLogicalInputEdited();
                    setShippingAddress((prev) => ({ ...prev, recipientName: e.target.value }));
                  }}
                  aria-invalid={Boolean(fieldErrors['shippingAddress.recipientName'])}
                  placeholder="Recipient full name"
                  className={`mt-1.5 h-11 w-full border bg-[#F4F1EA] px-3.5 text-sm text-[#161311] ${
                    fieldErrors['shippingAddress.recipientName']
                      ? 'border-2 border-[#961B1E]'
                      : 'border-[#D6CFC2]'
                  }`}
                />
                {fieldErrors['shippingAddress.recipientName'] && (
                  <p className="mt-1 text-xs font-semibold text-[#961B1E]">
                    {fieldErrors['shippingAddress.recipientName']}
                  </p>
                )}
              </div>

              <div className="sm:col-span-2">
                <label
                  htmlFor="ship-line1"
                  className="block text-xs font-semibold tracking-wider text-[#161311] uppercase"
                >
                  Street Address, House / Flat No. *
                </label>
                <input
                  id="ship-line1"
                  name="address-line1"
                  type="text"
                  autoComplete="shipping address-line1"
                  required
                  value={shippingAddress.line1}
                  onChange={(e) => {
                    markLogicalInputEdited();
                    setShippingAddress((prev) => ({ ...prev, line1: e.target.value }));
                  }}
                  aria-invalid={Boolean(fieldErrors['shippingAddress.line1'])}
                  placeholder="House no., building, street, locality"
                  className={`mt-1.5 h-11 w-full border bg-[#F4F1EA] px-3.5 text-sm text-[#161311] ${
                    fieldErrors['shippingAddress.line1']
                      ? 'border-2 border-[#961B1E]'
                      : 'border-[#D6CFC2]'
                  }`}
                />
                {fieldErrors['shippingAddress.line1'] && (
                  <p className="mt-1 text-xs font-semibold text-[#961B1E]">
                    {fieldErrors['shippingAddress.line1']}
                  </p>
                )}
              </div>

              <div className="sm:col-span-2">
                <label
                  htmlFor="ship-line2"
                  className="block text-xs font-semibold tracking-wider text-[#161311] uppercase"
                >
                  Landmark / Area (Optional)
                </label>
                <input
                  id="ship-line2"
                  name="address-line2"
                  type="text"
                  autoComplete="shipping address-line2"
                  value={shippingAddress.line2 || ''}
                  onChange={(e) => {
                    markLogicalInputEdited();
                    setShippingAddress((prev) => ({ ...prev, line2: e.target.value }));
                  }}
                  placeholder="Near landmark or sector"
                  className="mt-1.5 h-11 w-full border border-[#D6CFC2] bg-[#F4F1EA] px-3.5 text-sm text-[#161311]"
                />
              </div>

              <div>
                <label
                  htmlFor="ship-city"
                  className="block text-xs font-semibold tracking-wider text-[#161311] uppercase"
                >
                  City / Town *
                </label>
                <input
                  id="ship-city"
                  name="address-level2"
                  type="text"
                  autoComplete="shipping address-level2"
                  required
                  value={shippingAddress.city}
                  onChange={(e) => {
                    markLogicalInputEdited();
                    setShippingAddress((prev) => ({ ...prev, city: e.target.value }));
                  }}
                  aria-invalid={Boolean(fieldErrors['shippingAddress.city'])}
                  className={`mt-1.5 h-11 w-full border bg-[#F4F1EA] px-3.5 text-sm text-[#161311] ${
                    fieldErrors['shippingAddress.city']
                      ? 'border-2 border-[#961B1E]'
                      : 'border-[#D6CFC2]'
                  }`}
                />
                {fieldErrors['shippingAddress.city'] && (
                  <p className="mt-1 text-xs font-semibold text-[#961B1E]">
                    {fieldErrors['shippingAddress.city']}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="ship-state"
                  className="block text-xs font-semibold tracking-wider text-[#161311] uppercase"
                >
                  State *
                </label>
                <input
                  id="ship-state"
                  name="address-level1"
                  type="text"
                  autoComplete="shipping address-level1"
                  required
                  value={shippingAddress.state}
                  onChange={(e) => {
                    markLogicalInputEdited();
                    setShippingAddress((prev) => ({ ...prev, state: e.target.value }));
                  }}
                  aria-invalid={Boolean(fieldErrors['shippingAddress.state'])}
                  className={`mt-1.5 h-11 w-full border bg-[#F4F1EA] px-3.5 text-sm text-[#161311] ${
                    fieldErrors['shippingAddress.state']
                      ? 'border-2 border-[#961B1E]'
                      : 'border-[#D6CFC2]'
                  }`}
                />
                {fieldErrors['shippingAddress.state'] && (
                  <p className="mt-1 text-xs font-semibold text-[#961B1E]">
                    {fieldErrors['shippingAddress.state']}
                  </p>
                )}
              </div>

              <div className="sm:col-span-2">
                <label
                  htmlFor="ship-postal"
                  className="block text-xs font-semibold tracking-wider text-[#161311] uppercase"
                >
                  6-Digit PIN Code *
                </label>
                <input
                  id="ship-postal"
                  name="postal-code"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  autoComplete="shipping postal-code"
                  required
                  value={shippingAddress.postalCode}
                  onChange={(e) => {
                    markLogicalInputEdited();
                    setShippingAddress((prev) => ({ ...prev, postalCode: e.target.value }));
                  }}
                  aria-invalid={Boolean(fieldErrors['shippingAddress.postalCode'])}
                  aria-describedby="pin-serviceability-note"
                  placeholder="302029"
                  className={`mt-1.5 h-11 w-full max-w-xs border bg-[#F4F1EA] px-3.5 text-sm text-[#161311] tabular-nums ${
                    fieldErrors['shippingAddress.postalCode']
                      ? 'border-2 border-[#961B1E]'
                      : 'border-[#D6CFC2]'
                  }`}
                />
                {fieldErrors['shippingAddress.postalCode'] && (
                  <p className="mt-1 text-xs font-semibold text-[#961B1E]">
                    {fieldErrors['shippingAddress.postalCode']}
                  </p>
                )}
                <p id="pin-serviceability-note" className="mt-1.5 text-[11px] text-[#524B44]">
                  {quote?.serviceabilityNote ||
                    'Note: 6-digit PIN format validation does not establish courier delivery serviceability.'}
                </p>
              </div>
            </div>

            {/* Optional Separate Billing Address */}
            <div className="mt-6 border-t border-[#EAE4D8] pt-4">
              <label className="flex cursor-pointer items-center gap-2.5 text-xs font-semibold text-[#161311]">
                <input
                  type="checkbox"
                  checked={billingSameAsShipping}
                  onChange={(e) => {
                    markLogicalInputEdited();
                    setBillingSameAsShipping(e.target.checked);
                  }}
                  className="h-4 w-4 accent-[#7A1C1D]"
                />
                <span>Billing address is the same as shipping address</span>
              </label>

              {!billingSameAsShipping && (
                <div className="mt-4 grid grid-cols-1 gap-4 border border-[#D6CFC2] bg-[#F4F1EA] p-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label
                      htmlFor="bill-line1"
                      className="block text-xs font-semibold tracking-wider text-[#161311] uppercase"
                    >
                      Billing Street Address *
                    </label>
                    <input
                      id="bill-line1"
                      type="text"
                      autoComplete="billing address-line1"
                      value={billingAddress.line1}
                      onChange={(e) => {
                        markLogicalInputEdited();
                        setBillingAddress((prev) => ({ ...prev, line1: e.target.value }));
                      }}
                      className="mt-1 h-10 w-full border border-[#D6CFC2] bg-[#FAF8F5] px-3 text-sm"
                    />
                    {fieldErrors['billingAddress.line1'] && (
                      <p className="mt-1 text-xs font-semibold text-[#961B1E]">
                        {fieldErrors['billingAddress.line1']}
                      </p>
                    )}
                  </div>
                  <div>
                    <label
                      htmlFor="bill-city"
                      className="block text-xs font-semibold tracking-wider text-[#161311] uppercase"
                    >
                      Billing City *
                    </label>
                    <input
                      id="bill-city"
                      type="text"
                      autoComplete="billing address-level2"
                      value={billingAddress.city}
                      onChange={(e) => {
                        markLogicalInputEdited();
                        setBillingAddress((prev) => ({ ...prev, city: e.target.value }));
                      }}
                      className="mt-1 h-10 w-full border border-[#D6CFC2] bg-[#FAF8F5] px-3 text-sm"
                    />
                    {fieldErrors['billingAddress.city'] && (
                      <p className="mt-1 text-xs font-semibold text-[#961B1E]">
                        {fieldErrors['billingAddress.city']}
                      </p>
                    )}
                  </div>
                  <div>
                    <label
                      htmlFor="bill-postal"
                      className="block text-xs font-semibold tracking-wider text-[#161311] uppercase"
                    >
                      Billing PIN Code *
                    </label>
                    <input
                      id="bill-postal"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      autoComplete="billing postal-code"
                      value={billingAddress.postalCode}
                      onChange={(e) => {
                        markLogicalInputEdited();
                        setBillingAddress((prev) => ({ ...prev, postalCode: e.target.value }));
                      }}
                      className="mt-1 h-10 w-full border border-[#D6CFC2] bg-[#FAF8F5] px-3 text-sm"
                    />
                    {fieldErrors['billingAddress.postalCode'] && (
                      <p className="mt-1 text-xs font-semibold text-[#961B1E]">
                        {fieldErrors['billingAddress.postalCode']}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* 3. Connector-Determined Shipping Methods */}
          <section
            aria-labelledby="checkout-shipping-heading"
            className="border border-[#D6CFC2] bg-[#FAF8F5] p-6"
          >
            <h2
              id="checkout-shipping-heading"
              className="font-editorial text-2xl font-semibold text-[#161311]"
            >
              3. Shipping Method
            </h2>
            <p className="mt-1 text-xs text-[#524B44]">
              Shipping eligibility and dispatch timelines come from the connector quote.
            </p>

            <div className="mt-4 space-y-3">
              {quote?.shippingMethods.map((method) => {
                const isSelected = selectedShippingMethodId === method.id;
                return (
                  <label
                    key={method.id}
                    className={`flex items-start justify-between gap-4 border p-4 transition-colors duration-150 ${
                      !method.eligible
                        ? 'cursor-not-allowed border-[#D6CFC2] bg-[#EAE4D8]/50 opacity-75'
                        : isSelected
                          ? 'cursor-pointer border-[#161311] bg-[#F4F1EA]'
                          : 'cursor-pointer border-[#D6CFC2] bg-[#FAF8F5] hover:border-[#161311]'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="shippingMethod"
                        checked={isSelected}
                        disabled={!method.eligible}
                        onChange={() => {
                          markLogicalInputEdited();
                          setSelectedShippingMethodId(method.id);
                        }}
                        className="mt-1 h-4 w-4 accent-[#7A1C1D]"
                      />
                      <div className="text-xs">
                        <span className="font-semibold text-[#161311]">{method.title}</span>
                        <p className="mt-0.5 text-[#524B44]">
                          {method.dispatchEstimate} · {method.transitEstimate}
                        </p>
                        {method.ineligibilityReason && (
                          <p className="mt-1.5 text-[11px] text-[#7C4700]">
                            {method.ineligibilityReason}
                          </p>
                        )}
                      </div>
                    </div>

                    <span className="shrink-0 text-xs font-semibold text-[#161311] tabular-nums">
                      {method.requiresInquiry
                        ? 'By Inquiry'
                        : method.fee.amountMinor === 0
                          ? 'FREE'
                          : formatMoney(method.fee)}
                    </span>
                  </label>
                );
              })}
            </div>
          </section>

          {/* 4. Payment Method Placeholders (No Raw Card Collection) */}
          <section
            aria-labelledby="checkout-payment-heading"
            className="border border-[#D6CFC2] bg-[#FAF8F5] p-6"
          >
            <div className="flex items-center justify-between gap-2">
              <h2
                id="checkout-payment-heading"
                className="font-editorial text-2xl font-semibold text-[#161311]"
              >
                4. Payment Method Placeholder
              </h2>
              <Lock className="h-4 w-4 text-[#524B44]" aria-hidden="true" />
            </div>
            <p className="mt-1 text-xs text-[#524B44]">
              Stage A Prototype does not collect raw card or UPI credentials. In Stage B, the Kalp
              connector provides a verified payment intent or COD verification workflow.
            </p>

            <div className="mt-4 space-y-3">
              {quote?.paymentMethods.map((pm) => {
                const isSelected = selectedPaymentMethod === pm.code;
                return (
                  <label
                    key={pm.code}
                    className={`flex items-start gap-3 border p-4 transition-colors duration-150 ${
                      !pm.eligible
                        ? 'cursor-not-allowed border-[#D6CFC2] bg-[#EAE4D8]/50 opacity-70'
                        : isSelected
                          ? 'cursor-pointer border-[#161311] bg-[#F4F1EA]'
                          : 'cursor-pointer border-[#D6CFC2] bg-[#FAF8F5] hover:border-[#161311]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      checked={isSelected}
                      disabled={!pm.eligible}
                      onChange={() => {
                        markLogicalInputEdited();
                        setSelectedPaymentMethod(pm.code);
                      }}
                      className="mt-1 h-4 w-4 accent-[#7A1C1D]"
                    />
                    <div className="text-xs">
                      <span className="font-semibold text-[#161311]">{pm.title}</span>
                      <p className="mt-0.5 text-[#524B44]">{pm.description}</p>
                      {pm.ineligibilityReason && (
                        <p className="mt-1 font-semibold text-[#961B1E]">
                          {pm.ineligibilityReason}
                        </p>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          </section>
        </div>

        {/* Right Column: Sticky Authoritative Checkout Quote Summary */}
        <aside aria-label="Checkout quote summary" className="lg:sticky lg:top-24 lg:col-span-5">
          <div className="border border-[#D6CFC2] bg-[#FAF8F5] p-6">
            <div className="flex items-center justify-between border-b border-[#D6CFC2] pb-4">
              <div>
                <h2 className="font-editorial text-2xl font-semibold text-[#161311]">
                  Order &amp; Quote Summary
                </h2>
                <p className="text-[11px] text-[#524B44]">
                  Server-quoted minor-unit totals ({cart.itemCount} items)
                </p>
              </div>

              <button
                type="button"
                onClick={() => void requestCheckoutQuote(cart.revision)}
                disabled={quoteLoading}
                className="inline-flex h-9 items-center gap-1.5 border border-[#D6CFC2] bg-[#F4F1EA] px-3 text-[11px] font-semibold text-[#161311] hover:border-[#161311]"
              >
                <RefreshCw
                  className={`h-3 w-3 ${quoteLoading ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
                <span>Refresh Quote</span>
              </button>
            </div>

            {quoteError && (
              <div className="mt-4">
                <RecoverableErrorBanner
                  title="Quote Error"
                  message={quoteError.message}
                  onRetry={() => void requestCheckoutQuote(cart.revision)}
                />
              </div>
            )}

            {quoteNeedsRefresh && (
              <div
                role="alert"
                className="mt-4 border border-[#E8C79B] bg-[#FDF3E7] p-3.5 text-xs text-[#7C4700]"
              >
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <div>
                    <p className="font-semibold">
                      {cartOutOfSyncWithQuote
                        ? 'Your shopping bag was updated'
                        : 'Checkout quote has expired'}
                    </p>
                    <p className="mt-0.5">
                      Please refresh your quote before submitting to ensure current pricing and
                      variant availability.
                    </p>
                    <button
                      type="button"
                      onClick={() => void requestCheckoutQuote(cart.revision)}
                      className="mt-2 inline-flex h-8 items-center bg-[#7C4700] px-3 text-[11px] font-semibold text-[#FAF8F5] uppercase"
                    >
                      Refresh Quote Now
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Line Items in Quote */}
            <ul className="mt-4 max-h-72 divide-y divide-[#EAE4D8] overflow-y-auto border-b border-[#D6CFC2] pb-4">
              {(quote?.items ?? cart.items).map((item) => (
                <li key={item.lineItemId} className="flex items-center gap-3 py-3 first:pt-0">
                  <div className="w-14 shrink-0 border border-[#D6CFC2]">
                    <StudioImage asset={item.image} />
                  </div>
                  <div className="flex-1 text-xs">
                    <p className="font-semibold text-[#161311]">{item.productTitle}</p>
                    <p className="text-[11px] text-[#524B44]">
                      {Object.entries(item.selectedOptions)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(' · ')}{' '}
                      × {item.quantity}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-[#161311] tabular-nums">
                    {formatMoney(item.lineSubtotal)}
                  </span>
                </li>
              ))}
            </ul>

            {/* Authoritative Quote Breakdown */}
            {quote && (
              <div className="mt-4 space-y-2 text-xs tabular-nums">
                <div className="flex justify-between text-[#524B44]">
                  <span>Items MRP Total</span>
                  <span>{formatMoney(quote.totals.itemsSubtotal)}</span>
                </div>
                {quote.totals.discountTotal.amountMinor > 0 && (
                  <div className="flex justify-between font-semibold text-[#165B38]">
                    <span>Catalog Savings</span>
                    <span>− {formatMoney(quote.totals.discountTotal)}</span>
                  </div>
                )}
                <div className="flex justify-between text-[#524B44]">
                  <span>Standard Pan-India Shipping</span>
                  <span className="font-semibold text-[#165B38]">
                    {quote.totals.shippingFee.amountMinor === 0
                      ? 'FREE'
                      : formatMoney(quote.totals.shippingFee)}
                  </span>
                </div>
                <div className="flex justify-between text-[#6B6259]">
                  <span>Included GST (12% Apparel Est.)</span>
                  <span>{formatMoney(quote.totals.taxTotal)}</span>
                </div>
                <div className="flex items-baseline justify-between border-t border-[#D6CFC2] pt-3 text-base font-semibold text-[#161311]">
                  <span>Authoritative Quote Total</span>
                  <span>{formatMoney(quote.totals.payableTotal)}</span>
                </div>
              </div>
            )}

            {/* Submit Demo Order Action */}
            <div className="mt-6 space-y-3">
              <button
                type="submit"
                disabled={submitting || quoteLoading || quoteNeedsRefresh || !quote}
                aria-busy={submitting}
                className="inline-flex h-12 w-full items-center justify-center gap-2 bg-[#161311] px-6 text-xs font-semibold tracking-[0.16em] text-[#F4F1EA] uppercase transition-colors duration-150 hover:bg-[#7A1C1D] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    <span>Submitting Demo Order...</span>
                  </>
                ) : (
                  <span>
                    Submit Demo Order ({quote ? formatMoney(quote.totals.payableTotal) : '...'})
                  </span>
                )}
              </button>

              <div className="flex items-start gap-2 border border-[#D6CFC2] bg-[#F4F1EA] p-3 text-[11px] text-[#524B44]">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#7A1C1D]" aria-hidden="true" />
                <div>
                  <p className="font-semibold text-[#161311]">Stage A Demo Checkout Notice</p>
                  <p className="mt-0.5 leading-relaxed">
                    Submitting creates a labelled demo order record to demonstrate order vs. payment
                    status separation. No real order, shipment, or payment is created.{' '}
                    <button
                      type="button"
                      onClick={(e) => openPolicyDrawer('exchange', e.currentTarget)}
                      className="font-semibold text-[#7A1C1D] underline underline-offset-2"
                    >
                      Review 3-day exchange policy
                    </button>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </form>
    </div>
  );
}
