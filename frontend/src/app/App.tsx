import { useCurrentAccount } from '@mysten/dapp-kit-react'
import { ConnectButton } from '@mysten/dapp-kit-react/ui'
import { MarketDashboard } from '@/features/market/components/MarketDashboard.tsx'
import './App.css'

function App() {
  const account = useCurrentAccount()

  return (
    <div className="app">
      <header className="app-header">
        <h1>perp_dex</h1>
        <ConnectButton />
      </header>
      <main className="app-main">
        <MarketDashboard />
        {!account && <p className="connect-hint">Connect a testnet wallet to trade.</p>}
      </main>
    </div>
  )
}

export default App
