import process from "node:process";
import { HermesClient } from "@pythnetwork/hermes-client";
import { Transaction } from "@mysten/sui/transactions";
import { keeperKeypair, keeperAddress } from "./suiClient.js";
import { config } from "./config.js";
import { updatePriceFeeds } from "./pythClient.js";
import {
  fetchGasCoin,
  fetchObjectRef,
  fetchReferenceGasPrice,
  fetchSharedObjectInitialVersion,
  executeTransaction,
} from "./graphqlClient.js";

const BTC_TESTNET_FEED_ID = "f9c0172ba10dfa4d19088d94f5bf61d3b54d5bd7483a322a982e1373ee8ea31b";
const GAS_BUDGET = 300_000_000n;

async function main() {
  const [collateralCoinId, sideArg, leverageArg] = process.argv.slice(2);
  if (!collateralCoinId) {
    throw new Error(
      "Usage: npm run open-position -- <collateralCoinObjectId> [long|short] [leverage]\n" +
        "collateralCoinObjectId must be a Coin<TEST_USDC> already owned by the keeper address."
    );
  }
  const isLong = (sideArg ?? "long").toLowerCase() !== "short";
  const leverage = BigInt(leverageArg ?? "5");

  console.log(`Opening ${isLong ? "long" : "short"} position, ${leverage}x, using keeper address ${keeperAddress}`);

  const hermes = new HermesClient("https://hermes-beta.pyth.network");
  const updates = await hermes.getLatestPriceUpdates([BTC_TESTNET_FEED_ID]);
  const accumulatorMessage = Buffer.from(updates.binary.data[0]!, "hex");
  console.log(`Fetched fresh Hermes update, ${accumulatorMessage.length} bytes`);

  const [gasPrice, gasCoin, marketVersion, vaultVersion, treasuryVersion, collateralRef] = await Promise.all([
    fetchReferenceGasPrice(),
    fetchGasCoin(keeperAddress),
    fetchSharedObjectInitialVersion(config.marketId),
    fetchSharedObjectInitialVersion(config.vaultId),
    fetchSharedObjectInitialVersion(config.treasuryId),
    fetchObjectRef(collateralCoinId),
  ]);

  const tx = new Transaction();
  tx.setSender(keeperAddress);
  tx.setGasPrice(gasPrice);
  tx.setGasBudget(GAS_BUDGET);
  tx.setGasPayment([{ objectId: gasCoin.objectId, version: gasCoin.version, digest: gasCoin.digest }]);

  const [priceInfoObjectId] = await updatePriceFeeds(tx, accumulatorMessage, [BTC_TESTNET_FEED_ID]);
  console.log(`PriceInfoObject refreshed: ${priceInfoObjectId}`);
  const priceInfoVersion = await fetchSharedObjectInitialVersion(priceInfoObjectId!);

  tx.moveCall({
    target: `${config.packageId}::router::open_position`,
    arguments: [
      tx.sharedObjectRef({ objectId: config.marketId, initialSharedVersion: marketVersion, mutable: true }),
      tx.sharedObjectRef({ objectId: config.vaultId, initialSharedVersion: vaultVersion, mutable: true }),
      tx.sharedObjectRef({ objectId: config.treasuryId, initialSharedVersion: treasuryVersion, mutable: true }),
      tx.objectRef(collateralRef),
      tx.pure.bool(isLong),
      tx.pure.u64(leverage),
      tx.sharedObjectRef({ objectId: priceInfoObjectId!, initialSharedVersion: priceInfoVersion, mutable: true }),
      tx.sharedObjectRef({ objectId: "0x6", initialSharedVersion: "1", mutable: false }),
    ],
  });

  const bytes = await tx.build();
  const { signature } = await keeperKeypair.signTransaction(bytes);
  const result = await executeTransaction(bytes, [signature]);

  if (result.status !== "SUCCESS") {
    console.error(`FAILED: ${result.status} ${result.error ?? ""}`);
    process.exitCode = 1;
    return;
  }
  console.log(`SUCCESS: ${result.digest}`);
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exitCode = 1;
});
