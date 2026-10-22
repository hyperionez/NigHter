import { useQuery } from '@tanstack/react-query'
import { useCurrentAccount } from '@mysten/dapp-kit-react'
import { graphqlRequest, type OnChainPosition } from '@perp-dex/shared'
import { config } from '@/config/index.ts'

const NETWORK = 'testnet'

interface PositionNode {
  address: string
  asMoveObject: { contents: { json: Record<string, unknown> } } | null
}

function toPosition(node: PositionNode): { id: string } & OnChainPosition {
  const j = node.asMoveObject!.contents.json
  return {
    id: node.address,
    owner: j.owner as string,
    marketId: j.market_id as string,
    isLong: j.is_long as boolean,
    size: BigInt(j.size as string),
    collateral: BigInt(j.collateral as string),
    entryPrice: BigInt(j.entry_price as string),
    entryFundingChargeIndex: BigInt(j.entry_funding_charge_index as string),
    entryFundingCreditIndex: BigInt(j.entry_funding_credit_index as string),
  }
}

export function usePositions() {
  const account = useCurrentAccount()

  return useQuery({
    queryKey: ['positions', account?.address],
    enabled: account !== null,
    refetchInterval: 5_000,
    queryFn: async () => {
      const data = await graphqlRequest<{ objects: { nodes: PositionNode[] } }>(
        NETWORK,
        `query Positions($type: String!) {
          objects(first: 50, filter: { type: $type }) {
            nodes { address asMoveObject { contents { json } } }
          }
        }`,
        { type: `${config.packageId}::position::Position` },
      )

      return data.objects.nodes
        .filter((n) => n.asMoveObject !== null)
        .map(toPosition)
        .filter((p) => p.owner === account!.address && p.marketId === config.marketId)
    },
  })
}
