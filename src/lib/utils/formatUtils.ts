// Formatting utilities for the winery management game

export function formatCurrency(value: number, decimals = 0): string {
  return `€${formatNumber(value, decimals)}`;
}

export function formatNumber(value: number, decimals = 0): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

export function formatPercent(value: number, decimals = 1): string {
  return `${(value * 100).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })}%`;
}

export function formatMoney(value: number): string {
  if (value >= 1000000) {
    return `€${(value / 1000000).toFixed(2)} Mio`;
  } else if (value >= 1000) {
    return `€${(value / 1000).toFixed(0)}K`;
  } else {
    return `€${value.toLocaleString()}`;
  }
}

export function getColorClass(value: number): string {
  const level = Math.max(0, Math.min(9, Math.floor(value * 10)));
  const colorMap: Record<number, string> = {
    0: 'text-red-600',
    1: 'text-red-500',
    2: 'text-orange-500',
    3: 'text-amber-500',
    4: 'text-yellow-500',
    5: 'text-lime-500',
    6: 'text-lime-600',
    7: 'text-green-600',
    8: 'text-green-700',
    9: 'text-green-800',
  };
  return colorMap[level] || 'text-gray-500';
}

export function getWineQualityCategory(quality: number): string {
  if (quality < 0.1) return "Undrinkable";
  if (quality < 0.2) return "Vinegar Surprise";
  if (quality < 0.3) return "House Pour";
  if (quality < 0.4) return "Everyday Sipper";
  if (quality < 0.5) return "Solid Bottle";
  if (quality < 0.6) return "Well-Balanced";
  if (quality < 0.7) return "Sommelier's Choice";
  if (quality < 0.8) return "Cellar Reserve";
  if (quality < 0.9) return "Connoisseur's Pick";
  return "Vintage Perfection";
}
