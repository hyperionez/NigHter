import process from "node:process";
import { HermesClient } from "@pythnetwork/hermes-client";
import { Transaction } from "@mysten/sui/transactions";
import { keeperKeypair, keeperAddress } from "./suiClient.js";
import { config } from "./config.js";
import {
  createPriceFeed,
  fetchBaseUpdateFee,
  fetchGasCoin,
  fetchReferenceGasPrice,
  executeTransaction,
} from "@perp-dex/shared";

const GAS_BUDGET = 200_000_000n;

const KNOWN_FEED_ALIASES: Record<string, string> = {
  BTC: "f9c0172ba10dfa4d19088d94f5bf61d3b54d5bd7483a322a982e1373ee8ea31b",
  SUI: "50c67b3fd225db8912a424dd4baed60ffdde625ed2feaaf283724f9608fea266",
};

function resolveFeedIds(args: string[]): string[] {
  if (args.length === 0) {
    throw new Error(
      "Usage: npm run register-price-feed -- <feedId|alias> [feedId|alias ...]\n" +
        `Known aliases: ${Object.keys(KNOWN_FEED_ALIASES).join(", ")}\n` +
        "Any other value must be a raw 32-byte hex Pyth feed id (no 0x prefix needed)."
    );
  }
  return args.map((arg) => {
    const alias = KNOWN_FEED_ALIASES[arg.toUpperCase()];
    return alias ?? arg.replace(/^0x/, "");
  });
}

async function main() {
  const feedIds = resolveFeedIds(process.argv.slice(2));
  console.log(`Registering ${feedIds.length} price feed(s) using keeper address ${keeperAddress}: ${feedIds.join(", ")}`);

  const hermes = new HermesClient("https://hermes-beta.pyth.network");
  const updates = await hermes.getLatestPriceUpdates(feedIds);
  if (updates.binary.data.length !== 1) {
    throw new Error(
      `Expected Hermes to bundle all requested feeds into 1 accumulator message, got ${updates.binary.data.length}. ` +
        "This SDK path (see pythClient.ts createPriceFeed) only supports a single bundled message per transaction."
    );
  }
  const accumulatorMessage = Buffer.from(updates.binary.data[0]!, "hex");
  console.log(`Fetched Hermes update, ${accumulatorMessage.length} bytes`);

  const [gasPrice, gasCoin, baseUpdateFee] = await Promise.all([
    fetchReferenceGasPrice(config.network),
    fetchGasCoin(config.network, keeperAddress),
    fetchBaseUpdateFee(),
  ]);
  console.log(`Base update fee: ${baseUpdateFee}`);

  const tx = new Transaction();
  tx.setSender(keeperAddress);
  tx.setGasPrice(gasPrice);
  tx.setGasBudget(GAS_BUDGET);
  tx.setGasPayment([
    { objectId: gasCoin.objectId, version: gasCoin.version, digest: gasCoin.digest },
  ]);

  await createPriceFeed(tx, accumulatorMessage);

  const bytes = await tx.build();
  const { signature } = await keeperKeypair.signTransaction(bytes);
  const result = await executeTransaction(config.network, bytes, [signature]);

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
