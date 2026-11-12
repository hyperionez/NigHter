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

  if (!account) return <p className="muted">Connect a wallet to see your operator roles.</p>
  if (isPending) return <p className="muted">Checking roles...</p>

  const anyRole =
    roles.isAdmin || roles.isRiskOperator || roles.isTreasurer || roles.isPriceOperator || roles.isFaucetOperator

  if (!anyRole) {
    return (
      <p className="muted">
        This wallet holds no operator capability for the current package. Roles are proven by
        owning a capability object, so nothing here applies to it.
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
        {roles.isRiskOperator && <span className="badge">Risk operator</span>}
        {roles.isTreasurer && <span className="badge">Treasurer</span>}
        {roles.isPriceOperator && <span className="badge">Price operator</span>}
        {roles.isFaucetOperator && <span className="badge">Faucet</span>}
      </div>

      <p className="enforcement-note">
        These controls are hidden when the matching capability is absent, which is a convenience
        only. Authorization is enforced on chain by the Move package; a hidden button is not a
        security boundary.
      </p>

      <div className="admin-body">
        <section className="panel admin-params">
          <div className="panel-head">
            <span className="panel-title">Market parameters</span>
            <span className="panel-meta">BTC-PERP-DEMO</span>
            <span className="panel-spacer" />
            <span className="panel-meta">fixed at creation</span>
          </div>

          {market && (
            <div className="table-scroll">
              <table className="data-table">
                <tbody>
                  <tr>
                    <td className="key">Initial margin</td>
                    <td className="num">
                      {market.initialMarginBps} bps{' '}
                      <span className="panel-meta">({maxLeverageFrom(market.initialMarginBps)}x max)</span>
                    </td>
                  </tr>
                  <tr>
                    <td className="key">Maintenance margin</td>
                    <td className="num">{market.maintenanceMarginBps} bps</td>
                  </tr>
                  <tr>
                    <td className="key">Open / close fee</td>
                    <td className="num">{market.openFeeBps} / {market.closeFeeBps} bps</td>
                  </tr>
                  <tr>
                    <td className="key">Max open interest</td>
                    <td className="num">{formatUsdc(market.maxOpenInterest)}</td>
                  </tr>
                  <tr>
                    <td className="key">Min position size</td>
                    <td className="num">{formatUsdc(market.minPositionSize)}</td>
                  </tr>
                  <tr>
                    <td className="key">Funding rate</td>
                    <td className="num">{market.fundingRateBpsPerHour} bps / hour</td>
                  </tr>
                  <tr>
                    <td className="key">Liquidation penalty</td>
                    <td className="num">{formatBps(market.liquidationPenaltyBps)}</td>
                  </tr>
                  <tr>
                    <td className="key">Keeper reward</td>
                    <td className="num">{formatBps(market.keeperRewardBps)}</td>
                  </tr>
                  <tr>
                    <td className="key">Max price staleness</td>
                    <td className="num">{market.maxPriceStalenessSecs} s</td>
                  </tr>
                  <tr>
                    <td className="key">Price signer</td>
                    <td className="num signer">
                      {market.usesSignedPrice ? market.priceSignerHex : 'not set (manual)'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          <div className="panel-note">
            Every value above is fixed when the market is created and cannot be changed by any
            capability. Only the price signer can be rotated, with <code>set_price_signer</code>{' '}
            under AdminCap.
          </div>
        </section>

        <div className="admin-rail">
          {priceCapId && market?.demoMode && (
            <Card title="Mark price" cap={usesDemoCap ? 'DemoPriceCap' : 'RiskCap'}>
              {market.usesSignedPrice ? (
                <>
                  <p className="explainer">
                    Disabled: this market takes its price from a signed keeper report, so the
                    trading entrypoints never read <code>mock_price</code> and writing it here
                    would change nothing on chain. The manual-price entrypoints themselves abort
                    with <code>ENotManualPriceMarket</code> (10) while a signer is set.
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
                      ? 'This market records no price timestamp yet.'
                      : `Last set ${priceAgeSecs}s ago.`}{' '}
                    Trading aborts once this passes {market.maxPriceStalenessSecs}s, so a market
                    left unattended stops accepting orders rather than trading on a dead number.
                  </span>
                </>
              )}
            </Card>
          )}

          {roles.riskCapId && (
            <Card title="Market state" cap="RiskCap">
              <div className="state-row">
                <span className="state-label">Trading enabled</span>
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
                {setPaused.isPending ? 'Confirm...' : market?.paused ? 'Resume market' : 'Pause market'}
              </button>

              <span className="explainer">
                Pausing blocks opening <em>and</em> closing. Positions stay open and keep accruing
                funding, so this is not an exit.
              </span>
            </Card>
          )}

          {roles.treasurerCapId && (
            <Card title="Treasury" cap="TreasurerCap">
              <span className="stat-value stat-value-lg">{formatUsdc(treasuryBalance)}</span>
              <span className="cell-note">
                Fees collected, minus keeper rewards paid on bad debt
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
            <Card title="Delegate a role" cap="AdminCap">
              <span className="explainer">
                AdminCap only mints derived capabilities. It can no longer pause a market or touch
                the treasury directly.
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
            <Card title="TEST_USDC faucet" cap="TreasuryCap">
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
