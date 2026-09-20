import { Transaction } from "@mysten/sui/transactions";
import { keeperKeypair, keeperAddress } from "./suiClient.js";
import { config } from "./config.js";
import { fetchPriceInfoObjectId } from "./pythClient.js";
import {
  fetchGasCoin,
  fetchReferenceGasPrice,
  fetchSharedObjectInitialVersion,
  executeTransaction,
} from "./graphqlClient.js";

const BTC_TESTNET_FEED_ID = "f9c0172ba10dfa4d19088d94f5bf61d3b54d5bd7483a322a982e1373ee8ea31b";
const CLOCK_OBJECT_ID = "0x6";
const CLOCK_INITIAL_SHARED_VERSION = "1";
const GAS_BUDGET = 300_000_000n;

async function main() {
  const positionId = process.argv[2];
  if (!positionId) {
    throw new Error("Usage: npm run verify-staleness -- <positionObjectId>");
  }

  const priceInfoObjectId = await fetchPriceInfoObjectId(BTC_TESTNET_FEED_ID);
  console.log(
    `Using the existing PriceInfoObject ${priceInfoObjectId} as-is - deliberately NOT ` +
      `calling update_price_feeds first, so its last update stays whatever it already was.`
  );

  const [gasPrice, gasCoin, marketVersion, vaultVersion, treasuryVersion, positionVersion, priceVersion] =
    await Promise.all([
      fetchReferenceGasPrice(),
      fetchGasCoin(keeperAddress),
      fetchSharedObjectInitialVersion(config.marketId),
      fetchSharedObjectInitialVersion(config.vaultId),
      fetchSharedObjectInitialVersion(config.treasuryId),
      fetchSharedObjectInitialVersion(positionId),
      fetchSharedObjectInitialVersion(priceInfoObjectId),
    ]);

  const tx = new Transaction();
  tx.setSender(keeperAddress);
  tx.setGasPrice(gasPrice);
  tx.setGasBudget(GAS_BUDGET);
  tx.setGasPayment([{ objectId: gasCoin.objectId, version: gasCoin.version, digest: gasCoin.digest }]);

  tx.moveCall({
    target: `${config.packageId}::router::close_position`,
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

  const bytes = await tx.build();
  const { signature } = await keeperKeypair.signTransaction(bytes);
  const result = await executeTransaction(bytes, [signature]);

  if (result.status === "SUCCESS") {
    console.error(
      `UNEXPECTED SUCCESS (digest ${result.digest}) - staleness rejection did NOT fire. ` +
        `oracle::get_validated_price is not actually enforcing max_price_staleness_secs. Investigate immediately.`
    );
    process.exitCode = 1;
    return;
  }

  console.log(`Transaction FAILED as expected: ${result.status} ${result.error ?? ""}`);
  console.log(`This confirms staleness rejection works - a stale price was correctly refused.`);
}

main().catch((err) => {
  console.error("Script error (not necessarily a tx failure):", err);
  process.exitCode = 1;
});
