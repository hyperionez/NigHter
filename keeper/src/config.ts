import "dotenv/config";
import process from "node:process";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required env var ${name}. Copy .env.example to .env and fill it in.`
    );
  }
  return value;
}

export type PriceSource = "mock" | "pyth";

export const config = {
  network: (process.env.NETWORK ?? "testnet") as "testnet" | "mainnet" | "localnet",
  packageId: required("PACKAGE_ID"),
  marketId: required("MARKET_ID"),
  vaultId: required("VAULT_ID"),
  treasuryId: required("TREASURY_ID"),
  keeperPrivateKey: required("KEEPER_PRIVATE_KEY"),
  priceSource: (process.env.PRICE_SOURCE ?? "mock") as PriceSource,
  pollIntervalMs: Number(process.env.POLL_INTERVAL_MS ?? 30_000),
  fundingCrankIntervalMs: Number(process.env.FUNDING_CRANK_INTERVAL_MS ?? 600_000),
};

if (config.priceSource === "pyth") {
  throw new Error(
    "PRICE_SOURCE=pyth is not implemented yet - the deployed test market's " +
      "pyth_price_feed_id is a placeholder, not a real Pyth feed id, so there is " +
      "nothing to validate a real PriceInfoObject against yet. Use PRICE_SOURCE=mock " +
      "until the target market is configured with a genuine feed id. See README."
  );
}
