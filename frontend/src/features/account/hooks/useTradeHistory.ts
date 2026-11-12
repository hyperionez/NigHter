import { useQuery } from '@tanstack/react-query'
import { useCurrentAccount } from '@mysten/dapp-kit-react'
import { graphqlRequest } from '@perp-dex/shared'
import { config } from '@/config/index.ts'

const NETWORK = 'testnet'

interface EventNode {
  timestamp: string | null
  contents: { json: Record<string, unknown> } | null
}

export interface ClosedTrade {
  id: string
  at: number
  isProfit: boolean
  amount: bigint
  payout: bigint
}

export interface TradeHistory {
  trades: ClosedTrade[]
  liquidated: number
  wins: number
  realized: bigint
  best: bigint
  worst: bigint
}

const EVENTS = `query Events($type: String!) {
  events(first: 50, filter: { type: $type }) {
    nodes { timestamp contents { json } }
  }
}`

async function fetchEvents(type: string): Promise<EventNode[]> {
  const data = await graphqlRequest<{ events: { nodes: EventNode[] } }>(NETWORK, EVENTS, { type })
  return data.events.nodes.filter((node) => node.contents !== null)
}

export function useTradeHistory() {
  const account = useCurrentAccount()

  return useQuery<TradeHistory>({
    queryKey: ['tradeHistory', account?.address],
    enabled: account !== null,
    refetchInterval: 15_000,
    queryFn: async () => {
      const [closedNodes, liquidatedNodes] = await Promise.all([
        fetchEvents(`${config.packageId}::router::PositionClosed`),
        fetchEvents(`${config.packageId}::liquidation::PositionLiquidated`),
      ])

      const mine = (node: EventNode) =>
        node.contents!.json.owner === account!.address &&
        node.contents!.json.market_id === config.marketId

      const trades: ClosedTrade[] = closedNodes
        .filter(mine)
        .map((node) => {
          const j = node.contents!.json
          return {
            id: j.position_id as string,
            at: node.timestamp ? Date.parse(node.timestamp) : 0,
            isProfit: j.net_is_profit as boolean,
            amount: BigInt(j.net_result as string),
            payout: BigInt(j.payout as string),
          }
        })
        .sort((a, b) => a.at - b.at)

      let realized = 0n
      let best = 0n
      let worst = 0n
      let wins = 0
      for (const trade of trades) {
        const signed = trade.isProfit ? trade.amount : -trade.amount
        realized += signed
        if (signed > best) best = signed
        if (signed < worst) worst = signed
        if (trade.isProfit) wins += 1
      }

      return {
        trades,
        liquidated: liquidatedNodes.filter(mine).length,
        wins,
        realized,
        best,
        worst,
      }
    },
  })
}
