import { TEST_USDC_DECIMALS, PRICE_DECIMALS } from '../config/index.ts'

export const PRICE_SCALE = 10n ** BigInt(PRICE_DECIMALS)

export function formatUsdc(raw: string | number | bigint | undefined): string {
  if (raw === undefined) return 'n/a'
  const value = Number(BigInt(raw)) / 10 ** TEST_USDC_DECIMALS
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

export function formatPrice(raw: string | number | bigint | undefined): string {
  if (raw === undefined) return 'n/a'
  const value = Number(BigInt(raw)) / Number(PRICE_SCALE)
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function toPriceRaw(input: string): bigint {
  const trimmed = input.trim()
  if (!/^\d+(\.\d*)?$|^\.\d+$/.test(trimmed)) return 0n
  const [whole, frac = ''] = trimmed.split('.')
  const fracScaled = (frac + '0'.repeat(PRICE_DECIMALS)).slice(0, PRICE_DECIMALS)
  return BigInt(whole || '0') * PRICE_SCALE + BigInt(fracScaled || '0')
}

export function formatBps(bps: string | number | undefined): string {
  if (bps === undefined) return 'n/a'
  return `${(Number(bps) / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}%`
}

export function toUsdcRaw(amount: number): bigint {
  return BigInt(Math.round(amount * 10 ** TEST_USDC_DECIMALS))
}

export function maxLeverageFrom(initialMarginBps: bigint | string | number): number {
  const bps = Number(initialMarginBps)
  if (!Number.isFinite(bps) || bps <= 0) return 0
  return Math.floor(10_000 / bps)
}
