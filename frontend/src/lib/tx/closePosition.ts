import { Transaction } from '@mysten/sui/transactions'
import { config, CLOCK_OBJECT_ID } from '@/config/index.ts'

export interface ClosePositionParams {
  positionId: string
}

export function buildClosePositionTx({ positionId }: ClosePositionParams): Transaction {
  const tx = new Transaction()

  tx.moveCall({
    target: `${config.packageId}::router::close_position_with_mock_price`,
    arguments: [
      tx.object(config.marketId),
      tx.object(config.vaultId),
      tx.object(config.treasuryId),
      tx.object(positionId),
      tx.object(CLOCK_OBJECT_ID),
    ],
  })

  return tx
}
