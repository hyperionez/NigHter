import { config } from "./config.js";
import {
  fetchObjectFields,
  fetchLivePrice,
  base64ToBytes,
  bytesToHexPrefixed,
  type OnChainMarket,
  type OnChainPosition,
} from "@perp-dex/shared";
import { signedFeedPrice, type SignedPriceContext } from "./priceSigner.js";

export type { OnChainMarket, OnChainPosition };

export async function fetchPosition(positionId: string): Promise<OnChainPosition> {
  const f = await fetchObjectFields(config.network, positionId);
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

export function moveByteVectorToHex(value: unknown): string {
  if (value === undefined || value === null || value === "") {
    return "";
  }
  if (Array.isArray(value)) {
    return bytesToHexPrefixed(Uint8Array.from(value.map((byte) => Number(byte))));
  }
  if (typeof value !== "string") {
    throw new Error(`Unexpected Move vector<u8> representation: ${JSON.stringify(value)}`);
  }
  if (value.startsWith("0x") || value.startsWith("0X")) {
    return `0x${value.slice(2).toLowerCase()}`;
  }
  return bytesToHexPrefixed(base64ToBytes(value));
}

export interface MarketRuntime extends OnChainMarket {
  marketId: string;
  demoMode: boolean;
  paused: boolean;
  priceSigner: string;
  usesSignedPrice: boolean;
  maxPriceStalenessSecs: bigint;
}

export async function fetchMarket(marketId: string = config.marketId): Promise<MarketRuntime> {
  const f = await fetchObjectFields(config.network, marketId);
  const priceSigner = moveByteVectorToHex(f.price_signer);
  return {
    marketId,
    maintenanceMarginBps: BigInt(f.maintenance_margin_bps as string),
    mockPrice: BigInt(f.mock_price as string),
    cumulativeFundingLongCharge: BigInt(f.cumulative_funding_long_charge as string),
    cumulativeFundingLongCredit: BigInt(f.cumulative_funding_long_credit as string),
    cumulativeFundingShortCharge: BigInt(f.cumulative_funding_short_charge as string),
    cumulativeFundingShortCredit: BigInt(f.cumulative_funding_short_credit as string),
    demoMode: f.demo_mode as boolean,
    paused: f.paused as boolean,
    priceSigner,
    usesSignedPrice: priceSigner.length > 2,
    maxPriceStalenessSecs: BigInt(f.max_price_staleness_secs as string),
  };
}

export function signedPriceContext(market: MarketRuntime): SignedPriceContext {
  return {
    marketId: market.marketId,
    maxPriceStalenessMs: Number(market.maxPriceStalenessSecs) * 1000,
    onChainSigner: market.priceSigner,
  };
}

export async function fetchCurrentPrice(market: MarketRuntime): Promise<bigint> {
  if (market.usesSignedPrice) {
    return signedFeedPrice();
  }
  if (!market.demoMode && config.priceSource === "pyth") {
    return fetchLivePrice(config.pythFeedId, config.pythApiKey);
  }
  return market.mockPrice;
}
