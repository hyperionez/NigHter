const TEST_USDC_DECIMALS = 6
const PRICE_DECIMALS = 9

export function formatUsdcAmount(raw: string | number | undefined): string {
  if (raw === undefined) return 'n/a'
  const value = Number(BigInt(raw)) / 10 ** TEST_USDC_DECIMALS
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

export function formatScaledPrice(raw: bigint | string | undefined): string {
  if (raw === undefined) return 'n/a'
  const value = Number(typeof raw === 'bigint' ? raw : BigInt(raw)) / 10 ** PRICE_DECIMALS
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

export function formatBpsAsPercent(bps: string | number | undefined): string {
  if (bps === undefined) return 'n/a'
  return `${(Number(bps) / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}%`
}
