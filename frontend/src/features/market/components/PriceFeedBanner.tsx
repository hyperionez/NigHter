import { useMarket } from '../hooks/useMarket.ts'
import { useSignedPrice } from '../hooks/useSignedPrice.ts'

export function PriceFeedBanner() {
  const { market } = useMarket()
  const signedMode = market?.usesSignedPrice === true
  const stalenessWindowMs = market ? Number(market.maxPriceStalenessSecs) * 1000 : undefined
  const signed = useSignedPrice(signedMode, stalenessWindowMs)

  if (!signed.blockedReason) return null

  return (
    <p className="feed-banner">
      <strong>Price feed is {signed.stateLabel}.</strong> {signed.blockedReason}
      {signed.error && <span className="feed-detail">{signed.error.message}</span>}
    </p>
  )
}
