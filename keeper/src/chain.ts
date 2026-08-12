import { config } from "./config.js";
import { fetchObjectFields } from "./graphqlClient.js";

export interface OnChainPosition {
  owner: string;
  marketId: string;
  isLong: boolean;
  size: bigint;
  collateral: bigint;
  entryPrice: bigint;
  entryFundingChargeIndex: bigint;
  entryFundingCreditIndex: bigint;
}

export interface OnChainMarket {
  maintenanceMarginBps: bigint;
  mockPrice: bigint;
  cumulativeFundingLongCharge: bigint;
  cumulativeFundingLongCredit: bigint;
  cumulativeFundingShortCharge: bigint;
  cumulativeFundingShortCredit: bigint;
}

export async function fetchPosition(positionId: string): Promise<OnChainPosition> {
  const f = await fetchObjectFields(positionId);
  return {
    owner: f.owner as string,
    marketId: f.market_id as string,
    isLong: f.is_long as boolean,
    size: BigInt(f.size as string),
    collateral: BigInt(f.collateral as string),
    entryPrice: BigInt(f.entry_price as string),
    entryFundingChargeIndex: BigInt(f.entry_funding_charge_index as string),
    entryFundingCreditIndex: BigInt(f.entry_funding_credit_index as string),
  };
}

export async function fetchMarket(marketId: string = config.marketId): Promise<OnChainMarket> {
  const f = await fetchObjectFields(marketId);
  return {
    maintenanceMarginBps: BigInt(f.maintenance_margin_bps as string),
    mockPrice: BigInt(f.mock_price as string),
    cumulativeFundingLongCharge: BigInt(f.cumulative_funding_long_charge as string),
    cumulativeFundingLongCredit: BigInt(f.cumulative_funding_long_credit as string),
    cumulativeFundingShortCharge: BigInt(f.cumulative_funding_short_charge as string),
    cumulativeFundingShortCredit: BigInt(f.cumulative_funding_short_credit as string),
  };
}

export async function fetchCurrentPrice(market: OnChainMarket): Promise<bigint> {
  return market.mockPrice;
}
