import { useState } from 'react'
import { useCurrentAccount } from '@mysten/dapp-kit-react'
import { ConnectButton } from '@mysten/dapp-kit-react/ui'
import { AccountOverview } from '@/features/account/components/AccountOverview.tsx'
import { MarketTicker } from '@/features/market/components/MarketTicker.tsx'
import { PriceChart } from '@/features/market/components/PriceChart.tsx'
import { PriceFeedBanner } from '@/features/market/components/PriceFeedBanner.tsx'
import { OpenPositionForm } from '@/features/trading/components/OpenPositionForm.tsx'
import { PositionList } from '@/features/trading/components/PositionList.tsx'
import { LiquidityPanel } from '@/features/liquidity/components/LiquidityPanel.tsx'
import { AdminPanel } from '@/features/admin/components/AdminPanel.tsx'
import { useRoles } from '@/features/roles/hooks/useRoles.ts'
import { BrandMark } from './BrandMark.tsx'
import { usePrivacy } from './privacy.tsx'
import './App.css'

type Tab = 'overview' | 'trade' | 'earn' | 'admin'

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M1.5 8S3.9 3.5 8 3.5 14.5 8 14.5 8 12.1 12.5 8 12.5 1.5 8 1.5 8Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3" />
      {off && <path d="M3 13 13 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />}
    </svg>
  )
}

function App() {
  const account = useCurrentAccount()
  const { roles } = useRoles()
  const { hidden, toggle } = usePrivacy()
  const [tab, setTab] = useState<Tab>('trade')

  const hasOperatorRole =
    roles.isAdmin ||
    roles.isRiskOperator ||
    roles.isTreasurer ||
    roles.isPriceOperator ||
    roles.isFaucetOperator

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
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

        <button
          type="button"
          className="icon-btn"
          aria-pressed={hidden}
          title={hidden ? 'Show amounts' : 'Hide amounts'}
          aria-label={hidden ? 'Show amounts' : 'Hide amounts'}
          onClick={toggle}
        >
          <EyeIcon off={hidden} />
        </button>

        <ConnectButton />
      </header>

      <main className="app-main">
        {active === 'overview' && <AccountOverview />}

        {active === 'trade' && (
          <div className="trading-layout">
            <aside className="trade-rail">
              {account ? (
                <OpenPositionForm />
              ) : (
                <section className="panel panel-pad">
                  <span className="stat-label">Open a trade</span>
                  <p className="explainer">
                    Connect a testnet wallet to trade. The price and chart are live without one.
                  </p>
                </section>
              )}
            </aside>

            <div className="trade-main">
              <PriceFeedBanner />
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
