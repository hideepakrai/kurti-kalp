/**
 * Framework-independent Money domain contract.
 * Enforces safe integer minor-unit amounts while remaining currency-neutral.
 */

export interface Money {
  amountMinor: number;
  currency: string;
  minorUnitDigits: number;
}

export function assertValidMoney(money: Money, context = 'Money'): void {
  if (!Number.isSafeInteger(money.amountMinor)) {
    throw new Error(`${context}: amountMinor must be a safe integer (received ${money.amountMinor})`);
  }
  if (!money.currency || typeof money.currency !== 'string' || money.currency.trim().length !== 3) {
    throw new Error(`${context}: currency must be a 3-letter ISO code (received "${money.currency}")`);
  }
  if (!Number.isInteger(money.minorUnitDigits) || money.minorUnitDigits < 0 || money.minorUnitDigits > 4) {
    throw new Error(`${context}: invalid minorUnitDigits (${money.minorUnitDigits})`);
  }
}

export function createMoney(amountMinor: number, currency = 'INR', minorUnitDigits = 2): Money {
  const money: Money = { amountMinor, currency, minorUnitDigits };
  assertValidMoney(money);
  return money;
}

/**
 * UI formatting helper for Money objects.
 * Does not perform authoritative price math; formats connector-returned Money values.
 */
export function formatMoney(money: Money, locale = 'en-IN'): string {
  assertValidMoney(money);
  const divisor = Math.pow(10, money.minorUnitDigits);
  const majorValue = money.amountMinor / divisor;
  const hasSubunits = money.amountMinor % divisor !== 0;

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: money.currency,
    minimumFractionDigits: hasSubunits ? money.minorUnitDigits : 0,
    maximumFractionDigits: money.minorUnitDigits,
  }).format(majorValue);
}
