import { formatNumber } from '@/lib/utils';
import type { ConstraintDisplayProps } from '@/lib/types/constraintTypes';

/**
 * Shared constraint display component
 * Handles all constraint types: single max, range, currency, shares
 */
export function ConstraintDisplay({
  constraintInfo,
  displayType,
  maxValue,
  hardLimit,
  boardLimit,
  valueLabel = '',
  formatOptions = { currency: false, decimals: 0 },
  minValue,
  maxValueRange,
  hardMinValue,
  hardMaxValue,
  boardMinValue,
  boardMaxValue,
  rangeLabel = '',
  currentBalance: _currentBalance,
  sharePrice,
  formatValue
}: ConstraintDisplayProps) {
  if (!constraintInfo) return null;

  const { limitingConstraint, constraintReason, isBlocked, blockReason, isLimited } = constraintInfo;

  // If blocked, show blocked message
  if (isBlocked) {
    return (
      <div className="space-y-2 mt-2">
        <div className="text-xs font-bold px-2 py-1 rounded bg-red-600 text-white inline-block">
          BLOCKED
        </div>
        <div className="text-xs text-red-700 bg-red-50 rounded p-2 border border-red-200">
          <span className="font-semibold">Operation Blocked</span>
          {' by '}
          <span className="font-medium">Board</span>
          {': '}
          <span className="italic">{blockReason || constraintReason}</span>
        </div>
      </div>
    );
  }

  // Format value helper
  const format = formatValue || ((val: number) => {
    if (formatOptions.currency) {
      return formatNumber(val, { currency: true, decimals: formatOptions.decimals, forceDecimals: formatOptions.forceDecimals });
    }
    return formatNumber(val, { decimals: formatOptions.decimals, forceDecimals: formatOptions.forceDecimals });
  });

  // Handle different display types
  if (displayType === 'single_max' || displayType === 'currency' || displayType === 'shares') {
    const effectiveMax = maxValue ?? 0;
    const effectiveHardLimit = hardLimit ?? 0;
    const effectiveBoardLimit = boardLimit ?? null;

    // If no limit available, don't show anything
    if (effectiveMax === 0 && effectiveHardLimit === 0 && (effectiveBoardLimit === null || effectiveBoardLimit === 0)) {
      return null;
    }

    return (
      <div className="space-y-2 mt-2">
        {/* Constraint Bar */}
        {(() => {
          const maxLimit = Math.max(effectiveHardLimit, effectiveBoardLimit || 0);
          if (maxLimit === 0) return null;
          
          const hardLimitPercent = (effectiveHardLimit / maxLimit) * 100;
          const boardLimitPercent = effectiveBoardLimit !== null ? (effectiveBoardLimit / maxLimit) * 100 : hardLimitPercent;
          const currentLimitPercent = effectiveMax > 0 ? (effectiveMax / maxLimit) * 100 : 0;
          
          return (
            <div className="relative w-full bg-gray-200 rounded-full h-4">
              {/* Hard limit zone */}
              {effectiveHardLimit > 0 && (
                <div
                  className={`absolute left-0 h-4 rounded-l-full ${
                    limitingConstraint === 'hard' ? 'bg-red-300' : 'bg-gray-300'
                  }`}
                  style={{ width: `${Math.min(hardLimitPercent, 100)}%` }}
                />
              )}
              
              {/* Board limit zone (if different from hard limit) */}
              {effectiveBoardLimit !== null && effectiveBoardLimit < effectiveHardLimit && (
                <div
                  className={`absolute h-4 rounded-r-full ${
                    limitingConstraint === 'board' ? 'bg-yellow-300' : 'bg-gray-300'
                  }`}
                  style={{
                    left: `${boardLimitPercent}%`,
                    width: `${Math.max(0, hardLimitPercent - boardLimitPercent)}%`
                  }}
                />
              )}
              
              {/* Current limit indicator */}
              {effectiveMax > 0 && (
                <div
                  className={`absolute top-0 w-1 h-4 border border-white rounded-full z-10 ${
                    limitingConstraint === 'board' ? 'bg-yellow-600' : limitingConstraint === 'hard' ? 'bg-red-600' : 'bg-green-600'
                  }`}
                  style={{ left: `${Math.min(currentLimitPercent, 100)}%`, marginLeft: '-2px' }}
                />
              )}
            </div>
          );
        })()}

        {/* Constraint Badges */}
        <div className="flex flex-wrap gap-2">
          {effectiveHardLimit > 0 && (
            <div className={`text-xs px-2 py-1 rounded ${
              limitingConstraint === 'hard' 
                ? 'bg-red-100 text-red-800 border border-red-300' 
                : 'bg-gray-100 text-gray-700 border border-gray-300'
            }`}>
              <span className="font-semibold">Regulatory:</span> {format(effectiveHardLimit)}{valueLabel}
            </div>
          )}
          {effectiveBoardLimit !== null && effectiveBoardLimit > 0 && (
            <div className={`text-xs px-2 py-1 rounded ${
              limitingConstraint === 'board' 
                ? 'bg-yellow-100 text-yellow-800 border border-yellow-300' 
                : 'bg-gray-100 text-gray-700 border border-gray-300'
            }`}>
              <span className="font-semibold">Board:</span> {format(effectiveBoardLimit)}{valueLabel}
            </div>
          )}
        </div>

        {/* Constraint Reason */}
        {constraintReason && (
          <div className={`text-xs rounded p-2 border ${
            limitingConstraint === 'board' && isLimited
              ? 'text-yellow-700 bg-yellow-50 border-yellow-200'
              : 'text-gray-600 bg-gray-50 border-gray-200'
          }`}>
            <span className="font-semibold">Limited to {format(effectiveMax)}{valueLabel}</span>
            {' by '}
            <span className="font-medium">
              {limitingConstraint === 'board' ? 'Board' : 'Regulatory'}
            </span>
            {': '}
            <span className="italic">{constraintReason}</span>
            {sharePrice && displayType === 'shares' && effectiveMax > 0 && (
              <div className="text-gray-500 mt-1">
                ≈ {formatNumber(effectiveMax * sharePrice, { currency: true })} at {formatNumber(sharePrice, { currency: true })}/share
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Handle range display (for dividends)
  if (displayType === 'range') {
    const effectiveMin = minValue ?? 0;
    const effectiveMax = maxValueRange ?? 0;
    const effectiveHardMin = hardMinValue ?? 0;
    const effectiveHardMax = hardMaxValue ?? 0;
    const effectiveBoardMin = boardMinValue ?? null;
    const effectiveBoardMax = boardMaxValue ?? null;

    // Show constraint badges if board limits exist
    const hasBoardLimits = effectiveBoardMin !== null || effectiveBoardMax !== null;
    if (!hasBoardLimits && limitingConstraint === 'hard') {
      return null; // No need to show if only hard limits apply and they're not restrictive
    }

    return (
      <div className="space-y-2 mt-2">
        {/* Constraint Badges */}
        <div className="flex flex-wrap gap-2">
          {(effectiveHardMin > 0 || effectiveHardMax > 0) && (
            <div className={`text-xs px-2 py-1 rounded ${
              limitingConstraint === 'hard' 
                ? 'bg-red-100 text-red-800 border border-red-300' 
                : 'bg-gray-100 text-gray-700 border border-gray-300'
            }`}>
              <span className="font-semibold">Regulatory:</span> {format(effectiveHardMin)}{rangeLabel} - {format(effectiveHardMax)}{rangeLabel}
            </div>
          )}
          {hasBoardLimits && (
            <div className={`text-xs px-2 py-1 rounded ${
              limitingConstraint === 'board' 
                ? 'bg-yellow-100 text-yellow-800 border border-yellow-300' 
                : 'bg-gray-100 text-gray-700 border border-gray-300'
            }`}>
              <span className="font-semibold">Board:</span> {format(effectiveBoardMin ?? effectiveMin)}{rangeLabel} - {format(effectiveBoardMax ?? effectiveMax)}{rangeLabel}
            </div>
          )}
        </div>

        {/* Constraint Reason */}
        {constraintReason && limitingConstraint === 'board' && (
          <div className={`text-xs rounded p-2 border ${
            isLimited
              ? 'text-yellow-700 bg-yellow-50 border-yellow-200'
              : 'text-gray-600 bg-gray-50 border-gray-200'
          }`}>
            <span className="font-semibold">Limited to {format(effectiveMin)}{rangeLabel} - {format(effectiveMax)}{rangeLabel}</span>
            {' by '}
            <span className="font-medium">Board</span>
            {': '}
            <span className="italic">{constraintReason}</span>
          </div>
        )}
      </div>
    );
  }

  return null;
}

