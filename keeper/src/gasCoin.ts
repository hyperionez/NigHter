import { fetchGasCoin } from "@perp-dex/shared";
import { config } from "./config.js";
import { keeperAddress } from "./suiClient.js";

export interface GasCoinRef {
  objectId: string;
  version: string;
  digest: string;
}

let cached: GasCoinRef | undefined;

export async function nextGasCoin(): Promise<GasCoinRef> {
  if (cached) {
    return cached;
  }
  cached = await fetchGasCoin(config.network, keeperAddress);
  return cached;
}

export function rememberGasCoin(ref: GasCoinRef | undefined): void {
  cached = ref;
}

export function forgetGasCoin(): void {
  cached = undefined;
}
