import { useQuery } from '@tanstack/react-query'
import { useCurrentClient } from '@mysten/dapp-kit-react'

export function useObject(objectId: string | undefined) {
  const client = useCurrentClient()
  return useQuery({
    queryKey: ['object', objectId],
    enabled: objectId !== undefined,
    queryFn: async () => {
      const { object } = await client.core.getObject({ objectId: objectId!, include: { json: true } })
      return object.json as Record<string, unknown>
    },
    refetchInterval: 5_000,
  })
}
