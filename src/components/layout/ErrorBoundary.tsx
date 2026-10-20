/**
 * ErrorBoundary — Catches unexpected rendering errors in the storefront shell
 * or route templates and displays an editorial recovery view.
 */

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage:
        error instanceof Error
          ? error.message
          : 'An unexpected rendering issue occurred in the storefront.',
    };
  }

  handleReset = () => {
    this.setState({ hasError: false, errorMessage: '' });
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="flex min-h-screen flex-col items-center justify-center bg-[#F4F1EA] px-4 py-16 text-[#161311]"
        >
          <div className="w-full max-w-xl border border-[#D6CFC2] bg-[#FAF8F5] p-8">
            <div className="flex items-start gap-4">
              <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-[#961B1E]" aria-hidden="true" />
              <div>
                <p className="text-[11px] font-semibold tracking-[0.2em] text-[#961B1E] uppercase">
                  STOREFRONT APPLICATION BOUNDARY
                </p>
                <h1 className="mt-1 font-editorial text-3xl font-semibold text-[#161311]">
                  Something Interrupted This View
                </h1>
                <p className="mt-2 text-xs leading-relaxed text-[#524B44]">
                  {this.state.errorMessage}
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={this.handleReset}
                    className="inline-flex h-11 items-center gap-2 bg-[#161311] px-5 text-xs font-semibold tracking-wider text-[#F4F1EA] uppercase hover:bg-[#7A1C1D]"
                  >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Return to Storefront Home</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
