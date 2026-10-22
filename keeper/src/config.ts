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
  pythFeedId: process.env.PYTH_FEED_ID ?? "",
  pythApiKey: process.env.PYTH_API_KEY ?? "",
  pollIntervalMs: Number(process.env.POLL_INTERVAL_MS ?? 30_000),
  fundingCrankIntervalMs: Number(process.env.FUNDING_CRANK_INTERVAL_MS ?? 600_000),
};

if (config.priceSource === "pyth" && !config.pythApiKey) {
  throw new Error(
    "PRICE_SOURCE=pyth requires PYTH_API_KEY to be set in keeper/.env - Hermes has rejected " +
      "unauthenticated requests since 2026-08-26. A demo market needs no key at all. See README."
  );
}

if (config.priceSource === "pyth" && !config.pythFeedId) {
  throw new Error(
    "PRICE_SOURCE=pyth requires PYTH_FEED_ID to be set in keeper/.env - it must match " +
      "the deployed Market's pyth_price_feed_id exactly, or oracle::validate_and_scale " +
      "will abort with EInvalidID on every submitted transaction. See README."
  );
}
