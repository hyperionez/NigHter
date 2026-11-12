import { useObject } from '@/lib/sui/useObject.ts'
import { config } from '@/config/index.ts'
import { decodeMoveBytes, bytesToHex } from '@/lib/moveBytes.ts'

export interface MarketState {
  initialMarginBps: string
  maintenanceMarginBps: string
  openFeeBps: string
  closeFeeBps: string
  longOpenInterest: string
  shortOpenInterest: string
  maxOpenInterest: string
  minPositionSize: string
  demoMode: boolean
  mockPrice: string
  lastPriceUpdateMs: string | undefined
  maxPriceStalenessSecs: string
  priceSignerHex: string
  usesSignedPrice: boolean
  paused: boolean
  fundingRateBpsPerHour: string
  liquidationPenaltyBps: string
  keeperRewardBps: string
  cumulativeFundingLongCharge: string
  cumulativeFundingLongCredit: string
  cumulativeFundingShortCharge: string
  cumulativeFundingShortCredit: string
}

function toMarketState(raw: Record<string, unknown>): MarketState {
  const priceSigner = decodeMoveBytes(raw.price_signer)

  return {
    initialMarginBps: raw.initial_margin_bps as string,
    maintenanceMarginBps: raw.maintenance_margin_bps as string,
    openFeeBps: raw.open_fee_bps as string,
    closeFeeBps: raw.close_fee_bps as string,
    longOpenInterest: raw.long_open_interest as string,
    shortOpenInterest: raw.short_open_interest as string,
    maxOpenInterest: raw.max_open_interest as string,
    minPositionSize: raw.min_position_size as string,
    demoMode: raw.demo_mode as boolean,
    mockPrice: raw.mock_price as string,
    lastPriceUpdateMs: raw.last_price_update_ms as string | undefined,
    maxPriceStalenessSecs: raw.max_price_staleness_secs as string,
    priceSignerHex: bytesToHex(priceSigner),
    usesSignedPrice: priceSigner.length > 0,
    paused: raw.paused as boolean,
    fundingRateBpsPerHour: raw.funding_rate_bps_per_hour as string,
    liquidationPenaltyBps: raw.liquidation_penalty_bps as string,
    keeperRewardBps: raw.keeper_reward_bps as string,
    cumulativeFundingLongCharge: raw.cumulative_funding_long_charge as string,
    cumulativeFundingLongCredit: raw.cumulative_funding_long_credit as string,
    cumulativeFundingShortCharge: raw.cumulative_funding_short_charge as string,
    cumulativeFundingShortCredit: raw.cumulative_funding_short_credit as string,
  }
}

export function useMarket() {
  const query = useObject(config.marketId)
  return { ...query, market: query.data ? toMarketState(query.data) : undefined }
}

export interface VaultState {
  balance: string
  lpSupply: string
}

export function useVault() {
  const query = useObject(config.vaultId)
  return {
    ...query,
    vault: query.data
      ? { balance: query.data.balance as string, lpSupply: query.data.lp_supply as string }
      : undefined,
  }
}
