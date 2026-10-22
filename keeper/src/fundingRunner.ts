import { Transaction } from "@mysten/sui/transactions";
import { config } from "./config.js";
import { keeperKeypair, keeperAddress } from "./suiClient.js";
import {
  fetchReferenceGasPrice,
  fetchSharedObjectInitialVersion,
  executeTransaction,
} from "@perp-dex/shared";
import { nextGasCoin, rememberGasCoin, forgetGasCoin } from "./gasCoin.js";

const CLOCK_OBJECT_ID = "0x6";
const CLOCK_INITIAL_SHARED_VERSION = "1";
const GAS_BUDGET = 50_000_000n;

export async function runFundingCrank(): Promise<void> {
  try {
    const [marketInitialSharedVersion, gasPrice, gasCoin] = await Promise.all([
      fetchSharedObjectInitialVersion(config.network, config.marketId),
      fetchReferenceGasPrice(config.network),
      nextGasCoin(),
    ]);

    const tx = new Transaction();
    tx.setSender(keeperAddress);
    tx.setGasPrice(gasPrice);
    tx.setGasBudget(GAS_BUDGET);
    tx.setGasPayment([
      { objectId: gasCoin.objectId, version: gasCoin.version, digest: gasCoin.digest },
    ]);

    const marketArg = tx.sharedObjectRef({
      objectId: config.marketId,
      initialSharedVersion: marketInitialSharedVersion,
      mutable: true,
    });
    const clockArg = tx.sharedObjectRef({
      objectId: CLOCK_OBJECT_ID,
      initialSharedVersion: CLOCK_INITIAL_SHARED_VERSION,
      mutable: false,
    });

    tx.moveCall({
      target: `${config.packageId}::funding::crank_funding`,
      arguments: [marketArg, clockArg],
    });

    const bytes = await tx.build();
    const { signature } = await keeperKeypair.signTransaction(bytes);
    const result = await executeTransaction(config.network, bytes, [signature]);
    rememberGasCoin(result.gasObject);

    if (result.status !== "SUCCESS") {
      console.error(`[funding] crank_funding executed but failed: ${result.status} ${result.error ?? ""}`);
      return;
    }
    console.log(`[funding] crank_funding submitted: ${result.digest}`);
  } catch (err) {
    forgetGasCoin();
    console.error("[funding] crank_funding failed:", err);
  }
}
