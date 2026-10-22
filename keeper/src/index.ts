import process from "node:process";
import { config } from "./config.js";
import { keeperAddress } from "./suiClient.js";
import { PositionStore } from "./positionStore.js";
import { syncEvents } from "./eventIndexer.js";
import { runLiquidationSweep } from "./liquidationRunner.js";
import { runFundingCrank } from "./fundingRunner.js";

async function main() {
  console.log(`perp_dex keeper starting - address ${keeperAddress}, market ${config.marketId}`);
  console.log(`price source: ${config.priceSource} (see README before expecting real liquidations to fire)`);

  const store = new PositionStore();
  let cursor: Awaited<ReturnType<typeof syncEvents>> = {};
  let lastFundingCrankAt = 0;

  for (;;) {
    try {
      cursor = await syncEvents(store, cursor);
      console.log(`[indexer] tracking ${store.size} open position(s)`);

      const now = Date.now();
      if (now - lastFundingCrankAt >= config.fundingCrankIntervalMs) {
        await runFundingCrank();
        lastFundingCrankAt = now;
      }

      await runLiquidationSweep(store);
    } catch (err) {
      console.error("[keeper] tick failed, will retry next interval:", err);
    }

    await new Promise((resolve) => setTimeout(resolve, config.pollIntervalMs));
  }
}

main().catch((err) => {
  console.error("[keeper] fatal error:", err);
  process.exit(1);
});
