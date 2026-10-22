import { useTransaction } from '@/lib/sui/useTransaction.ts'
import {
  buildSetPausedTx,
  buildSetMockPriceTx,
  buildSetDemoPriceTx,
  buildWithdrawTreasuryTx,
  buildMintCapTx,
  buildMintUsdcTx,
} from '@/lib/tx/admin.ts'

export function useSetPaused() {
  return useTransaction(buildSetPausedTx)
}

export function useSetMockPrice() {
  return useTransaction(buildSetMockPriceTx)
}

export function useSetDemoPrice() {
  return useTransaction(buildSetDemoPriceTx)
}

export function useWithdrawTreasury() {
  return useTransaction(buildWithdrawTreasuryTx)
}

export function useMintCap() {
  return useTransaction(buildMintCapTx)
}

export function useMintUsdc() {
  return useTransaction(buildMintUsdcTx)
}
