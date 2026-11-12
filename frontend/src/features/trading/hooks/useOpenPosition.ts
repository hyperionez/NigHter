import { useTransaction } from '@/lib/sui/useTransaction.ts'
import { useMarket } from '@/features/market/hooks/useMarket.ts'
import { fetchSignedPrice } from '@/lib/priceFeed.ts'
import {
  buildOpenPositionTx,
  buildOpenPositionSignedTx,
  type OpenPositionParams,
} from '@/lib/tx/openPosition.ts'

export function useOpenPosition() {
  const { market } = useMarket()
  const usesSignedPrice = market?.usesSignedPrice === true

  return useTransaction(async (params: OpenPositionParams) => {
    if (!usesSignedPrice) return buildOpenPositionTx(params)

    const report = await fetchSignedPrice()
    return buildOpenPositionSignedTx({
      ...params,
      price: report.price,
      priceTimestampMs: report.timestampMs,
      priceSignature: report.signature,
    })
  })
}
