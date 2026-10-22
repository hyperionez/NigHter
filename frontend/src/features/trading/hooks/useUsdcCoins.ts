import { useQuery } from '@tanstack/react-query'
import { useCurrentClient, useCurrentAccount } from '@mysten/dapp-kit-react'
import { config } from '@/config/index.ts'

export function useUsdcCoins() {
  const client = useCurrentClient()
  const account = useCurrentAccount()

  return useQuery({
    queryKey: ['usdcCoins', account?.address],
    enabled: account !== null,
    queryFn: async () => {
      const { objects } = await client.core.listCoins({
        owner: account!.address,
        coinType: `${config.packageId}::test_usdc::TEST_USDC`,
      })
      return objects
    },
    refetchInterval: 5_000,
  })
}

export function largestCoin(coins: { objectId: string; balance: string }[] | undefined) {
  if (!coins || coins.length === 0) return undefined
  return coins.reduce((best, c) => (BigInt(c.balance) > BigInt(best.balance) ? c : best))
}
