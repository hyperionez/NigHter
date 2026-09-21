import { TEST_USDC_DECIMALS } from '../config/index.ts'

export function formatUsdc(raw: string | number | bigint | undefined): string {
  if (raw === undefined) return 'n/a'
  const value = Number(BigInt(raw)) / 10 ** TEST_USDC_DECIMALS
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

export function formatPrice(raw: string | number | bigint | undefined): string {
  if (raw === undefined) return 'n/a'
  return Number(raw).toLocaleString(undefined, { maximumFractionDigits: 2 })
}

export function formatBps(bps: string | number | undefined): string {
  if (bps === undefined) return 'n/a'
  return `${(Number(bps) / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}%`
}

export function toUsdcRaw(amount: number): bigint {
  return BigInt(Math.round(amount * 10 ** TEST_USDC_DECIMALS))
}
