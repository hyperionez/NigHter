import { useState } from 'react'
import { useCurrentAccount } from '@mysten/dapp-kit-react'
import { ConnectButton } from '@mysten/dapp-kit-react/ui'
import { MarketDashboard } from '@/features/market/components/MarketDashboard.tsx'
import { OpenPositionForm } from '@/features/trading/components/OpenPositionForm.tsx'
import { PositionList } from '@/features/trading/components/PositionList.tsx'
import { LiquidityPanel } from '@/features/liquidity/components/LiquidityPanel.tsx'
import { AdminPanel } from '@/features/admin/components/AdminPanel.tsx'
import { useRoles } from '@/features/roles/hooks/useRoles.ts'
import './App.css'

type Tab = 'trade' | 'earn' | 'admin'

function App() {
  const account = useCurrentAccount()
  const { roles } = useRoles()
  const [tab, setTab] = useState<Tab>('trade')

  const hasOperatorRole =
    roles.isAdmin ||
    roles.isRiskOperator ||
    roles.isTreasurer ||
    roles.isPriceOperator ||
    roles.isFaucetOperator

  const tabs: { id: Tab; label: string }[] = [
    { id: 'trade', label: 'Trade' },
    { id: 'earn', label: 'Earn' },
    ...(hasOperatorRole ? [{ id: 'admin' as Tab, label: 'Admin' }] : []),
  ]

  const active = tab === 'admin' && !hasOperatorRole ? 'trade' : tab

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <h1>perp_dex</h1>
          <nav className="tabs">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                className={active === t.id ? 'tab tab-active' : 'tab'}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>
        <ConnectButton />
      </header>

      <main className="app-main">
        {active === 'trade' && (
          <>
            <MarketDashboard />
            {account ? (
              <div className="trading-area">
                <OpenPositionForm />
                <PositionList />
              </div>
            ) : (
              <p className="connect-hint">Connect a testnet wallet to trade.</p>
            )}
          </>
        )}

        {active === 'earn' && <LiquidityPanel />}
        {active === 'admin' && <AdminPanel />}
      </main>
    </div>
  )
}

export default App
