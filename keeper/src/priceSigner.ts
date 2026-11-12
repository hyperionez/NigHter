import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import {
  bytesToHexPrefixed,
  encodePriceReportMessage,
  parseDecimalToScaled,
  PRICE_SIGNATURE_BYTE_LENGTH,
  type SignedPriceReport,
} from "@perp-dex/shared";
import { config } from "./config.js";

const BINANCE_TICKER_URL = "https://api.binance.com/api/v3/ticker/price";

export interface PriceObservation {
  price: bigint;
  observedAtMs: number;
}

export interface SignedPriceContext {
  marketId: string;
  maxPriceStalenessMs: number;
  onChainSigner: string;
}

let keypair: Ed25519Keypair | undefined;
let observation: PriceObservation | undefined;
let pollTimer: ReturnType<typeof setInterval> | undefined;

function signingKeypair(): Ed25519Keypair {
  if (!keypair) {
    if (!config.priceSignerPrivateKey) {
      throw new Error(
        "PRICE_SIGNER_PRIVATE_KEY is not set in keeper/.env - run `npm run generate-price-signer`"
      );
    }
    keypair = Ed25519Keypair.fromSecretKey(config.priceSignerPrivateKey);
  }
  return keypair;
}

export function priceSignerPublicKeyHex(): string {
  return bytesToHexPrefixed(signingKeypair().getPublicKey().toRawBytes());
}

export async function fetchBinancePrice(symbol: string = config.priceSignerSymbol): Promise<bigint> {
  const response = await fetch(`${BINANCE_TICKER_URL}?symbol=${encodeURIComponent(symbol)}`);
  if (!response.ok) {
    throw new Error(
      `Binance ticker for ${symbol} returned HTTP ${response.status} ${response.statusText}`
    );
  }
  const body = (await response.json()) as { symbol?: string; price?: unknown };
  if (typeof body.price !== "string") {
    throw new Error(
      `Binance ticker for ${symbol} returned no price string: ${JSON.stringify(body)}`
    );
  }
  return parseDecimalToScaled(body.price);
}

export async function pollPriceOnce(): Promise<PriceObservation> {
  const price = await fetchBinancePrice();
  observation = { price, observedAtMs: Date.now() };
  return observation;
}

export function lastObservation(): PriceObservation | undefined {
  return observation;
}

export async function currentObservation(): Promise<PriceObservation> {
  if (observation) {
    return observation;
  }
  return pollPriceOnce();
}

export async function signedFeedPrice(): Promise<bigint> {
  return (await currentObservation()).price;
}

export async function startPricePolling(): Promise<void> {
  await pollPriceOnce();
  if (pollTimer) {
    return;
  }
  pollTimer = setInterval(() => {
    pollPriceOnce().catch((err) => {
      console.error("[price] poll failed, keeping the previous observation:", err);
    });
  }, config.priceSignerPollIntervalMs);
  pollTimer.unref?.();
}

export function stopPricePolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = undefined;
  }
}

export async function buildSignedPriceReport(
  context: SignedPriceContext
): Promise<SignedPriceReport> {
  const signer = signingKeypair();
  const publicKey = priceSignerPublicKeyHex();

  if (context.onChainSigner && context.onChainSigner !== publicKey) {
    throw new Error(
      `Market ${context.marketId} has price_signer ${context.onChainSigner} but this keeper signs ` +
        `with ${publicKey}. Every report would abort on chain with EInvalidPriceSignature. Pass the ` +
        `keeper's public key to create_market (or market::set_price_signer) and restart.`
    );
  }

  const { price, observedAtMs } = await currentObservation();
  const signedTimestampMs = observedAtMs - config.priceSignerTimestampSkewMs;
  const ageMs = Date.now() - signedTimestampMs;
  const submissionHeadroomMs = config.priceSignerTimestampSkewMs;

  if (ageMs + submissionHeadroomMs >= context.maxPriceStalenessMs) {
    throw new Error(
      `Cached price observation is ${ageMs}ms old and the market's staleness window is ` +
        `${context.maxPriceStalenessMs}ms. Signing it would produce a report that aborts on chain ` +
        `with EStalePrice. Check that the Binance poller is still running.`
    );
  }

  const message = encodePriceReportMessage(context.marketId, price, BigInt(signedTimestampMs));
  const signature = await signer.sign(message);
  if (signature.length !== PRICE_SIGNATURE_BYTE_LENGTH) {
    throw new Error(
      `Expected a raw ${PRICE_SIGNATURE_BYTE_LENGTH}-byte ed25519 signature, got ${signature.length} ` +
        `bytes - sui::ed25519::ed25519_verify would reject it`
    );
  }

  return {
    marketId: context.marketId,
    price: price.toString(),
    timestampMs: signedTimestampMs.toString(),
    signature: bytesToHexPrefixed(signature),
    publicKey,
  };
}
