import { useTransaction } from '@/lib/sui/useTransaction.ts'
import { useMarket } from '@/features/market/hooks/useMarket.ts'
import { fetchSignedPrice } from '@/lib/priceFeed.ts'
import {
  buildClosePositionTx,
  buildClosePositionSignedTx,
  type ClosePositionParams,
} from '@/lib/tx/closePosition.ts'

export function useClosePosition() {
  const { market } = useMarket()
  const usesSignedPrice = market?.usesSignedPrice === true

  return useTransaction(async (params: ClosePositionParams) => {
    if (!usesSignedPrice) return buildClosePositionTx(params)

    const report = await fetchSignedPrice()
    return buildClosePositionSignedTx({
      ...params,
      price: report.price,
      priceTimestampMs: report.timestampMs,
      priceSignature: report.signature,
    })
  })
}
