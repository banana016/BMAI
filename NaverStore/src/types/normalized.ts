export interface SalesDiscounts {
  totalDiscount: number | null;
  sellerProductDiscount: number | null;
  naverProductDiscount: number | null;
  sellerOrderDiscount: number | null;
  naverOrderDiscount: number | null;
}

export interface NormalizedSalesRow {
  date: string;
  /** "전체" (store total) or the individual channel name for that date. */
  channel: string;
  orders: number | null;
  refunds: number | null;
  grossSales: number | null;
  netSales: number | null;
  aov: number | null;
  refundAmount: number | null;
  units: number | null;
  traffic: number | null;
  /** Ratio (0.104 = 10.4%), not the raw workbook percent number. */
  conversionRate: number | null;
  shipping: number | null;
  discounts: SalesDiscounts;
}

export interface NormalizedTrafficRow {
  date: string;
  sourceL1: string;
  sourceL2: string;
  sourceL3: string;
  isMarketingLink: boolean | null;
  visits: number | null;
  orders: number | null;
  conversionRate: number | null;
  sales: number | null;
  aov: number | null;
}

export interface NormalizedSearchRow {
  date: string;
  query: string;
  visits: number | null;
  orders: number | null;
  conversionRate: number | null;
  sales: number | null;
  aov: number | null;
}

export type CustomerType = "all" | "new" | "returning";

export interface NormalizedCustomerRow {
  weekStart: string;
  weekEnd: string;
  customerType: CustomerType;
  visitors: number | null;
  visitorsShare: number | null;
  payers: number | null;
  payersShare: number | null;
  conversionRate: number | null;
  sales: number | null;
  salesShare: number | null;
  aov: number | null;
}

export interface NormalizedReviewRow {
  productId: string;
  productName: string;
  rating: number | null;
  hasPhoto: boolean;
  content: string | null;
  helpfulCount: number | null;
  reviewDate: string | null;
  hasReply: boolean;
  replyDate: string | null;
}

export interface NormalizedAdRow {
  date: string;
  impressions: number | null;
  clicks: number | null;
  ctr: number | null;
  avgCpc: number | null;
  cost: number | null;
  totalConversions: number | null;
  directConversions: number | null;
  indirectConversions: number | null;
  totalConversionRate: number | null;
  totalConversionSales: number | null;
  directConversionSales: number | null;
  indirectConversionSales: number | null;
  totalCostPerConversion: number | null;
  totalRoas: number | null;
  purchaseConversions: number | null;
  purchaseConversionSales: number | null;
  /** Per-day ratio from the workbook's own R column; a check value only — see doc 2.8 for the SUM-based period formula. */
  purchaseRoas: number | null;
}
