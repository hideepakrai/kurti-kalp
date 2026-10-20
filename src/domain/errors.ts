/**
 * Typed domain and connector error models.
 * Maps connector and BFF failures to clear, recoverable customer-facing messages
 * with correlation ID and retry metadata. Never exposes upstream URLs, credentials,
 * tenant DB names, or proof tokens.
 */

export type StorefrontErrorCode =
  | 'NETWORK_FAILURE'
  | 'OFFLINE_ERROR'
  | 'TIMEOUT_ERROR'
  | 'REQUEST_ABORTED'
  | 'RATE_LIMITED'
  | 'SERVER_ERROR'
  | 'BAD_GATEWAY'
  | 'UPSTREAM_UNAVAILABLE'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'SESSION_EXPIRED'
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
  public readonly correlationId?: string;
  public readonly retryAfterSeconds?: number;
  public readonly fieldIssues?: FieldValidationIssue[];
  public readonly latestCartRevision?: string;

  constructor(options: {
    code: StorefrontErrorCode;
    message: string;
    recoverable?: boolean;
    statusCode?: number;
    correlationId?: string;
    retryAfterSeconds?: number;
    fieldIssues?: FieldValidationIssue[];
    latestCartRevision?: string;
  }) {
    super(options.message);
    this.name = 'StorefrontError';
    this.code = options.code;
    this.recoverable = options.recoverable ?? true;
    this.statusCode = options.statusCode;
    this.correlationId = options.correlationId;
    this.retryAfterSeconds = options.retryAfterSeconds;
    this.fieldIssues = options.fieldIssues;
    this.latestCartRevision = options.latestCartRevision;
  }
}

export function isStorefrontError(err: unknown): err is StorefrontError {
  return err instanceof StorefrontError;
}
