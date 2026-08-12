import { Transaction } from "@mysten/sui/transactions";
import { config } from "./config.js";
import { keeperKeypair, keeperAddress } from "./suiClient.js";
import { fetchMarket, fetchPosition, fetchCurrentPrice } from "./chain.js";
import { checkLiquidatable } from "./health.js";
import {
  fetchGasCoin,
  fetchReferenceGasPrice,
  fetchSharedObjectInitialVersion,
  executeTransaction,
} from "./graphqlClient.js";
import type { PositionStore } from "./positionStore.js";

const CLOCK_OBJECT_ID = "0x6";
const CLOCK_INITIAL_SHARED_VERSION = "1";
const GAS_BUDGET = 50_000_000n;

export async function runLiquidationSweep(store: PositionStore): Promise<void> {
  const positions = store.all();
  if (positions.length === 0) {
    console.log("[liquidation] no open positions tracked, nothing to check");
    return;
  }

  const market = await fetchMarket();
  const currentPrice = await fetchCurrentPrice(market);

  for (const tracked of positions) {
    const position = await fetchPosition(tracked.positionId);
    const result = checkLiquidatable(position, market, currentPrice);

    if (!result.liquidatable) {
      console.log(
        `[liquidation] ${tracked.positionId} healthy - margin ${result.marginRatioBps}bps ` +
          `(maintenance ${market.maintenanceMarginBps}bps)`
      );
      continue;
    }

    console.log(
      `[liquidation] ${tracked.positionId} IS LIQUIDATABLE - margin ${result.marginRatioBps}bps ` +
        `< maintenance ${market.maintenanceMarginBps}bps. ` +
        `PRICE_SOURCE=mock means this is a dry-run finding only - no real PriceInfoObject ` +
        `exists to actually submit liquidation::liquidate with. See README "Price source".`
    );
  }
}

export async function buildLiquidateTransaction(
  positionId: string,
  priceInfoObjectId: string
): Promise<Transaction> {
  const [marketVersion, vaultVersion, treasuryVersion, positionVersion, priceVersion, gasPrice, gasCoin] =
    await Promise.all([
      fetchSharedObjectInitialVersion(config.marketId),
      fetchSharedObjectInitialVersion(config.vaultId),
      fetchSharedObjectInitialVersion(config.treasuryId),
      fetchSharedObjectInitialVersion(positionId),
      fetchSharedObjectInitialVersion(priceInfoObjectId),
      fetchReferenceGasPrice(),
      fetchGasCoin(keeperAddress),
    ]);

  const tx = new Transaction();
  tx.setSender(keeperAddress);
  tx.setGasPrice(gasPrice);
  tx.setGasBudget(GAS_BUDGET);
  tx.setGasPayment([
    { objectId: gasCoin.objectId, version: gasCoin.version, digest: gasCoin.digest },
  ]);

  tx.moveCall({
    target: `${config.packageId}::liquidation::liquidate`,
    arguments: [
      tx.sharedObjectRef({ objectId: config.marketId, initialSharedVersion: marketVersion, mutable: true }),
      tx.sharedObjectRef({ objectId: config.vaultId, initialSharedVersion: vaultVersion, mutable: true }),
      tx.sharedObjectRef({ objectId: config.treasuryId, initialSharedVersion: treasuryVersion, mutable: true }),
      tx.sharedObjectRef({ objectId: positionId, initialSharedVersion: positionVersion, mutable: true }),
      tx.sharedObjectRef({ objectId: priceInfoObjectId, initialSharedVersion: priceVersion, mutable: false }),
      tx.sharedObjectRef({
        objectId: CLOCK_OBJECT_ID,
        initialSharedVersion: CLOCK_INITIAL_SHARED_VERSION,
        mutable: false,
      }),
    ],
  });

  return tx;
}

export async function submitTransaction(tx: Transaction) {
  const bytes = await tx.build();
  const { signature } = await keeperKeypair.signTransaction(bytes);
  return executeTransaction(bytes, [signature]);
}
