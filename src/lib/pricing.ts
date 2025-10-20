import { UserRole } from '@/hooks/useUserRole';

export interface PriceInfo {
  retailPrice: number;
  dealerPrice: number;
}

export const calculatePrice = (
  priceInfo: PriceInfo,
  role: UserRole | null,
  orderTotal: number = 0
): number => {
  // Counter Staff: Always retail prices, no discounts
  if (role === 'counter_staff' || !role) {
    return priceInfo.retailPrice;
  }

  let basePrice = priceInfo.dealerPrice;
  let discountPercent = 0;

  switch (role) {
    case 'dealer_6':
      // 2% over 510,205, 6% over 1,063,900
      if (orderTotal > 1063900) {
        discountPercent = 6;
      } else if (orderTotal > 510205) {
        discountPercent = 2;
      }
      break;

    case 'dealer_4':
      // 2% over 510,205, 4% over 1,041,700
      if (orderTotal > 1041700) {
        discountPercent = 4;
      } else if (orderTotal > 510205) {
        discountPercent = 2;
      }
      break;

    case 'dealer_marketing':
      // 4% over 2,500,000
      if (orderTotal > 2500000) {
        discountPercent = 4;
      }
      break;
  }

  return basePrice * (1 - discountPercent / 100);
};

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-UG', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};
