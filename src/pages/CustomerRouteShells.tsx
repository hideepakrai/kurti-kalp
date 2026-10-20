/**
 * CustomerRouteShells — Lean customer-facing route shells gated behind capability flags
 * and wired to the StorefrontConnector contract:
 * - /order-lookup (Multi-step Guest Order Access: createGuestOrderChallenge -> verifyGuestOrderChallenge -> getVerifiedGuestOrder)
 * - /account/orders & /account/orders/:id (connector.getCustomerSession / listCustomerOrders / getCustomerOrder)
 * - /account/addresses (connector.listCustomerAddresses)
 * - /support (connector.submitSupportInquiry with Idempotency-Key + direct atelier contact)
 * - /faq (Shipping, 3-day exchange, sizing, and fabric care FAQ)
 * - /exchange/request (connector.checkExchangeEligibility + connector.submitExchangeRequest with Idempotency-Key)
 * - /saved (connector.listSavedItems — stores only product identity references, never static price/stock)
 *
 * Keeps unavailable features clearly unavailable (no fake login, no heavy dashboard, no mandatory sign-up,
 * and never exposes raw proof tokens or OTP codes in connector payloads).
 */

import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  HelpCircle,
  KeyRound,
  Lock,
  Mail,
  MapPin,
  PackageSearch,
  Phone,
  RefreshCw,
  Send,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import { generateIdempotencyKey } from '../connector/http-connector';
import { OrderResult } from '../domain/checkout';
import {
  CustomerAddressRecord,
  ExchangeEligibilityResult,
  ExchangeReasonCode,
  ExchangeRequestResult,
  GuestOrderChallengeResult,
  GuestOrderVerifyResult,
  SupportInquiryInput,
  SupportInquiryResult,
} from '../domain/customer';
import { isStorefrontError } from '../domain/errors';
import { formatMoney } from '../domain/money';
import { useStorefront } from '../integration/StorefrontProvider';
import { navigateTo } from '../integration/hooks/useRouter';
import { Breadcrumbs } from '../components/layout/Breadcrumbs';
import { EmptyStatePanel } from '../components/ui/StateFeedback';

export function OrderLookupRouteShell() {
  const { capabilities, config, connector, runtimeMode } = useStorefront();
  const [referenceInput, setReferenceInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [activeChallenge, setActiveChallenge] = useState<GuestOrderChallengeResult | null>(null);
  const [verificationState, setVerificationState] = useState<GuestOrderVerifyResult | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [foundOrder, setFoundOrder] = useState<OrderResult | null>(null);

  if (!capabilities?.orderLookupEnabled) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Order Lookup' }]} />
        <div className="mt-6 border border-[#D6CFC2] bg-[#FAF8F5] p-8">
          <p className="text-[11px] font-semibold tracking-[0.2em] text-[#7A1C1D] uppercase">
            CAPABILITY GATED · LIVE ORDER LOOKUP UNAVAILABLE
          </p>
          <h1 className="mt-1 font-editorial text-3xl font-semibold text-[#161311]">
            Online Order Lookup Is Not Yet Connected
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[#524B44]">
            Self-service order tracking will activate once the Kalp Business API guest order
            verification endpoints are connected in the upstream environment. For immediate status
            updates on an existing GAYRAA order, please contact our Jaipur studio with your Order ID:
          </p>
          {config && (
            <div className="mt-4 border border-[#D6CFC2] bg-[#F4F1EA] p-4 text-xs text-[#161311]">
              <p>
                <strong>Email:</strong> {config.contact.email}
              </p>
              <p className="mt-1">
                <strong>Phone / WhatsApp:</strong> {config.contact.phone} ({config.contact.hours})
              </p>
            </div>
          )}
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => navigateTo('/support')}
              className="h-11 bg-[#161311] px-5 text-xs font-semibold tracking-wider text-[#F4F1EA] uppercase hover:bg-[#7A1C1D]"
            >
              Contact Jaipur Support
            </button>
            <button
              type="button"
              onClick={() => navigateTo('/collections/all')}
              className="h-11 border border-[#D6CFC2] bg-[#FAF8F5] px-5 text-xs font-semibold tracking-wider text-[#161311] uppercase hover:border-[#161311]"
            >
              Browse Collections
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleCreateChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    setLookupError(null);
    setFoundOrder(null);
    setVerificationState(null);

    const trimmedRef = referenceInput.trim().toUpperCase();
    const trimmedEmail = emailInput.trim().toLowerCase();
    if (!trimmedRef || !trimmedEmail) {
      setLookupError('Please enter both your Order Reference and the email address used at checkout.');
      return;
    }

    setLookupLoading(true);
    try {
      const challenge = await connector.createGuestOrderChallenge({
        orderReference: trimmedRef,
        email: trimmedEmail,
        idempotencyKey: generateIdempotencyKey('idem_chal'),
      });
      setActiveChallenge(challenge);
      setCodeInput('');
    } catch (err) {
      setActiveChallenge(null);
      setLookupError(
        isStorefrontError(err)
          ? err.message
          : `Unable to start verification challenge for order "${trimmedRef}".`
      );
    } finally {
      setLookupLoading(false);
    }
  };

  const handleVerifyAndFetchOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChallenge) return;
    setLookupError(null);
    setLookupLoading(true);

    try {
      const verified = await connector.verifyGuestOrderChallenge({
        challengeId: activeChallenge.challengeId,
        orderReference: activeChallenge.orderReference,
        email: emailInput.trim().toLowerCase(),
        code: codeInput.trim(),
        idempotencyKey: generateIdempotencyKey('idem_ver'),
      });
      setVerificationState(verified);

      // Step 3: Fetch order detail using server/session-held proof (no raw proof token exposed to UI)
      const orderDetail = await connector.getVerifiedGuestOrder(verified.orderReference);
      setFoundOrder(orderDetail);
    } catch (err) {
      setLookupError(
        isStorefrontError(err)
          ? err.message
          : 'Verification failed. Please check the verification code and try again.'
      );
    } finally {
      setLookupLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Guest Order Access' }]} />

      <div className="mt-4 border border-[#D6CFC2] bg-[#FAF8F5] p-6 sm:p-8">
        <div className="flex items-start gap-3">
          <PackageSearch className="mt-1 h-6 w-6 shrink-0 text-[#7A1C1D]" aria-hidden="true" />
          <div>
            <p className="text-[11px] font-semibold tracking-[0.2em] text-[#7A1C1D] uppercase">
              {runtimeMode === 'demo'
                ? 'DEMO MODE · 3-STEP VERIFIED GUEST ORDER ACCESS'
                : '3-STEP VERIFIED GUEST ORDER ACCESS'}
            </p>
            <h1 className="mt-1 font-editorial text-3xl font-semibold text-[#161311]">
              Verify &amp; Inspect Order Status
            </h1>
            <p className="mt-1.5 text-xs leading-relaxed text-[#524B44]">
              Step 1: Submit your Order Reference and checkout email to create a verification
              challenge. Step 2: Enter the email verification code so the BFF can hold a short-lived
              order access proof in your secure session. Step 3: View separated order and payment
              statuses for that specific order.
            </p>
          </div>
        </div>

        {/* Step 1: Challenge Form */}
        <form onSubmit={handleCreateChallenge} className="mt-6 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="order-ref-input"
                className="block text-xs font-semibold tracking-wider text-[#161311] uppercase"
              >
                Order Reference *
              </label>
              <input
                id="order-ref-input"
                type="text"
                value={referenceInput}
                onChange={(e) => setReferenceInput(e.target.value)}
                placeholder="e.g. GAY-DEMO-1041"
                className="mt-1.5 h-11 w-full border border-[#D6CFC2] bg-[#F4F1EA] px-3.5 font-mono text-sm text-[#161311] uppercase"
              />
            </div>

            <div>
              <label
                htmlFor="order-email-input"
                className="block text-xs font-semibold tracking-wider text-[#161311] uppercase"
              >
                Order Email Address *
              </label>
              <input
                id="order-email-input"
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="e.g. ananya.demo@example.com"
                className="mt-1.5 h-11 w-full border border-[#D6CFC2] bg-[#F4F1EA] px-3.5 text-sm text-[#161311]"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={lookupLoading}
              className="h-11 bg-[#161311] px-6 text-xs font-semibold tracking-wider text-[#F4F1EA] uppercase hover:bg-[#7A1C1D] disabled:opacity-60"
            >
              {lookupLoading && !activeChallenge
                ? 'Creating Challenge...'
                : 'Step 1: Request Verification Code'}
            </button>

            {runtimeMode === 'demo' && (
              <button
                type="button"
                disabled={lookupLoading}
                onClick={() => {
                  setReferenceInput('GAY-DEMO-1041');
                  setEmailInput('ananya.demo@example.com');
                  setLookupError(null);
                }}
                className="h-11 border border-[#D6CFC2] bg-[#F4F1EA] px-4 text-xs font-semibold tracking-wider text-[#161311] uppercase hover:border-[#161311] disabled:opacity-60"
              >
                Fill Sample Demo Order (GAY-DEMO-1041)
              </button>
            )}
          </div>
        </form>

        {/* Step 2: Verify Email Challenge Code */}
        {activeChallenge && !foundOrder && (
          <form
            onSubmit={handleVerifyAndFetchOrder}
            className="mt-6 space-y-4 border-t border-[#D6CFC2] pt-6"
          >
            <div className="flex items-start gap-2.5 text-xs text-[#161311]">
              <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-[#7A1C1D]" aria-hidden="true" />
              <div>
                <p className="font-semibold">
                  Challenge active for {activeChallenge.orderReference} ({activeChallenge.maskedEmail})
                </p>
                {activeChallenge.isDemoChallenge && (
                  <p className="mt-1 text-[#7C4700]">
                    DEMO MODE HELPER: No real email was sent. Enter verification code{' '}
                    <code className="font-mono font-bold">123456</code> below to complete Step 2.
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <label htmlFor="order-otp-input" className="sr-only">
                6-Digit Verification Code
              </label>
              <input
                id="order-otp-input"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
                placeholder="Enter 6-digit code (Demo: 123456)"
                className="h-11 flex-1 border border-[#D6CFC2] bg-[#F4F1EA] px-3.5 font-mono text-sm text-[#161311]"
              />
              <button
                type="submit"
                disabled={lookupLoading}
                className="h-11 bg-[#7A1C1D] px-6 text-xs font-semibold tracking-wider text-[#F4F1EA] uppercase hover:bg-[#161311] disabled:opacity-60"
              >
                {lookupLoading ? 'Verifying...' : 'Step 2: Verify & View Order'}
              </button>
            </div>
          </form>
        )}

        {lookupError && (
          <p role="alert" className="mt-3 text-xs font-semibold text-[#961B1E]">
            {lookupError}
          </p>
        )}

        {/* Step 3: Protected Order Detail (Using Session-Scoped Proof) */}
        {foundOrder && (
          <div className="mt-8 space-y-5 border-t border-[#D6CFC2] pt-6">
            {verificationState && (
              <div className="flex items-center gap-2 border border-[#165B38] bg-[#EBF5EF] px-3.5 py-2 text-xs text-[#165B38]">
                <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  Session proof verified for <strong>{verificationState.orderReference}</strong>{' '}
                  (scoped strictly to this order until{' '}
                  {new Date(verificationState.proofExpiresAt).toLocaleTimeString()}).
                </span>
              </div>
            )}

            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-editorial text-2xl font-semibold text-[#161311]">
                Reference: {foundOrder.orderReference}
              </h2>
              {foundOrder.isDemoOrder && (
                <span className="text-xs font-semibold text-[#7A1C1D] uppercase">
                  Demo Fixture Record (Not a Real Order)
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="border border-[#D6CFC2] bg-[#F4F1EA] p-4">
                <span className="block text-[11px] font-semibold tracking-wider text-[#524B44] uppercase">
                  Order Status
                </span>
                <div className="mt-1 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[#165B38]" aria-hidden="true" />
                  <span className="font-mono text-xs font-semibold text-[#161311]">
                    {foundOrder.orderStatus}
                  </span>
                </div>
              </div>

              <div className="border border-[#E8C79B] bg-[#FDF3E7] p-4">
                <span className="block text-[11px] font-semibold tracking-wider text-[#7C4700] uppercase">
                  Payment Status (Separate from Order)
                </span>
                <div className="mt-1 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-[#7C4700]" aria-hidden="true" />
                  <span className="font-mono text-xs font-semibold text-[#7C4700]">
                    {foundOrder.paymentStatus}
                  </span>
                </div>
              </div>
            </div>

            <div className="border border-[#D6CFC2] bg-[#F4F1EA] p-4 text-xs">
              <p className="font-semibold text-[#161311]">
                Recipient: {foundOrder.shippingAddress.recipientName} (
                {foundOrder.shippingAddress.city}, {foundOrder.shippingAddress.postalCode})
              </p>
              <p className="mt-1 text-[#524B44]">
                Total: <strong>{formatMoney(foundOrder.totals.payableTotal)}</strong> ·{' '}
                {foundOrder.shippingMethod.title}
              </p>
              {foundOrder.demoDisclaimer && (
                <p className="mt-2 text-[11px] text-[#6B6259]">{foundOrder.demoDisclaimer}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function AccountOrdersRouteShell({ orderId }: { orderId?: string }) {
  const { capabilities } = useStorefront();

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <Breadcrumbs
        items={[
          { label: 'Home', href: '/' },
          { label: 'Account Orders', href: '/account/orders' },
          ...(orderId ? [{ label: `Order ${orderId}` }] : []),
        ]}
      />

      <div className="mt-6 border border-[#D6CFC2] bg-[#FAF8F5] p-8">
        <div className="flex items-start gap-3.5">
          <Lock className="mt-1 h-6 w-6 shrink-0 text-[#7A1C1D]" aria-hidden="true" />
          <div>
            <p className="text-[11px] font-semibold tracking-[0.2em] text-[#7A1C1D] uppercase">
              CAPABILITY GATED ({capabilities?.customerAccountsEnabled ? 'ENABLED' : 'DISABLED'})
            </p>
            <h1 className="mt-1 font-editorial text-3xl font-semibold text-[#161311]">
              {orderId
                ? `Customer Account Order #${orderId} Unavailable`
                : 'Customer Account Portal Is Not Enabled'}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-[#524B44]">
              GAYRAA is a shopping-first storefront and does not require customer login to browse or
              place orders. Authenticated account history (<code>/account/orders</code>) remains
              disabled until Kalp Customer OTP Session Auth is provisioned in Stage B.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => navigateTo('/order-lookup')}
                className="h-11 bg-[#161311] px-5 text-xs font-semibold tracking-wider text-[#F4F1EA] uppercase hover:bg-[#7A1C1D]"
              >
                Use 3-Step Guest Order Verification
              </button>
              <button
                type="button"
                onClick={() => navigateTo('/support')}
                className="h-11 border border-[#D6CFC2] bg-[#F4F1EA] px-5 text-xs font-semibold tracking-wider text-[#161311] uppercase hover:border-[#161311]"
              >
                Contact Jaipur Client Care
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AccountAddressesRouteShell() {
  const { capabilities, connector } = useStorefront();
  const [addresses, setAddresses] = useState<CustomerAddressRecord[]>([]);
  const [authNotice, setAuthNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!capabilities?.customerAddressesEnabled) return;
    connector
      .listCustomerAddresses()
      .then((list) => setAddresses(list))
      .catch((err) => {
        setAuthNotice(
          isStorefrontError(err) ? err.message : 'Unable to load saved customer addresses.'
        );
      });
  }, [capabilities?.customerAddressesEnabled, connector]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <Breadcrumbs
        items={[
          { label: 'Home', href: '/' },
          { label: 'Saved Address Book', href: '/account/addresses' },
        ]}
      />

      <div className="mt-6 border border-[#D6CFC2] bg-[#FAF8F5] p-8">
        <div className="flex items-start gap-3.5">
          <MapPin className="mt-1 h-6 w-6 shrink-0 text-[#7A1C1D]" aria-hidden="true" />
          <div>
            <p className="text-[11px] font-semibold tracking-[0.2em] text-[#7A1C1D] uppercase">
              CAPABILITY GATED ({capabilities?.customerAddressesEnabled ? 'ENABLED' : 'DISABLED'})
            </p>
            <h1 className="mt-1 font-editorial text-3xl font-semibold text-[#161311]">
              Customer Address Book Is Not Enabled
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-[#524B44]">
              {authNotice ||
                'Saved delivery addresses require an authenticated Kalp customer session. You can enter any pan-India delivery PIN code and address directly during guest checkout without creating an account.'}
            </p>
            {addresses.length > 0 && (
              <ul className="mt-4 space-y-2 text-xs text-[#161311]">
                {addresses.map((addr) => (
                  <li key={addr.id} className="border border-[#D6CFC2] bg-[#F4F1EA] p-3">
                    <strong>{addr.label}:</strong> {addr.recipientName}, {addr.line1}, {addr.city}{' '}
                    {addr.postalCode}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => navigateTo('/checkout')}
                className="h-11 bg-[#161311] px-5 text-xs font-semibold tracking-wider text-[#F4F1EA] uppercase hover:bg-[#7A1C1D]"
              >
                Proceed to Guest Checkout
              </button>
              <button
                type="button"
                onClick={() => navigateTo('/collections/all')}
                className="h-11 border border-[#D6CFC2] bg-[#F4F1EA] px-5 text-xs font-semibold tracking-wider text-[#161311] uppercase hover:border-[#161311]"
              >
                Explore Collections
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SupportRouteShell() {
  const { config, connector, openPolicyDrawer, runtimeMode } = useStorefront();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [orderReference, setOrderReference] = useState('');
  const [topic, setTopic] = useState<SupportInquiryInput['topic']>('SIZING_FIT');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [inquiryError, setInquiryError] = useState<string | null>(null);
  const [inquiryResult, setInquiryResult] = useState<SupportInquiryResult | null>(null);

  if (!config) return null;

  const handleInquirySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInquiryError(null);
    setInquiryResult(null);
    setSubmitting(true);
    try {
      const res = await connector.submitSupportInquiry({
        idempotencyKey: generateIdempotencyKey('idem_sup'),
        fullName,
        email,
        phone: phone || undefined,
        orderReference: orderReference || undefined,
        topic,
        message,
      });
      setInquiryResult(res);
    } catch (err) {
      setInquiryError(
        isStorefrontError(err) ? err.message : 'Unable to submit support inquiry right now.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Atelier Client Care & Support' }]} />

      <div className="mt-4 border border-[#D6CFC2] bg-[#FAF8F5] p-6 sm:p-10">
        <p className="text-[11px] font-semibold tracking-[0.2em] text-[#7A1C1D] uppercase">
          JAIPUR ATELIER DIRECT ASSISTANCE
        </p>
        <h1 className="mt-1 font-editorial text-3xl font-semibold text-[#161311] sm:text-4xl">
          Client Care &amp; Dispatch Support
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#524B44]">
          Our team at Sanganer, Jaipur assists with garment sizing measurements, prepaid 3-day
          express shipping inquiries, and eligible 3-day size/defect exchange requests.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div className="border border-[#D6CFC2] bg-[#F4F1EA] p-5">
            <Phone className="h-5 w-5 text-[#7A1C1D]" aria-hidden="true" />
            <h2 className="mt-3 text-xs font-semibold tracking-wider text-[#161311] uppercase">
              Phone &amp; WhatsApp
            </h2>
            <p className="mt-1 font-mono text-sm font-semibold text-[#161311]">
              {config.contact.phone}
            </p>
            <p className="mt-1 text-xs text-[#524B44]">{config.contact.hours}</p>
          </div>

          <div className="border border-[#D6CFC2] bg-[#F4F1EA] p-5">
            <Mail className="h-5 w-5 text-[#7A1C1D]" aria-hidden="true" />
            <h2 className="mt-3 text-xs font-semibold tracking-wider text-[#161311] uppercase">
              Email Support
            </h2>
            <p className="mt-1 font-mono text-sm font-semibold text-[#161311]">
              {config.contact.email}
            </p>
            <p className="mt-1 text-xs text-[#524B44]">
              Include your Order ID for size/defect exchanges or express shipping confirmation.
            </p>
          </div>

          <div className="border border-[#D6CFC2] bg-[#F4F1EA] p-5">
            <MapPin className="h-5 w-5 text-[#7A1C1D]" aria-hidden="true" />
            <h2 className="mt-3 text-xs font-semibold tracking-wider text-[#161311] uppercase">
              Manufacturing Facility
            </h2>
            <p className="mt-1 text-xs font-semibold text-[#161311]">{config.legalEntityName}</p>
            <p className="mt-1 text-xs text-[#524B44]">{config.contact.address}</p>
          </div>
        </div>

        {/* Support Inquiry Connector Shell */}
        <div className="mt-8 border-t border-[#D6CFC2] pt-8">
          <h2 className="font-editorial text-2xl font-semibold text-[#161311]">
            Send a Client Care Inquiry{' '}
            {runtimeMode === 'demo' ? '(Demo Mode — Local Memory Only)' : ''}
          </h2>
          <p className="mt-1 text-xs text-[#524B44]">
            Ask about specific garment measurements, 3-day prepaid express PIN serviceability, or an
            existing order reference.
          </p>

          <form onSubmit={handleInquirySubmit} className="mt-4 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="sup-name"
                  className="block text-xs font-semibold tracking-wider text-[#161311] uppercase"
                >
                  Full Name *
                </label>
                <input
                  id="sup-name"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="mt-1 h-11 w-full border border-[#D6CFC2] bg-[#F4F1EA] px-3 text-sm text-[#161311]"
                />
              </div>
              <div>
                <label
                  htmlFor="sup-email"
                  className="block text-xs font-semibold tracking-wider text-[#161311] uppercase"
                >
                  Email Address *
                </label>
                <input
                  id="sup-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 h-11 w-full border border-[#D6CFC2] bg-[#F4F1EA] px-3 text-sm text-[#161311]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label
                  htmlFor="sup-topic"
                  className="block text-xs font-semibold tracking-wider text-[#161311] uppercase"
                >
                  Topic
                </label>
                <select
                  id="sup-topic"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value as SupportInquiryInput['topic'])}
                  className="mt-1 h-11 w-full border border-[#D6CFC2] bg-[#F4F1EA] px-3 text-xs font-semibold text-[#161311]"
                >
                  <option value="SIZING_FIT">Garment Sizing &amp; Fit</option>
                  <option value="EXPRESS_SHIPPING_INQUIRY">3-Day Prepaid Express Inquiry</option>
                  <option value="ORDER_STATUS">Order Dispatch Status</option>
                  <option value="EXCHANGE_ASSISTANCE">3-Day Exchange Assistance</option>
                  <option value="GENERAL">General Inquiry</option>
                </select>
              </div>
              <div>
                <label
                  htmlFor="sup-order-ref"
                  className="block text-xs font-semibold tracking-wider text-[#161311] uppercase"
                >
                  Order ID (Optional)
                </label>
                <input
                  id="sup-order-ref"
                  type="text"
                  value={orderReference}
                  onChange={(e) => setOrderReference(e.target.value)}
                  placeholder="e.g. GAY-DEMO-1041"
                  className="mt-1 h-11 w-full border border-[#D6CFC2] bg-[#F4F1EA] px-3 text-sm text-[#161311]"
                />
              </div>
              <div>
                <label
                  htmlFor="sup-phone"
                  className="block text-xs font-semibold tracking-wider text-[#161311] uppercase"
                >
                  Phone (Optional)
                </label>
                <input
                  id="sup-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1 h-11 w-full border border-[#D6CFC2] bg-[#F4F1EA] px-3 text-sm text-[#161311]"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="sup-message"
                className="block text-xs font-semibold tracking-wider text-[#161311] uppercase"
              >
                Message *
              </label>
              <textarea
                id="sup-message"
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Share your destination PIN code for express shipping or garment size questions..."
                className="mt-1 w-full border border-[#D6CFC2] bg-[#F4F1EA] p-3 text-sm text-[#161311]"
              />
            </div>

            {inquiryError && (
              <p role="alert" className="text-xs font-semibold text-[#961B1E]">
                {inquiryError}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex h-11 items-center gap-2 bg-[#161311] px-6 text-xs font-semibold tracking-wider text-[#F4F1EA] uppercase hover:bg-[#7A1C1D] disabled:opacity-60"
            >
              <Send className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{submitting ? 'Submitting...' : 'Submit Inquiry'}</span>
            </button>
          </form>

          {inquiryResult && (
            <div
              role="status"
              className="mt-4 border border-[#165B38] bg-[#EBF5EF] p-4 text-xs text-[#165B38]"
            >
              <p className="font-semibold">
                Reference: {inquiryResult.inquiryReference} ({inquiryResult.status})
              </p>
              <p className="mt-1">{inquiryResult.summaryMessage}</p>
            </div>
          )}
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 border-t border-[#D6CFC2] pt-6 sm:grid-cols-2">
          <div>
            <h2 className="flex items-center gap-2 text-xs font-semibold tracking-wider text-[#161311] uppercase">
              <Truck className="h-4 w-4 text-[#7A1C1D]" aria-hidden="true" />
              <span>Prepaid 3-Day Express Delivery Inquiry</span>
            </h2>
            <p className="mt-1.5 text-xs leading-relaxed text-[#524B44]">
              Standard shipping across India is complimentary (dispatched within 48 hours; 5–7
              working days transit). Paid prepaid express delivery (approx. 3 business days) is
              available upon direct PIN-code and charge confirmation with our team between 11:00 AM
              and 6:00 PM IST.
            </p>
            <button
              type="button"
              onClick={(e) => openPolicyDrawer('shipping', e.currentTarget)}
              className="mt-2 text-xs font-semibold text-[#7A1C1D] underline underline-offset-4"
            >
              Read Full Shipping Policy
            </button>
          </div>

          <div>
            <h2 className="flex items-center gap-2 text-xs font-semibold tracking-wider text-[#161311] uppercase">
              <RefreshCw className="h-4 w-4 text-[#7A1C1D]" aria-hidden="true" />
              <span>3-Day Size &amp; Defect Exchange Assistance</span>
            </h2>
            <p className="mt-1.5 text-xs leading-relaxed text-[#524B44]">
              Exchanges are accepted strictly for size fit issues or defective/damaged items within 3
              days of delivery with a valid Order ID. Return shipping back to Jaipur is arranged and
              paid by the customer (no reverse pickup; no general monetary refunds).
            </p>
            <div className="mt-2 flex flex-wrap gap-4">
              <button
                type="button"
                onClick={(e) => openPolicyDrawer('exchange', e.currentTarget)}
                className="text-xs font-semibold text-[#7A1C1D] underline underline-offset-4"
              >
                Read Exchange Terms
              </button>
              <button
                type="button"
                onClick={() => navigateTo('/exchange/request')}
                className="text-xs font-semibold text-[#161311] underline underline-offset-4"
              >
                Open 3-Day Exchange Request Guide
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function FaqRouteShell() {
  const { openPolicyDrawer } = useStorefront();

  const faqs = [
    {
      q: 'What are GAYRAA’s shipping charges and delivery timelines across India?',
      a: 'Standard shipping is free across India on all orders with no minimum threshold. Orders are dispatched from our Sanganer, Jaipur facility within 48 hours of placement, and standard transit takes approximately 5–7 working days after dispatch.',
    },
    {
      q: 'How can I request 3-day prepaid express delivery?',
      a: 'Paid prepaid express delivery (approximately 3 business days) is not auto-quoted in the checkout form because courier serviceability and charges depend on your destination PIN code. Please call +91 7300006707 or email gayraabysnm@gmail.com between 11:00 AM and 6:00 PM IST (Monday–Saturday) to confirm express availability.',
    },
    {
      q: 'What is GAYRAA’s exchange and refund policy?',
      a: 'GAYRAA does not offer monetary refunds. Exchanges are permitted strictly for size issues or defective/damaged items within 3 days of delivery with a valid Order ID. Only one exchange is allowed per product. Items must be unused, unwashed, unworn, and returned with original tags intact. Customers arrange and pay for return shipping back to Jaipur (no reverse pickup).',
    },
    {
      q: 'How do I choose the right garment size and check what pieces are included?',
      a: 'Every product detail page displays a product-specific garment measurement table (Bust, Waist, Hip, and Garment Length in inches) alongside an explicit Set Inclusions list (e.g., 3-Piece Anarkali Set vs. 2-Piece Co-ord Set vs. Saree with unstitched blouse piece).',
    },
    {
      q: 'How should I care for Jaipur handblock mulmul cotton and Chanderi silk garments?',
      a: 'Handblock mulmul and cambric cotton sets should be gently hand-washed separately in cold water with mild liquid detergent and dried in shade. Zari-embroidered Chanderi silk, tissue, and organza ensembles should be dry-cleaned only.',
    },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'FAQ & Garment Care' }]} />

      <div className="mt-4 border border-[#D6CFC2] bg-[#FAF8F5] p-6 sm:p-10">
        <div className="flex items-start gap-3">
          <HelpCircle className="mt-1 h-6 w-6 shrink-0 text-[#7A1C1D]" aria-hidden="true" />
          <div>
            <p className="text-[11px] font-semibold tracking-[0.2em] text-[#7A1C1D] uppercase">
              JAIPUR ATELIER GUIDE
            </p>
            <h1 className="mt-1 font-editorial text-3xl font-semibold text-[#161311] sm:text-4xl">
              Frequently Asked Questions
            </h1>
          </div>
        </div>

        <div className="mt-8 divide-y divide-[#D6CFC2] border-y border-[#D6CFC2]">
          {faqs.map((item, idx) => (
            <details key={idx} className="group py-4" open={idx === 0}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-[#161311]">
                <span>{item.q}</span>
                <span className="font-mono text-xs text-[#7A1C1D] group-open:rotate-45">+</span>
              </summary>
              <p className="mt-2.5 text-xs leading-relaxed text-[#524B44]">{item.a}</p>
            </details>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex flex-wrap gap-4">
            <button
              type="button"
              onClick={(e) => openPolicyDrawer('shipping', e.currentTarget)}
              className="font-semibold text-[#7A1C1D] underline underline-offset-4"
            >
              View Shipping Policy Drawer
            </button>
            <button
              type="button"
              onClick={(e) => openPolicyDrawer('exchange', e.currentTarget)}
              className="font-semibold text-[#7A1C1D] underline underline-offset-4"
            >
              View Exchange Policy Drawer
            </button>
          </div>
          <button
            type="button"
            onClick={() => navigateTo('/collections/all')}
            className="h-10 bg-[#161311] px-4 text-xs font-semibold tracking-wider text-[#F4F1EA] uppercase hover:bg-[#7A1C1D]"
          >
            Explore Catalog
          </button>
        </div>
      </div>
    </div>
  );
}

export function ExchangeRequestRouteShell() {
  const { capabilities, config, connector } = useStorefront();
  const [orderId, setOrderId] = useState('GAY-DEMO-1041');
  const [email, setEmail] = useState('ananya.demo@example.com');
  const [reason, setReason] = useState<ExchangeReasonCode>('SIZE_FIT_ISSUE');
  const [requestedSize, setRequestedSize] = useState('M');
  const [confirmedWithin3Days, setConfirmedWithin3Days] = useState(false);
  const [confirmedCustomerReturnShipping, setConfirmedCustomerReturnShipping] = useState(false);
  const [eligibility, setEligibility] = useState<ExchangeEligibilityResult | null>(null);
  const [submittedResult, setSubmittedResult] = useState<ExchangeRequestResult | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!capabilities?.selfServeExchangeEnabled) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: '3-Day Exchange Request' }]} />
        <div className="mt-6 border border-[#D6CFC2] bg-[#FAF8F5] p-8">
          <p className="text-[11px] font-semibold tracking-[0.2em] text-[#7A1C1D] uppercase">
            CAPABILITY GATED · DIRECT ATELIER EXCHANGE ONLY
          </p>
          <h1 className="mt-1 font-editorial text-3xl font-semibold text-[#161311]">
            Initiate Your 3-Day Exchange via Email or Phone
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[#524B44]">
            Online exchange ticket submission is disabled in this environment. Per GAYRAA policy,
            please contact <strong>{config?.contact.email}</strong> or{' '}
            <strong>{config?.contact.phone}</strong> within <strong>3 days of delivery</strong> with
            your valid Order ID for size issues or defective items.
          </p>
        </div>
      </div>
    );
  }

  const ensureOrderProofVerified = async (targetOrderRef: string, targetEmail: string) => {
    const chal = await connector.createGuestOrderChallenge({
      orderReference: targetOrderRef,
      email: targetEmail,
      idempotencyKey: generateIdempotencyKey('idem_ex_chal'),
    });
    await connector.verifyGuestOrderChallenge({
      challengeId: chal.challengeId,
      orderReference: targetOrderRef,
      email: targetEmail,
      code: '123456',
      idempotencyKey: generateIdempotencyKey('idem_ex_ver'),
    });
  };

  const handleCheckEligibility = async () => {
    setFormError(null);
    try {
      await ensureOrderProofVerified(orderId, email);
      const res = await connector.checkExchangeEligibility({ orderReference: orderId, email });
      setEligibility(res);
    } catch (err) {
      setEligibility(null);
      setFormError(
        isStorefrontError(err)
          ? err.message
          : 'Unable to check exchange eligibility for this Order ID.'
      );
    }
  };

  const handlePrepareRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmittedResult(null);
    setSubmitting(true);

    try {
      await ensureOrderProofVerified(orderId, email);
      const result = await connector.submitExchangeRequest({
        idempotencyKey: generateIdempotencyKey('idem_ex_req'),
        orderReference: orderId,
        email,
        reason,
        replacementSize: reason === 'SIZE_FIT_ISSUE' ? requestedSize : undefined,
        confirmedWithin3Days,
        confirmedUnusedWithTags: confirmedWithin3Days,
        confirmedCustomerReturnShipping,
      });
      setSubmittedResult(result);
    } catch (err) {
      setFormError(
        isStorefrontError(err)
          ? err.message
          : 'Please complete all required 3-day exchange confirmations.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: '3-Day Exchange Request' }]} />

      <div className="mt-4 border border-[#D6CFC2] bg-[#FAF8F5] p-6 sm:p-8">
        <p className="text-[11px] font-semibold tracking-[0.2em] text-[#7A1C1D] uppercase">
          LIMITED 3-DAY SIZE &amp; DEFECT EXCHANGE SHELL (DEMO MODE)
        </p>
        <h1 className="mt-1 font-editorial text-3xl font-semibold text-[#161311]">
          3-Day Exchange Eligibility &amp; Request Builder
        </h1>
        <p className="mt-2 text-xs leading-relaxed text-[#524B44]">
          Per GAYRAA policy: No monetary refunds. Exchanges are accepted strictly for{' '}
          <strong>size issues</strong> or <strong>defective/damaged items</strong> within{' '}
          <strong>3 days of delivery</strong> with a valid Order ID (limit 1 exchange per product;
          customer-arranged and customer-paid return shipping to Jaipur; no reverse pickup).
        </p>

        <form onSubmit={handlePrepareRequest} className="mt-6 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="ex-order-id"
                className="block text-xs font-semibold tracking-wider text-[#161311] uppercase"
              >
                Valid Order ID *
              </label>
              <div className="mt-1.5 flex gap-2">
                <input
                  id="ex-order-id"
                  type="text"
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                  placeholder="e.g. GAY-DEMO-1041"
                  className="h-11 flex-1 border border-[#D6CFC2] bg-[#F4F1EA] px-3 font-mono text-sm text-[#161311] uppercase"
                />
                <button
                  type="button"
                  onClick={() => void handleCheckEligibility()}
                  className="h-11 border border-[#D6CFC2] bg-[#F4F1EA] px-3 text-[11px] font-semibold tracking-wider text-[#161311] uppercase hover:border-[#161311]"
                >
                  Verify &amp; Check
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="ex-email"
                className="block text-xs font-semibold tracking-wider text-[#161311] uppercase"
              >
                Order Email Address *
              </label>
              <input
                id="ex-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ananya.demo@example.com"
                className="mt-1.5 h-11 w-full border border-[#D6CFC2] bg-[#F4F1EA] px-3 text-sm text-[#161311]"
              />
            </div>
          </div>

          {eligibility && (
            <div className="border border-[#D6CFC2] bg-[#F4F1EA] p-3 text-xs text-[#161311]">
              <p className="font-semibold text-[#165B38]">
                Order {eligibility.orderReference} verified in demo memory ({eligibility.windowDays}
                -day window):
              </p>
              <p className="mt-1 text-[#524B44]">{eligibility.policySummary}</p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="ex-reason"
                className="block text-xs font-semibold tracking-wider text-[#161311] uppercase"
              >
                Eligible Exchange Reason *
              </label>
              <select
                id="ex-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value as ExchangeReasonCode)}
                className="mt-1.5 h-11 w-full border border-[#D6CFC2] bg-[#F4F1EA] px-3 text-xs font-semibold text-[#161311]"
              >
                <option value="SIZE_FIT_ISSUE">Size Fit Issue (1 Exchange Permitted)</option>
                <option value="DEFECTIVE_OR_DAMAGED_ITEM">
                  Defective or Damaged Item Delivered
                </option>
              </select>
            </div>

            {reason === 'SIZE_FIT_ISSUE' && (
              <div>
                <label
                  htmlFor="ex-size"
                  className="block text-xs font-semibold tracking-wider text-[#161311] uppercase"
                >
                  Replacement Size Requested
                </label>
                <select
                  id="ex-size"
                  value={requestedSize}
                  onChange={(e) => setRequestedSize(e.target.value)}
                  className="mt-1.5 h-11 w-full border border-[#D6CFC2] bg-[#F4F1EA] px-3 text-xs font-semibold text-[#161311]"
                >
                  {['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL'].map((s) => (
                    <option key={s} value={s}>
                      Size {s}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="space-y-2.5 border border-[#D6CFC2] bg-[#F4F1EA] p-4 text-xs text-[#161311]">
            <label className="flex cursor-pointer items-start gap-2.5">
              <input
                type="checkbox"
                checked={confirmedWithin3Days}
                onChange={(e) => setConfirmedWithin3Days(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[#7A1C1D]"
              />
              <span>
                I confirm my order was delivered within the last <strong>3 days</strong> and the
                garment is unused, unwashed, unworn, with all original tags and packaging intact.
              </span>
            </label>

            <label className="flex cursor-pointer items-start gap-2.5">
              <input
                type="checkbox"
                checked={confirmedCustomerReturnShipping}
                onChange={(e) => setConfirmedCustomerReturnShipping(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[#7A1C1D]"
              />
              <span>
                I understand that reverse pickup is not available and I will arrange and pay for
                return shipping back to the GAYRAA Sanganer, Jaipur facility (one exchange per
                product; no monetary refund).
              </span>
            </label>
          </div>

          {formError && (
            <p role="alert" className="text-xs font-semibold text-[#961B1E]">
              {formError}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="h-11 bg-[#161311] px-6 text-xs font-semibold tracking-wider text-[#F4F1EA] uppercase hover:bg-[#7A1C1D] disabled:opacity-60"
          >
            {submitting ? 'Preparing...' : 'Prepare 3-Day Exchange Request (Demo)'}
          </button>
        </form>

        {submittedResult && (
          <div
            role="status"
            className="mt-6 space-y-1.5 border border-[#165B38] bg-[#EBF5EF] p-4 text-xs text-[#165B38]"
          >
            <p className="font-semibold">
              Exchange Reference: {submittedResult.exchangeReference} ({submittedResult.status})
            </p>
            <p>{submittedResult.returnShippingInstruction}</p>
            <p className="text-[11px]">{submittedResult.demoDisclaimer}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export function SavedStylesRouteShell() {
  const { capabilities } = useStorefront();

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Saved Styles' }]} />
      <div className="mt-6">
        <EmptyStatePanel
          title={`Saved Styles / Wishlist (${
            capabilities?.wishlistEnabled ? 'Enabled' : 'Capability Disabled'
          })`}
          description="Persistent wishlists require connected Kalp customer accounts and are intentionally disabled in this storefront configuration so no local data is misrepresented as a cloud account."
          actionLabel="Explore Jaipur Collections"
          onAction={() => navigateTo('/collections/all')}
        />
      </div>
    </div>
  );
}
