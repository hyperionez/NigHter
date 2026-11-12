import { useState } from 'react'
import { useCurrentAccount } from '@mysten/dapp-kit-react'
import { useMarket } from '@/features/market/hooks/useMarket.ts'
import { useRoles } from '@/features/roles/hooks/useRoles.ts'
import { useObject } from '@/lib/sui/useObject.ts'
import { config } from '@/config/index.ts'
import {
  useSetPaused,
  useSetMockPrice,
  useSetDemoPrice,
  useWithdrawTreasury,
  useMintCap,
  useMintUsdc,
} from '../hooks/useAdminActions.ts'
import { formatUsdc, formatPrice, formatBps, toUsdcRaw, toPriceRaw, maxLeverageFrom } from '@/lib/format.ts'
import './AdminPanel.css'

function Card({
  title,
  cap,
  children,
}: {
  title: string
  cap?: string
  children: React.ReactNode
}) {
  return (
    <section className="panel panel-pad">
      <div className="card-head">
        <span className="stat-label">{title}</span>
        {cap && <span className="panel-meta">{cap}</span>}
      </div>
      {children}
    </section>
  )
}

export function AdminPanel() {
  const account = useCurrentAccount()
  const { market } = useMarket()
  const { roles, isPending } = useRoles()
  const treasury = useObject(config.treasuryId)

  const setPaused = useSetPaused()
  const setMockPrice = useSetMockPrice()
  const setDemoPrice = useSetDemoPrice()
  const withdrawTreasury = useWithdrawTreasury()
  const mintCap = useMintCap()
  const mintUsdc = useMintUsdc()

  const [price, setPrice] = useState('')
  const [payoutAmount, setPayoutAmount] = useState('')
  const [capRecipient, setCapRecipient] = useState('')
  const [faucetAmount, setFaucetAmount] = useState('1000')

  if (!account) return <p className="muted">Connect a wallet to see what you are allowed to do here.</p>
  if (isPending) return <p className="muted">Checking what this wallet can do...</p>

  const anyRole =
    roles.isAdmin || roles.isRiskOperator || roles.isTreasurer || roles.isPriceOperator || roles.isFaucetOperator

  if (!anyRole) {
    return (
      <p className="muted">
        This wallet holds none of the roles for this deployment. A role is proven by holding a
        specific object, so nothing on this page applies to it.
      </p>
    )
  }

  const treasuryBalance = treasury.data ? BigInt(treasury.data.balance as string) : undefined
  const priceRaw = toPriceRaw(price)
  const priceCapId = roles.riskCapId ?? roles.demoPriceCapId
  const usesDemoCap = roles.riskCapId === undefined && roles.demoPriceCapId !== undefined
  const priceAgeSecs =
    market?.lastPriceUpdateMs === undefined
      ? undefined
      : Math.max(0, Math.round((Date.now() - Number(market.lastPriceUpdateMs)) / 1000))

  const failure =
    setPaused.error ??
    setMockPrice.error ??
    setDemoPrice.error ??
    withdrawTreasury.error ??
    mintCap.error ??
    mintUsdc.error

  return (
    <section className="admin">
      <div className="role-badges">
        {roles.isAdmin && <span className="badge badge-admin">Admin</span>}
        {roles.isRiskOperator && <span className="badge">Can switch trading</span>}
        {roles.isTreasurer && <span className="badge">Can move the insurance fund</span>}
        {roles.isPriceOperator && <span className="badge">Can set the price</span>}
        {roles.isFaucetOperator && <span className="badge">Can mint test money</span>}
      </div>

      <p className="enforcement-note">
        Controls you do not have the role for are hidden, which is only to keep this page tidy.
        The real check happens on chain: a hidden button is not what stops anyone.
      </p>

      <div className="admin-body">
        <section className="panel admin-params">
          <div className="panel-head">
            <span className="panel-title">Market settings</span>
            <span className="panel-meta">BTC-PERP-DEMO</span>
            <span className="panel-spacer" />
            <span className="panel-meta">set once, cannot be changed</span>
          </div>

          {market && (
            <div className="table-scroll">
              <table className="data-table">
                <tbody>
                  <tr>
                    <td className="key">Minimum to open <span className="panel-meta">initial margin</span></td>
                    <td className="num">
                      {market.initialMarginBps} bps{' '}
                      <span className="panel-meta">({maxLeverageFrom(market.initialMarginBps)}x max)</span>
                    </td>
                  </tr>
                  <tr>
                    <td className="key">Auto-close level <span className="panel-meta">maintenance margin</span></td>
                    <td className="num">{market.maintenanceMarginBps} bps</td>
                  </tr>
                  <tr>
                    <td className="key">Opening / closing fee</td>
                    <td className="num">{market.openFeeBps} / {market.closeFeeBps} bps</td>
                  </tr>
                  <tr>
                    <td className="key">Largest total trade size</td>
                    <td className="num">{formatUsdc(market.maxOpenInterest)}</td>
                  </tr>
                  <tr>
                    <td className="key">Smallest trade size</td>
                    <td className="num">{formatUsdc(market.minPositionSize)}</td>
                  </tr>
                  <tr>
                    <td className="key">Hourly rate between sides</td>
                    <td className="num">{market.fundingRateBpsPerHour} bps / hour</td>
                  </tr>
                  <tr>
                    <td className="key">Auto-close penalty</td>
                    <td className="num">{formatBps(market.liquidationPenaltyBps)}</td>
                  </tr>
                  <tr>
                    <td className="key">Reward for closing a losing trade</td>
                    <td className="num">{formatBps(market.keeperRewardBps)}</td>
                  </tr>
                  <tr>
                    <td className="key">Price must be newer than</td>
                    <td className="num">{market.maxPriceStalenessSecs} s</td>
                  </tr>
                  <tr>
                    <td className="key">Who signs the price</td>
                    <td className="num signer">
                      {market.usesSignedPrice ? market.priceSignerHex : 'not set (manual)'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          <div className="panel-note">
            Everything above is decided when the market is created and no role can change it
            afterwards. The only exception is who signs the price, which an admin can swap out.
          </div>
        </section>

        <div className="admin-rail">
          {priceCapId && market?.demoMode && (
            <Card title="Price" cap={usesDemoCap ? 'DemoPriceCap' : 'RiskCap'}>
              {market.usesSignedPrice ? (
                <>
                  <p className="explainer">
                    Switched off: this market takes its price from the signed feed, so nothing here
                    would reach a trade. The chain turns down a hand-set price while a signer is in
                    place.
                  </p>
                  <button type="button" className="submit" disabled>
                    Set price
                  </button>
                </>
              ) : (
                <>
                  <div className="input-shell">
                    <input
                      aria-label="Mark price in dollars"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      inputMode="decimal"
                      placeholder={formatPrice(market.mockPrice)}
                    />
                    <span className="input-suffix">USD</span>
                  </div>

                  <div className="rows">
                    <div>
                      <span>Current</span>
                      <span>${formatPrice(market.mockPrice)}</span>
                    </div>
                    <div>
                      <span>Sent on chain as</span>
                      <span className="panel-meta">
                        {priceRaw > 0n ? priceRaw.toString() : '--'}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="submit"
                    disabled={priceRaw <= 0n || setMockPrice.isPending || setDemoPrice.isPending}
                    onClick={() => {
                      const params = { capId: priceCapId, price: priceRaw }
                      if (usesDemoCap) setDemoPrice.mutate(params)
                      else setMockPrice.mutate(params)
                    }}
                  >
                    {setMockPrice.isPending || setDemoPrice.isPending ? 'Confirm...' : 'Set price'}
                  </button>

                  <span className="explainer">
                    {priceAgeSecs === undefined
                      ? 'This market does not record when the price was last set.'
                      : `Last set ${priceAgeSecs}s ago.`}{' '}
                    Trading stops once this passes {market.maxPriceStalenessSecs}s, so a market left
                    alone turns trades down instead of running on a price nobody has touched.
                  </span>
                </>
              )}
            </Card>
          )}

          {roles.riskCapId && (
            <Card title="Trading switch" cap="RiskCap">
              <div className="state-row">
                <span className="state-label">{market?.paused ? 'Trading is off' : 'Trading is on'}</span>
                <span
                  className={market?.paused ? 'toggle' : 'toggle toggle-on'}
                  role="img"
                  aria-label={market?.paused ? 'Trading disabled' : 'Trading enabled'}
                >
                  <span className="toggle-knob" />
                </span>
              </div>

              <button
                type="button"
                className={market?.paused ? 'submit' : 'submit danger'}
                disabled={setPaused.isPending}
                onClick={() =>
                  setPaused.mutate({ riskCapId: roles.riskCapId!, paused: !market?.paused })
                }
              >
                {setPaused.isPending ? 'Confirm...' : market?.paused ? 'Switch trading on' : 'Switch trading off'}
              </button>

              <span className="explainer">
                Switching trading off blocks opening <em>and</em> closing. Open trades stay open and
                keep paying the hourly rate, so this is not a way out for anyone.
              </span>
            </Card>
          )}

          {roles.treasurerCapId && (
            <Card title="Insurance fund" cap="TreasurerCap">
              <span className="stat-value stat-value-lg">{formatUsdc(treasuryBalance)}</span>
              <span className="cell-note">
                Fees collected, minus rewards paid out when a trade went underwater
              </span>

              <div className="input-shell">
                <input
                  aria-label="Withdrawal amount"
                  value={payoutAmount}
                  onChange={(e) => setPayoutAmount(e.target.value)}
                  inputMode="decimal"
                  placeholder="0"
                />
                <span className="input-suffix">USDC</span>
              </div>

              <button
                type="button"
                className="ghost-btn ghost-btn-lg"
                disabled={Number(payoutAmount) <= 0 || withdrawTreasury.isPending}
                onClick={() =>
                  withdrawTreasury.mutate({
                    treasurerCapId: roles.treasurerCapId!,
                    amount: toUsdcRaw(Number(payoutAmount)),
                    recipient: account.address,
                  })
                }
              >
                {withdrawTreasury.isPending ? 'Confirm...' : 'Withdraw to my wallet'}
              </button>
            </Card>
          )}

          {roles.adminCapId && (
            <Card title="Give someone a role" cap="AdminCap">
              <span className="explainer">
                An admin can only hand out roles. It cannot switch trading off or touch the insurance
                fund itself.
              </span>

              <div className="input-shell">
                <input
                  aria-label="Recipient address"
                  value={capRecipient}
                  onChange={(e) => setCapRecipient(e.target.value)}
                  placeholder="0x..."
                />
              </div>

              <div className="card-actions">
                <button
                  type="button"
                  className="submit"
                  disabled={!capRecipient.startsWith('0x') || mintCap.isPending}
                  onClick={() =>
                    mintCap.mutate({
                      adminCapId: roles.adminCapId!,
                      cap: 'risk',
                      recipient: capRecipient,
                    })
                  }
                >
                  Mint RiskCap
                </button>
                <button
                  type="button"
                  className="ghost-btn ghost-btn-lg"
                  disabled={!capRecipient.startsWith('0x') || mintCap.isPending}
                  onClick={() =>
                    mintCap.mutate({
                      adminCapId: roles.adminCapId!,
                      cap: 'treasurer',
                      recipient: capRecipient,
                    })
                  }
                >
                  Mint TreasurerCap
                </button>
              </div>
            </Card>
          )}

          {roles.usdcTreasuryCapId && (
            <Card title="Test money faucet" cap="TreasuryCap">
              <div className="input-shell">
                <input
                  aria-label="Faucet amount"
                  value={faucetAmount}
                  onChange={(e) => setFaucetAmount(e.target.value)}
                  inputMode="decimal"
                />
                <span className="input-suffix">USDC</span>
              </div>
              <button
                type="button"
                className="submit"
                disabled={Number(faucetAmount) <= 0 || mintUsdc.isPending}
                onClick={() =>
                  mintUsdc.mutate({
                    usdcTreasuryCapId: roles.usdcTreasuryCapId!,
                    amount: toUsdcRaw(Number(faucetAmount)),
                    recipient: account.address,
                  })
                }
              >
                {mintUsdc.isPending ? 'Confirm...' : 'Mint to my wallet'}
              </button>
            </Card>
          )}
        </div>
      </div>

      {failure && <p className="error">{failure.message}</p>}
    </section>
  )
}
