import { useQuery } from '@tanstack/react-query'
import { useCurrentAccount } from '@mysten/dapp-kit-react'
import { graphqlRequest } from '@perp-dex/shared'
import { config } from '@/config/index.ts'

const NETWORK = 'testnet'

interface OwnedNode {
  address: string
  asMoveObject: { contents: { json: Record<string, unknown> } } | null
}

interface OwnedCapsResponse {
  admin: { nodes: OwnedNode[] }
  risk: { nodes: OwnedNode[] }
  treasurer: { nodes: OwnedNode[] }
  demoPrice: { nodes: OwnedNode[] }
  lpReceipt: { nodes: OwnedNode[] }
  usdcTreasury: { nodes: OwnedNode[] }
}

export interface LpReceiptRef {
  id: string
  shares: bigint
}

export interface Roles {
  adminCapId?: string
  riskCapId?: string
  treasurerCapId?: string
  demoPriceCapId?: string
  usdcTreasuryCapId?: string
  lpReceipts: LpReceiptRef[]
  isAdmin: boolean
  isRiskOperator: boolean
  isTreasurer: boolean
  isPriceOperator: boolean
  isFaucetOperator: boolean
  isLp: boolean
  totalLpShares: bigint
}

export const EMPTY_ROLES: Roles = {
  lpReceipts: [],
  isAdmin: false,
  isRiskOperator: false,
  isTreasurer: false,
  isPriceOperator: false,
  isFaucetOperator: false,
  isLp: false,
  totalLpShares: 0n,
}

const CAP_TYPES = {
  admin: `${config.packageId}::admin::AdminCap`,
  risk: `${config.packageId}::admin::RiskCap`,
  treasurer: `${config.packageId}::admin::TreasurerCap`,
  demoPrice: `${config.packageId}::market::DemoPriceCap`,
  lpReceipt: `${config.packageId}::vault::LpReceipt`,
  usdcTreasury: `0x2::coin::TreasuryCap<${config.packageId}::test_usdc::TEST_USDC>`,
} as const

const QUERY = `query OwnedCaps(
  $owner: SuiAddress!
  $admin: String!
  $risk: String!
  $treasurer: String!
  $demoPrice: String!
  $lpReceipt: String!
  $usdcTreasury: String!
) {
  admin: objects(first: 5, filter: { owner: $owner, type: $admin }) { nodes { address } }
  risk: objects(first: 5, filter: { owner: $owner, type: $risk }) { nodes { address } }
  treasurer: objects(first: 5, filter: { owner: $owner, type: $treasurer }) { nodes { address } }
  demoPrice: objects(first: 10, filter: { owner: $owner, type: $demoPrice }) {
    nodes { address asMoveObject { contents { json } } }
  }
  lpReceipt: objects(first: 50, filter: { owner: $owner, type: $lpReceipt }) {
    nodes { address asMoveObject { contents { json } } }
  }
  usdcTreasury: objects(first: 5, filter: { owner: $owner, type: $usdcTreasury }) { nodes { address } }
}`

function scopedTo(node: OwnedNode, field: string, expected: string): boolean {
  return node.asMoveObject !== null && node.asMoveObject.contents.json[field] === expected
}

function toRoles(data: OwnedCapsResponse): Roles {
  const adminCapId = data.admin.nodes[0]?.address
  const riskCapId = data.risk.nodes[0]?.address
  const treasurerCapId = data.treasurer.nodes[0]?.address
  const usdcTreasuryCapId = data.usdcTreasury.nodes[0]?.address

  const demoPriceCapId = data.demoPrice.nodes.find((n) => scopedTo(n, 'market_id', config.marketId))
    ?.address

  const lpReceipts = data.lpReceipt.nodes
    .filter((n) => scopedTo(n, 'vault_id', config.vaultId))
    .map((n) => ({
      id: n.address,
      shares: BigInt(n.asMoveObject!.contents.json.shares as string),
    }))

  return {
    adminCapId,
    riskCapId,
    treasurerCapId,
    demoPriceCapId,
    usdcTreasuryCapId,
    lpReceipts,
    isAdmin: adminCapId !== undefined,
    isRiskOperator: riskCapId !== undefined,
    isTreasurer: treasurerCapId !== undefined,
    isPriceOperator: demoPriceCapId !== undefined,
    isFaucetOperator: usdcTreasuryCapId !== undefined,
    isLp: lpReceipts.length > 0,
    totalLpShares: lpReceipts.reduce((sum, r) => sum + r.shares, 0n),
  }
}

export function useRoles() {
  const account = useCurrentAccount()

  const query = useQuery({
    queryKey: ['roles', account?.address],
    enabled: account !== null,
    refetchInterval: 10_000,
    queryFn: async () => {
      const data = await graphqlRequest<OwnedCapsResponse>(NETWORK, QUERY, {
        owner: account!.address,
        ...CAP_TYPES,
      })
      return toRoles(data)
    },
  })

  return { ...query, roles: query.data ?? EMPTY_ROLES }
}
