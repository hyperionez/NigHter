import { useQuery } from '@tanstack/react-query'
import { useCurrentClient } from '@mysten/dapp-kit-react'

export function useOnChainObject(objectId: string) {
  const client = useCurrentClient()
  return useQuery({
    queryKey: ['object', objectId],
    queryFn: async () => {
      const { object } = await client.core.getObject({ objectId, include: { json: true } })
      return object.json as Record<string, unknown>
    },
    refetchInterval: 10_000,
  })
}
