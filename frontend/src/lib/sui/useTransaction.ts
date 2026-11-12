import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useDAppKit } from '@mysten/dapp-kit-react'
import type { Transaction } from '@mysten/sui/transactions'

export interface TransactionOutcome {
  digest: string
  createdSharedObjectId?: string
}

export function useTransaction<P>(build: (params: P) => Transaction | Promise<Transaction>) {
  const dAppKit = useDAppKit()
  const queryClient = useQueryClient()

  return useMutation<TransactionOutcome, Error, P>({
    mutationFn: async (params: P) => {
      const transaction = await build(params)
      const result = await dAppKit.signAndExecuteTransaction({ transaction })

      if (result.$kind === 'FailedTransaction') {
        const status = result.FailedTransaction.status
        throw new Error(status.success ? 'Transaction failed' : status.error.message)
      }

      const created = result.Transaction.effects?.changedObjects.find(
        (o) => o.idOperation === 'Created' && o.outputOwner?.$kind === 'Shared',
      )

      return { digest: result.Transaction.digest, createdSharedObjectId: created?.objectId }
    },
    onSuccess: () => {
      queryClient.invalidateQueries()
    },
  })
}
