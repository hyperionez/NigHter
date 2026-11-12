function required(name: string): string {
  const value = import.meta.env[name]
  if (!value) {
    throw new Error(`Missing required env var ${name}. Copy .env.example to .env and fill it in.`)
  }
  return value
}

function optional(name: string, fallback: string): string {
  const value = import.meta.env[name]
  return value ? String(value).replace(/\/+$/, '') : fallback
}

export const config = {
  packageId: required('VITE_PACKAGE_ID'),
  marketId: required('VITE_MARKET_ID'),
  vaultId: required('VITE_VAULT_ID'),
  treasuryId: required('VITE_TREASURY_ID'),
  priceSignerUrl: optional('VITE_PRICE_SIGNER_URL', 'http://127.0.0.1:8787'),
}

export const CLOCK_OBJECT_ID = '0x6'
export const TEST_USDC_DECIMALS = 6
export const PRICE_DECIMALS = 9
export const CHART_SYMBOL = import.meta.env.VITE_CHART_SYMBOL ?? 'BTCUSDT'
