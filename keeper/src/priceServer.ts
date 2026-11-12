import http from "node:http";
import { config } from "./config.js";
import { fetchMarket, signedPriceContext, type MarketRuntime } from "./chain.js";
import { buildSignedPriceReport, lastObservation, startPricePolling } from "./priceSigner.js";

const MARKET_CACHE_TTL_MS = 30_000;
const NO_OBSERVATION_AGE_MS = -1;

let marketCache: { market: MarketRuntime; fetchedAtMs: number } | undefined;

async function cachedMarket(): Promise<MarketRuntime> {
  if (marketCache && Date.now() - marketCache.fetchedAtMs < MARKET_CACHE_TTL_MS) {
    return marketCache.market;
  }
  const market = await fetchMarket();
  marketCache = { market, fetchedAtMs: Date.now() };
  return market;
}

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": config.priceSignerAllowedOrigin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    ...corsHeaders(),
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload).toString(),
    "Cache-Control": "no-store",
  });
  res.end(payload);
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders());
    res.end();
    return;
  }

  const path = (req.url ?? "/").split("?")[0];

  if (req.method !== "GET") {
    sendJson(res, 405, { error: `Method ${req.method} not allowed - this server only serves GET` });
    return;
  }

  if (path === "/health") {
    const observation = lastObservation();
    sendJson(res, 200, {
      ok: observation !== undefined,
      lastPriceAgeMs: observation ? Date.now() - observation.observedAtMs : NO_OBSERVATION_AGE_MS,
    });
    return;
  }

  if (path === "/price") {
    try {
      const market = await cachedMarket();
      if (!market.usesSignedPrice) {
        sendJson(res, 409, {
          error:
            `Market ${market.marketId} has an empty price_signer, so it is a manual-price market. ` +
            `The *_with_signed_price entrypoints would abort with ENotSignedPriceMarket. Pass this ` +
            `keeper's public key to create_market or market::set_price_signer.`,
        });
        return;
      }
      const report = await buildSignedPriceReport(signedPriceContext(market));
      sendJson(res, 200, report);
    } catch (err) {
      sendJson(res, 503, { error: errorMessage(err) });
    }
    return;
  }

  sendJson(res, 404, { error: `No route for ${path} - this server serves GET /price and GET /health` });
}

export async function startPriceServer(): Promise<string> {
  await startPricePolling();

  const server = http.createServer((req, res) => {
    handle(req, res).catch((err) => {
      if (!res.headersSent) {
        sendJson(res, 500, { error: errorMessage(err) });
        return;
      }
      res.end();
    });
  });

  server.on("error", (err) => {
    console.error("[price-server] server error:", err);
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(config.priceSignerPort, config.priceSignerHost, () => {
      server.off("error", reject);
      resolve();
    });
  });

  return `http://${config.priceSignerHost}:${config.priceSignerPort}`;
}
