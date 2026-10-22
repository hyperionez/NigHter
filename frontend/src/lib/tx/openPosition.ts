import { Transaction } from '@mysten/sui/transactions'
import { config, CLOCK_OBJECT_ID } from '@/config/index.ts'

export interface OpenPositionParams {
  collateralCoinId: string
  collateralAmount: bigint
  isLong: boolean
  leverage: number
}

export function buildOpenPositionTx({
  collateralCoinId,
  collateralAmount,
  isLong,
  leverage,
}: OpenPositionParams): Transaction {
  const tx = new Transaction()

  const [collateral] = tx.splitCoins(tx.object(collateralCoinId), [tx.pure.u64(collateralAmount)])

  tx.moveCall({
    target: `${config.packageId}::router::open_position_with_mock_price`,
    arguments: [
      tx.object(config.marketId),
      tx.object(config.vaultId),
      tx.object(config.treasuryId),
      collateral!,
      tx.pure.bool(isLong),
      tx.pure.u64(leverage),
      tx.object(CLOCK_OBJECT_ID),
    ],
  })

  return tx
}
