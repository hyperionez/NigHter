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
import { formatUsdc, formatPrice, toUsdcRaw, toPriceRaw } from '@/lib/format.ts'
import './AdminPanel.css'

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

      <div className="admin-grid">
        {priceCapId && market?.demoMode && (
          <div className="admin-card">
            <h3>Mark price</h3>
            {market.usesSignedPrice ? (
              <>
                <p className="card-meta">
                  Disabled — this market takes its price from a signed keeper report, so the
                  trading entrypoints never read <code>mock_price</code> and writing it here would
                  change nothing on chain. The manual-price entrypoints themselves abort with{' '}
                  <code>ENotManualPriceMarket</code> (10) while a signer is set.
                </p>
                <p className="card-meta">
                  Signer: <code className="signer">{market.priceSignerHex}</code>
                </p>
                <button type="button" className="submit" disabled>
                  Set price
                </button>
              </>
            ) : (
              <>
                <p className="card-meta">
                  Current: <code>${formatPrice(market.mockPrice)}</code>
                  {usesDemoCap && <span className="via"> via DemoPriceCap</span>}
                </p>
                <label className="field">
                  <span>New price (USD)</span>
                  <input
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    inputMode="decimal"
                    placeholder="81508.03"
                  />
                  <small>
                    {priceRaw > 0n
                      ? `Sent on chain as ${priceRaw.toString()}`
                      : 'Enter dollars, e.g. 81508.03'}
                  </small>
                </label>
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
              </>
            )}
          </div>
        )}

        {roles.riskCapId && (
          <div className="admin-card">
            <h3>Circuit breaker</h3>
            <p className="card-meta">
              Market is <strong>{market?.paused ? 'paused' : 'live'}</strong>. Pausing blocks opens
              and closes; liquidation and funding keep running by design.
            </p>
            <button
              type="button"
              className={market?.paused ? 'submit' : 'submit danger'}
              disabled={setPaused.isPending}
              onClick={() =>
                setPaused.mutate({ riskCapId: roles.riskCapId!, paused: !market?.paused })
              }
            >
              {setPaused.isPending
                ? 'Confirm...'
                : market?.paused
                  ? 'Resume market'
                  : 'Pause market'}
            </button>
          </div>
        )}

        {roles.treasurerCapId && (
          <div className="admin-card">
            <h3>Treasury</h3>
            <p className="card-meta">
              Insurance fund: <code>${formatUsdc(treasuryBalance)}</code>
            </p>
            <label className="field">
              <span>Withdraw (TEST_USDC)</span>
              <input
                value={payoutAmount}
                onChange={(e) => setPayoutAmount(e.target.value)}
                inputMode="decimal"
              />
            </label>
            <button
              type="button"
              className="submit danger"
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
          </div>
        )}

        {roles.adminCapId && (
          <div className="admin-card">
            <h3>Delegate a role</h3>
            <p className="card-meta">
              AdminCap only mints derived capabilities. It can no longer pause a market or touch the
              treasury directly.
            </p>
            <label className="field">
              <span>Recipient address</span>
              <input
                value={capRecipient}
                onChange={(e) => setCapRecipient(e.target.value)}
                placeholder="0x..."
              />
            </label>
            <div className="lp-actions">
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
                className="secondary"
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
          </div>
        )}

        {roles.usdcTreasuryCapId && (
          <div className="admin-card">
            <h3>TEST_USDC faucet</h3>
            <p className="card-meta">Mock collateral for this testnet deployment.</p>
            <label className="field">
              <span>Amount</span>
              <input
                value={faucetAmount}
                onChange={(e) => setFaucetAmount(e.target.value)}
                inputMode="decimal"
              />
            </label>
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
          </div>
        )}
      </div>

      {failure && <p className="error">{failure.message}</p>}
    </section>
  )
}
