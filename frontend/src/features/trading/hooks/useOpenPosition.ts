import { useTransaction } from '@/lib/sui/useTransaction.ts'
import { buildOpenPositionTx } from '@/lib/tx/openPosition.ts'

export function useOpenPosition() {
  return useTransaction(buildOpenPositionTx)
}
