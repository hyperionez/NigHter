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

function optional(name: string, fallback: string): string {
  const value = process.env[name];
  return value === undefined || value.trim() === "" ? fallback : value.trim();
}

function numberWithDefault(name: string, fallback: number): number {
  const value = optional(name, "");
  if (value === "") {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`env var ${name} must be a number, got "${value}"`);
  }
  return parsed;
}

function booleanWithDefault(name: string, fallback: boolean): boolean {
  const value = optional(name, "");
  if (value === "") {
    return fallback;
  }
  return value === "1" || value.toLowerCase() === "true";
}

export type PriceSource = "mock" | "pyth" | "signed";

const priceSignerPrivateKey = optional("PRICE_SIGNER_PRIVATE_KEY", "");

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
  priceSignerPrivateKey,
  priceSignerPort: numberWithDefault("PRICE_SIGNER_PORT", 8787),
  priceSignerHost: optional("PRICE_SIGNER_HOST", "127.0.0.1"),
  priceSignerAllowedOrigin: optional("PRICE_SIGNER_ALLOWED_ORIGIN", "*"),
  priceSignerSymbol: optional("PRICE_SIGNER_SYMBOL", "BTCUSDT"),
  priceSignerPollIntervalMs: numberWithDefault("PRICE_SIGNER_POLL_INTERVAL_MS", 5_000),
  priceSignerTimestampSkewMs: numberWithDefault("PRICE_SIGNER_TIMESTAMP_SKEW_MS", 2_000),
  priceServerEnabled: booleanWithDefault("PRICE_SERVER_ENABLED", priceSignerPrivateKey.length > 0),
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

if (config.priceSource === "signed" && !config.priceSignerPrivateKey) {
  throw new Error(
    "PRICE_SOURCE=signed requires PRICE_SIGNER_PRIVATE_KEY to be set in keeper/.env - a " +
      "suiprivkey-bech32 string. Run `npm run generate-price-signer` to mint one, put the " +
      "printed public key hex into create_market's price_signer argument, and the printed " +
      "suiprivkey into keeper/.env. See README."
  );
}

if (config.priceSource === "signed" && !config.priceServerEnabled) {
  throw new Error(
    "PRICE_SOURCE=signed with PRICE_SERVER_ENABLED=false leaves no way for the frontend to " +
      "obtain a signed price report - the trader's own transaction has to carry it. Either " +
      "remove PRICE_SERVER_ENABLED from keeper/.env or set it to true. See README."
  );
}

if (config.priceServerEnabled && !config.priceSignerPrivateKey) {
  throw new Error(
    "PRICE_SERVER_ENABLED=true requires PRICE_SIGNER_PRIVATE_KEY to be set in keeper/.env - " +
      "there is nothing to sign reports with. Run `npm run generate-price-signer`. See README."
  );
}
