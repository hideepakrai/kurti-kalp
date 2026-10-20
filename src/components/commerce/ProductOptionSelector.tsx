/**
 * ProductOptionSelector — Product-specific option selector.
 *
 * Rules enforced:
 * - Does not select an arbitrary size automatically.
 * - Resolves valid purchasable variants from actual product.variants rather than
 *   manufacturing combinations.
 * - Provides clear hover, selected, unavailable, and keyboard-focus states.
 * - Explains unavailable choices to the shopper.
 */

import React from 'react';
import { ProductOptionDefinition, ProductVariant } from '../../domain/catalog';

interface ProductOptionSelectorProps {
  optionDefinitions: ProductOptionDefinition[];
  variants: ProductVariant[];
  selectedOptions: Record<string, string>;
  onSelectOption: (optionName: string, value: string) => void;
  onOpenSizeGuide?: (triggerEl: HTMLElement) => void;
  validationMessage?: string | null;
}

export function ProductOptionSelector({
  optionDefinitions,
  variants,
  selectedOptions,
  onSelectOption,
  onOpenSizeGuide,
  validationMessage,
}: ProductOptionSelectorProps) {
  /**
   * Determines whether choosing `value` for `optionName` matches at least one
   * variant in `variants` (considering any other already-selected options), and
   * whether that matching variant is in stock.
   */
  const getValueStatus = (
    optionName: string,
    value: string
  ): {
    existsInMatrix: boolean;
    isPurchasable: boolean;
    isLowStock: boolean;
    unavailableExplanation?: string;
  } => {
    // Match against other currently selected option axes
    const matchingWithCurrentSelections = variants.filter((v) => {
      if (v.selectedOptions[optionName] !== value) return false;
      for (const [otherKey, otherVal] of Object.entries(selectedOptions)) {
        if (otherKey !== optionName && otherVal && v.selectedOptions[otherKey] !== otherVal) {
          return false;
        }
      }
      return true;
    });

    // Also check if this value exists anywhere on the product at all
    const matchingAny = variants.filter((v) => v.selectedOptions[optionName] === value);
    const pool =
      matchingWithCurrentSelections.length > 0 ? matchingWithCurrentSelections : matchingAny;

    if (pool.length === 0) {
      return {
        existsInMatrix: false,
        isPurchasable: false,
        isLowStock: false,
        unavailableExplanation: `${optionName} ${value} is not offered for this style.`,
      };
    }

    const purchasableInCurrentCombo = matchingWithCurrentSelections.some(
      (v) => v.availability !== 'OUT_OF_STOCK'
    );
    const purchasableAnywhere = matchingAny.some((v) => v.availability !== 'OUT_OF_STOCK');

    if (matchingWithCurrentSelections.length > 0 && !purchasableInCurrentCombo) {
      const sample = matchingWithCurrentSelections[0];
      return {
        existsInMatrix: true,
        isPurchasable: false,
        isLowStock: false,
        unavailableExplanation:
          sample.unavailableReason || `${optionName} ${value} is currently out of stock.`,
      };
    }

    if (matchingWithCurrentSelections.length === 0 && purchasableAnywhere) {
      return {
        existsInMatrix: false,
        isPurchasable: true, // Selecting it will switch to a valid combination that has this value
        isLowStock: matchingAny.some((v) => v.availability === 'LOW_STOCK'),
        unavailableExplanation: `Not available in current combination; selecting will update other options.`,
      };
    }

    const isLowStock = pool.some((v) => v.availability === 'LOW_STOCK');
    return {
      existsInMatrix: true,
      isPurchasable: purchasableAnywhere,
      isLowStock,
    };
  };

  return (
    <div className="space-y-5">
      {optionDefinitions.map((optDef) => {
        const currentSelectedValue = selectedOptions[optDef.name];
        const isSizeAxis = optDef.name.toLowerCase().includes('size');

        // Check if any value on this axis is out of stock so we can explain it
        const outOfStockNotices = optDef.values
          .map((val) => ({ val, status: getValueStatus(optDef.name, val) }))
          .filter((item) => !item.status.isPurchasable && item.status.unavailableExplanation);

        return (
          <fieldset key={optDef.id} className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <legend className="text-xs font-semibold tracking-wider text-[#161311] uppercase">
                {optDef.name}:{' '}
                <span className="font-normal text-[#524B44]">
                  {currentSelectedValue || 'Select an option'}
                </span>
              </legend>

              {isSizeAxis && onOpenSizeGuide && (
                <button
                  type="button"
                  onClick={(e) => onOpenSizeGuide(e.currentTarget)}
                  className="text-xs font-semibold text-[#7A1C1D] underline decoration-[#7A1C1D]/60 underline-offset-4 transition-colors duration-150 hover:text-[#161311]"
                >
                  Garment Size Guide (Inches)
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={optDef.name}>
              {optDef.values.map((val) => {
                const isSelected = currentSelectedValue === val;
                const status = getValueStatus(optDef.name, val);
                const isDisabled = !status.isPurchasable;

                return (
                  <button
                    key={val}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    aria-disabled={isDisabled}
                    disabled={isDisabled}
                    onClick={() => onSelectOption(optDef.name, val)}
                    title={status.unavailableExplanation}
                    className={`relative inline-flex min-h-[44px] min-w-[54px] items-center justify-center border px-3.5 py-2 text-xs font-semibold tracking-wider transition-colors duration-150 ${
                      isSelected
                        ? 'border-[#161311] bg-[#161311] text-[#F4F1EA]'
                        : isDisabled
                          ? 'cursor-not-allowed border-[#D6CFC2] bg-[#EAE4D8]/60 text-[#6B6259] line-through opacity-60'
                          : 'border-[#D6CFC2] bg-[#FAF8F5] text-[#161311] hover:border-[#161311] hover:bg-[#EAE4D8]'
                    }`}
                  >
                    <span>{val}</span>
                    {isDisabled && <span className="sr-only"> (Unavailable)</span>}
                  </button>
                );
              })}
            </div>

            {outOfStockNotices.length > 0 && (
              <p className="text-[11px] text-[#524B44]">
                {outOfStockNotices.map((n) => n.status.unavailableExplanation).join(' ')}
              </p>
            )}
          </fieldset>
        );
      })}

      {validationMessage && (
        <p role="alert" className="border border-[#E5B4B5] bg-[#FDECEC] px-3 py-2 text-xs font-semibold text-[#961B1E]">
          {validationMessage}
        </p>
      )}
    </div>
  );
}
