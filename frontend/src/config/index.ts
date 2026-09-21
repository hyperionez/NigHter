function required(name: string): string {
  const value = import.meta.env[name]
  if (!value) {
    throw new Error(`Missing required env var ${name}. Copy .env.example to .env and fill it in.`)
  }
  return value
}

export const config = {
  packageId: required('VITE_PACKAGE_ID'),
  marketId: required('VITE_MARKET_ID'),
  vaultId: required('VITE_VAULT_ID'),
  treasuryId: required('VITE_TREASURY_ID'),
  demoPriceCapId: required('VITE_DEMO_PRICE_CAP_ID'),
}

export const CLOCK_OBJECT_ID = '0x6'
export const TEST_USDC_DECIMALS = 6
