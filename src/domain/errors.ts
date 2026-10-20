/**
 * Typed domain and connector error models.
 * Maps connector and BFF failures to clear, recoverable customer-facing messages.
 */

export type StorefrontErrorCode =
  | 'NETWORK_FAILURE'
  | 'TIMEOUT_ERROR'
  | 'REQUEST_ABORTED'
  | 'UPSTREAM_UNAVAILABLE'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'UNAVAILABLE_VARIANT'
  | 'INSUFFICIENT_STOCK'
  | 'CART_CONFLICT'
  | 'QUOTE_EXPIRED'
  | 'IDEMPOTENCY_CONFLICT'
  | 'UNSUPPORTED_CAPABILITY';

export interface FieldValidationIssue {
  field: string;
  message: string;
}

export class StorefrontError extends Error {
  public readonly code: StorefrontErrorCode;
  public readonly recoverable: boolean;
  public readonly statusCode?: number;
  public readonly fieldIssues?: FieldValidationIssue[];
  public readonly latestCartRevision?: string;

  constructor(options: {
    code: StorefrontErrorCode;
    message: string;
    recoverable?: boolean;
    statusCode?: number;
    fieldIssues?: FieldValidationIssue[];
    latestCartRevision?: string;
  }) {
    super(options.message);
    this.name = 'StorefrontError';
    this.code = options.code;
    this.recoverable = options.recoverable ?? true;
    this.statusCode = options.statusCode;
    this.fieldIssues = options.fieldIssues;
    this.latestCartRevision = options.latestCartRevision;
  }
}

export function isStorefrontError(err: unknown): err is StorefrontError {
  return err instanceof StorefrontError;
}
