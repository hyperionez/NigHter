import { useTransaction } from '@/lib/sui/useTransaction.ts'
import {
  buildDepositLiquidityTx,
  buildWithdrawLiquidityTx,
  buildWithdrawPartialTx,
  buildMergeReceiptsTx,
} from '@/lib/tx/liquidity.ts'

export function useDepositLiquidity() {
  return useTransaction(buildDepositLiquidityTx)
}

export function useWithdrawLiquidity() {
  return useTransaction(buildWithdrawLiquidityTx)
}

export function useWithdrawPartial() {
  return useTransaction(buildWithdrawPartialTx)
}

export function useMergeReceipts() {
  return useTransaction(buildMergeReceiptsTx)
}
