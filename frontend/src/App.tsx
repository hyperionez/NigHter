import { useCurrentAccount } from '@mysten/dapp-kit-react'
import { ConnectButton } from '@mysten/dapp-kit-react/ui'
import { MarketDashboard } from './components/MarketDashboard.tsx'
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
        {account ? (
          <p className="connected-address">Connected: {account.address}</p>
        ) : (
          <p className="connect-hint">Connect a testnet wallet to get started.</p>
        )}
        <MarketDashboard />
      </main>
    </div>
  )
}

export default App
