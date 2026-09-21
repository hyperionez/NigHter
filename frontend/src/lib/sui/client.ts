import { createDAppKit } from '@mysten/dapp-kit-react'
import { SuiGrpcClient } from '@mysten/sui/grpc'

const GRPC_URLS = {
  testnet: 'https://fullnode.testnet.sui.io:443',
} as const

export const dAppKit = createDAppKit({
  networks: ['testnet'],
  defaultNetwork: 'testnet',
  createClient: (network) =>
    new SuiGrpcClient({ network, baseUrl: GRPC_URLS[network as keyof typeof GRPC_URLS] }),
})

declare module '@mysten/dapp-kit-react' {
  interface Register {
    dAppKit: typeof dAppKit
  }
}
