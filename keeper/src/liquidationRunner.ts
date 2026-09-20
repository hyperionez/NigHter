import { Transaction } from "@mysten/sui/transactions";
import { config } from "./config.js";
import { keeperKeypair, keeperAddress } from "./suiClient.js";
import { fetchMarket, fetchPosition, fetchCurrentPrice } from "./chain.js";
import {
  checkLiquidatable,
  updatePriceFeeds,
  fetchFreshAccumulatorMessage,
  fetchGasCoin,
  fetchReferenceGasPrice,
  fetchSharedObjectInitialVersion,
  executeTransaction,
} from "@perp-dex/shared";
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
        `< maintenance ${market.maintenanceMarginBps}bps.`
    );

    if (config.priceSource !== "pyth") {
      console.log(
        `[liquidation] PRICE_SOURCE=mock - dry-run finding only, not submitting a real tx. ` +
          `See README "Price source".`
      );
      continue;
    }

    try {
      const tx = await buildLiquidateTransactionWithFreshPrice(tracked.positionId);
      const submitResult = await submitTransaction(tx);
      if (submitResult.status === "SUCCESS") {
        console.log(`[liquidation] SUCCESS: ${tracked.positionId} liquidated, tx ${submitResult.digest}`);
        store.remove(tracked.positionId);
      } else {
        console.error(
          `[liquidation] FAILED: ${tracked.positionId} status=${submitResult.status} ${submitResult.error ?? ""}`
        );
      }
    } catch (err) {
      console.error(`[liquidation] submit failed for ${tracked.positionId}:`, err);
    }
  }
}

export async function buildLiquidateTransactionWithFreshPrice(positionId: string): Promise<Transaction> {
  const accumulatorMessage = await fetchFreshAccumulatorMessage(config.pythFeedId);

  const [marketVersion, vaultVersion, treasuryVersion, positionVersion, gasPrice, gasCoin] = await Promise.all([
    fetchSharedObjectInitialVersion(config.network, config.marketId),
    fetchSharedObjectInitialVersion(config.network, config.vaultId),
    fetchSharedObjectInitialVersion(config.network, config.treasuryId),
    fetchSharedObjectInitialVersion(config.network, positionId),
    fetchReferenceGasPrice(config.network),
    fetchGasCoin(config.network, keeperAddress),
  ]);

  const tx = new Transaction();
  tx.setSender(keeperAddress);
  tx.setGasPrice(gasPrice);
  tx.setGasBudget(GAS_BUDGET);
  tx.setGasPayment([{ objectId: gasCoin.objectId, version: gasCoin.version, digest: gasCoin.digest }]);

  const [priceInfoObjectId] = await updatePriceFeeds(tx, accumulatorMessage, [config.pythFeedId]);
  const priceVersion = await fetchSharedObjectInitialVersion(config.network, priceInfoObjectId!);

  tx.moveCall({
    target: `${config.packageId}::liquidation::liquidate`,
    arguments: [
      tx.sharedObjectRef({ objectId: config.marketId, initialSharedVersion: marketVersion, mutable: true }),
      tx.sharedObjectRef({ objectId: config.vaultId, initialSharedVersion: vaultVersion, mutable: true }),
      tx.sharedObjectRef({ objectId: config.treasuryId, initialSharedVersion: treasuryVersion, mutable: true }),
      tx.sharedObjectRef({ objectId: positionId, initialSharedVersion: positionVersion, mutable: true }),
      tx.sharedObjectRef({ objectId: priceInfoObjectId!, initialSharedVersion: priceVersion, mutable: false }),
      tx.sharedObjectRef({
        objectId: CLOCK_OBJECT_ID,
        initialSharedVersion: CLOCK_INITIAL_SHARED_VERSION,
        mutable: false,
      }),
    ],
  });

  return tx;
}

export async function buildLiquidateTransaction(
  positionId: string,
  priceInfoObjectId: string
): Promise<Transaction> {
  const [marketVersion, vaultVersion, treasuryVersion, positionVersion, priceVersion, gasPrice, gasCoin] =
    await Promise.all([
      fetchSharedObjectInitialVersion(config.network, config.marketId),
      fetchSharedObjectInitialVersion(config.network, config.vaultId),
      fetchSharedObjectInitialVersion(config.network, config.treasuryId),
      fetchSharedObjectInitialVersion(config.network, positionId),
      fetchSharedObjectInitialVersion(config.network, priceInfoObjectId),
      fetchReferenceGasPrice(config.network),
      fetchGasCoin(config.network, keeperAddress),
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
  return executeTransaction(config.network, bytes, [signature]);
}
