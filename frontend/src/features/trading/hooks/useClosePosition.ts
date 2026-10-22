import { useTransaction } from '@/lib/sui/useTransaction.ts'
import { buildClosePositionTx } from '@/lib/tx/closePosition.ts'

export function useClosePosition() {
  return useTransaction(buildClosePositionTx)
}
