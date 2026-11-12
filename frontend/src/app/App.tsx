import { useState } from 'react'
import { useCurrentAccount } from '@mysten/dapp-kit-react'
import { ConnectButton } from '@mysten/dapp-kit-react/ui'
import { MarketDashboard } from '@/features/market/components/MarketDashboard.tsx'
import { MarketTicker } from '@/features/market/components/MarketTicker.tsx'
import { PriceChart } from '@/features/market/components/PriceChart.tsx'
import { OpenPositionForm } from '@/features/trading/components/OpenPositionForm.tsx'
import { PositionList } from '@/features/trading/components/PositionList.tsx'
import { LiquidityPanel } from '@/features/liquidity/components/LiquidityPanel.tsx'
import { AdminPanel } from '@/features/admin/components/AdminPanel.tsx'
import { useRoles } from '@/features/roles/hooks/useRoles.ts'
import { BrandMark } from './BrandMark.tsx'
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
        <span className="brand-lockup">
          <BrandMark size={20} />
          <h1>NigHter</h1>
        </span>

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

        <MarketTicker />
        <span className="panel-spacer" />
        <ConnectButton />
      </header>

      <main className="app-main">
        {active === 'trade' && (
          <div className="trading-layout">
            <aside className="trade-rail">
              {account ? (
                <OpenPositionForm />
              ) : (
                <section className="panel panel-pad">
                  <span className="stat-label">Open position</span>
                  <p className="explainer">
                    Connect a testnet wallet to trade. The market, chart and open interest below are
                    live without one.
                  </p>
                </section>
              )}
            </aside>

            <div className="trade-main">
              <MarketDashboard />
              <PriceChart />
              {account && <PositionList />}
            </div>
          </div>
        )}

        {active === 'earn' && <LiquidityPanel />}
        {active === 'admin' && <AdminPanel />}
      </main>
    </div>
  )
}

export default App
