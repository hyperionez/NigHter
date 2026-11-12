import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DAppKitProvider } from '@mysten/dapp-kit-react'
import { dAppKit } from '@/lib/sui/client.ts'
import { PrivacyProvider } from './privacy.tsx'

const queryClient = new QueryClient()

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <DAppKitProvider dAppKit={dAppKit}>
        <PrivacyProvider>{children}</PrivacyProvider>
      </DAppKitProvider>
    </QueryClientProvider>
  )
}
