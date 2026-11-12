import { Transaction } from '@mysten/sui/transactions'
import { config, CLOCK_OBJECT_ID } from '@/config/index.ts'

export interface SetPausedParams {
  riskCapId: string
  paused: boolean
}

export function buildSetPausedTx({ riskCapId, paused }: SetPausedParams): Transaction {
  const tx = new Transaction()
  tx.moveCall({
    target: `${config.packageId}::market::set_paused`,
    arguments: [tx.object(config.marketId), tx.object(riskCapId), tx.pure.bool(paused)],
  })
  return tx
}

export interface SetPriceParams {
  capId: string
  price: bigint
}

export function buildSetMockPriceTx({ capId, price }: SetPriceParams): Transaction {
  const tx = new Transaction()
  tx.moveCall({
    target: `${config.packageId}::market::set_mock_price`,
    arguments: [
      tx.object(config.marketId),
      tx.object(capId),
      tx.pure.u64(price),
      tx.object(CLOCK_OBJECT_ID),
    ],
  })
  return tx
}

export function buildSetDemoPriceTx({ capId, price }: SetPriceParams): Transaction {
  const tx = new Transaction()
  tx.moveCall({
    target: `${config.packageId}::market::set_demo_price`,
    arguments: [
      tx.object(config.marketId),
      tx.object(capId),
      tx.pure.u64(price),
      tx.object(CLOCK_OBJECT_ID),
    ],
  })
  return tx
}

export interface WithdrawTreasuryParams {
  treasurerCapId: string
  amount: bigint
  recipient: string
}

export function buildWithdrawTreasuryTx({
  treasurerCapId,
  amount,
  recipient,
}: WithdrawTreasuryParams): Transaction {
  const tx = new Transaction()
  const [payout] = tx.moveCall({
    target: `${config.packageId}::treasury::withdraw_treasury`,
    arguments: [
      tx.object(config.treasuryId),
      tx.object(treasurerCapId),
      tx.pure.u64(amount),
    ],
  })
  tx.transferObjects([payout!], recipient)
  return tx
}

export type DerivedCap = 'risk' | 'treasurer'

export interface MintCapParams {
  adminCapId: string
  cap: DerivedCap
  recipient: string
}

export function buildMintCapTx({ adminCapId, cap, recipient }: MintCapParams): Transaction {
  const tx = new Transaction()
  tx.moveCall({
    target: `${config.packageId}::admin::${cap === 'risk' ? 'mint_risk_cap' : 'mint_treasurer_cap'}`,
    arguments: [tx.object(adminCapId), tx.pure.address(recipient)],
  })
  return tx
}

export interface MintUsdcParams {
  usdcTreasuryCapId: string
  amount: bigint
  recipient: string
}

export function buildMintUsdcTx({
  usdcTreasuryCapId,
  amount,
  recipient,
}: MintUsdcParams): Transaction {
  const tx = new Transaction()
  const [minted] = tx.moveCall({
    target: `${config.packageId}::test_usdc::mint`,
    arguments: [tx.object(usdcTreasuryCapId), tx.pure.u64(amount)],
  })
  tx.transferObjects([minted!], recipient)
  return tx
}
