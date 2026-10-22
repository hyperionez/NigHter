import { Transaction } from '@mysten/sui/transactions'
import { config } from '@/config/index.ts'

export interface DepositLiquidityParams {
  coinId: string
  amount: bigint
  recipient: string
}

export function buildDepositLiquidityTx({
  coinId,
  amount,
  recipient,
}: DepositLiquidityParams): Transaction {
  const tx = new Transaction()

  const [payment] = tx.splitCoins(tx.object(coinId), [tx.pure.u64(amount)])

  const [receipt] = tx.moveCall({
    target: `${config.packageId}::vault::deposit_liquidity`,
    arguments: [tx.object(config.vaultId), payment!],
  })

  tx.transferObjects([receipt!], recipient)

  return tx
}

export interface WithdrawLiquidityParams {
  receiptId: string
  recipient: string
}

export function buildWithdrawLiquidityTx({
  receiptId,
  recipient,
}: WithdrawLiquidityParams): Transaction {
  const tx = new Transaction()

  const [payout] = tx.moveCall({
    target: `${config.packageId}::vault::withdraw_liquidity`,
    arguments: [tx.object(config.vaultId), tx.object(config.marketId), tx.object(receiptId)],
  })

  tx.transferObjects([payout!], recipient)

  return tx
}

export interface WithdrawPartialParams {
  receiptId: string
  shares: bigint
  recipient: string
}

export function buildWithdrawPartialTx({
  receiptId,
  shares,
  recipient,
}: WithdrawPartialParams): Transaction {
  const tx = new Transaction()

  const [part] = tx.moveCall({
    target: `${config.packageId}::vault::split_receipt`,
    arguments: [tx.object(receiptId), tx.pure.u64(shares)],
  })

  const [payout] = tx.moveCall({
    target: `${config.packageId}::vault::withdraw_liquidity`,
    arguments: [tx.object(config.vaultId), tx.object(config.marketId), part!],
  })

  tx.transferObjects([payout!], recipient)

  return tx
}

export interface MergeReceiptsParams {
  receiptIds: string[]
}

export function buildMergeReceiptsTx({ receiptIds }: MergeReceiptsParams): Transaction {
  const tx = new Transaction()
  const [target, ...rest] = receiptIds

  for (const other of rest) {
    tx.moveCall({
      target: `${config.packageId}::vault::merge_receipt`,
      arguments: [tx.object(target!), tx.object(other)],
    })
  }

  return tx
}
