import { bcs } from "@mysten/sui/bcs";
import { Transaction } from "@mysten/sui/transactions";
import { HermesClient } from "@pythnetwork/hermes-client";
import { fetchObjectFields, fetchSharedObjectInitialVersion, graphqlRequest } from "./graphql.js";

export const HERMES_URL = "https://pyth.dourolabs.app/hermes";
const PRICE_DECIMALS = 9;
const MAX_ARGUMENT_SIZE = 16 * 1024;
const CLOCK_OBJECT_ID = "0x6";
const CLOCK_INITIAL_SHARED_VERSION = "1";
const PRICE_TABLE_PAGE_SIZE = 50;

export interface PythNetworkInfo {
  network: string;
  pythStateId: string;
  wormholeStateId: string;
}

export const TESTNET_PYTH: PythNetworkInfo = {
  network: "testnet",
  pythStateId: "0x243759059f4c3111179da5878c12f68d612c21a8d54d85edc86164bb18be1c7c",
  wormholeStateId: "0x31358d198147da50db32eda2562951d53973a0c0ad5ed738e9b17d88b213d790",
};

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function fetchPackageIdFromStateType(network: string, stateId: string): Promise<string> {
  const data = await graphqlRequest<{ object: { asMoveObject: { contents: { type: { repr: string } } } } | null }>(
    network,
    `query StateType($id: SuiAddress!) {
      object(address: $id) { asMoveObject { contents { type { repr } } } }
    }`,
    { id: stateId }
  );
  const repr = data.object?.asMoveObject.contents.type.repr;
  if (!repr) {
    throw new Error(`Could not read type of state object ${stateId}`);
  }
  return repr.split("::")[0]!;
}

async function fetchPriceTableId(network: string, pythStateId: string): Promise<string> {
  const data = await graphqlRequest<{
    object: { dynamicFields: { nodes: Array<{ name: { json: unknown }; value: { address?: string } | null }> } } | null;
  }>(
    network,
    `query PriceTable($id: SuiAddress!) {
      object(address: $id) {
        dynamicFields(first: ${PRICE_TABLE_PAGE_SIZE}) {
          nodes { name { json } value { __typename ... on MoveObject { address } } }
        }
      }
    }`,
    { id: pythStateId }
  );
  const nodes = data.object?.dynamicFields.nodes ?? [];
  const priceInfoField = nodes.find((n) => n.name.json === "cHJpY2VfaW5mbw==");
  const tableId = priceInfoField?.value?.address;
  if (!tableId) {
    throw new Error(`Could not find "price_info" table on Pyth state ${pythStateId}`);
  }
  return tableId;
}

export async function fetchPriceInfoObjectId(
  feedId: string,
  network: PythNetworkInfo = TESTNET_PYTH
): Promise<string> {
  const normalizedFeedId = feedId.replace(/^0x/, "").toLowerCase();
  const tableId = await fetchPriceTableId(network.network, network.pythStateId);

  let after: string | null = null;
  for (;;) {
    const data: {
      object: {
        dynamicFields: {
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
          nodes: Array<{ name: { json: { bytes?: string } }; value: { json?: string } | null }>;
        };
      } | null;
    } = await graphqlRequest(
      network.network,
      `query PriceEntries($id: SuiAddress!, $after: String) {
        object(address: $id) {
          dynamicFields(first: ${PRICE_TABLE_PAGE_SIZE}, after: $after) {
            pageInfo { hasNextPage endCursor }
            nodes { name { json } value { __typename ... on MoveValue { json } } }
          }
        }
      }`,
      { id: tableId, after }
    );
    const page = data.object!.dynamicFields;
    for (const node of page.nodes) {
      const b64 = node.name.json.bytes;
      if (!b64) continue;
      const hex = bytesToHex(base64ToBytes(b64));
      if (hex === normalizedFeedId) {
        const priceInfoObjectId = node.value?.json;
        if (!priceInfoObjectId) throw new Error(`Found feed ${feedId} but its value had no id`);
        return priceInfoObjectId;
      }
    }
    if (!page.pageInfo.hasNextPage) break;
    after = page.pageInfo.endCursor;
  }
  throw new Error(`Feed id ${feedId} not found in Pyth price table - register it first (registerPriceFeed.ts)`);
}

function extractVaaBytesFromAccumulatorMessage(accumulatorMessage: Uint8Array): Uint8Array {
  const trailingPayloadSize = accumulatorMessage[6]!;
  const vaaSizeOffset = 7 + trailingPayloadSize + 1;
  const vaaSize = (accumulatorMessage[vaaSizeOffset]! << 8) | accumulatorMessage[vaaSizeOffset + 1]!;
  const vaaOffset = vaaSizeOffset + 2;
  return accumulatorMessage.subarray(vaaOffset, vaaOffset + vaaSize);
}

function pureBytes(bytes: Uint8Array) {
  return bcs.vector(bcs.u8()).serialize([...bytes], { maxSize: MAX_ARGUMENT_SIZE }).toBytes();
}

async function verifyVaa(
  tx: Transaction,
  accumulatorMessage: Uint8Array,
  wormholePackageId: string,
  wormholeVersion: string,
  network: PythNetworkInfo
) {
  const vaa = extractVaaBytesFromAccumulatorMessage(accumulatorMessage);
  const [verifiedVaa] = tx.moveCall({
    target: `${wormholePackageId}::vaa::parse_and_verify`,
    arguments: [
      tx.sharedObjectRef({ objectId: network.wormholeStateId, initialSharedVersion: wormholeVersion, mutable: false }),
      tx.pure(pureBytes(vaa)),
      tx.sharedObjectRef({
        objectId: CLOCK_OBJECT_ID,
        initialSharedVersion: CLOCK_INITIAL_SHARED_VERSION,
        mutable: false,
      }),
    ],
  });
  return verifiedVaa!;
}

export async function createPriceFeed(
  tx: Transaction,
  accumulatorMessage: Uint8Array,
  network: PythNetworkInfo = TESTNET_PYTH
): Promise<void> {
  const [pythPackageId, wormholePackageId, pythVersion, wormholeVersion] = await Promise.all([
    fetchPackageIdFromStateType(network.network, network.pythStateId),
    fetchPackageIdFromStateType(network.network, network.wormholeStateId),
    fetchSharedObjectInitialVersion(network.network, network.pythStateId),
    fetchSharedObjectInitialVersion(network.network, network.wormholeStateId),
  ]);

  const verifiedVaa = await verifyVaa(tx, accumulatorMessage, wormholePackageId, wormholeVersion, network);

  tx.moveCall({
    target: `${pythPackageId}::pyth::create_price_feeds_using_accumulator`,
    arguments: [
      tx.sharedObjectRef({ objectId: network.pythStateId, initialSharedVersion: pythVersion, mutable: true }),
      tx.pure(pureBytes(accumulatorMessage)),
      verifiedVaa,
      tx.sharedObjectRef({
        objectId: CLOCK_OBJECT_ID,
        initialSharedVersion: CLOCK_INITIAL_SHARED_VERSION,
        mutable: false,
      }),
    ],
  });
}

export async function updatePriceFeeds(
  tx: Transaction,
  accumulatorMessage: Uint8Array,
  feedIds: string[],
  network: PythNetworkInfo = TESTNET_PYTH
): Promise<string[]> {
  const [pythPackageId, wormholePackageId, pythVersion, wormholeVersion, baseUpdateFee, priceInfoObjectIds] =
    await Promise.all([
      fetchPackageIdFromStateType(network.network, network.pythStateId),
      fetchPackageIdFromStateType(network.network, network.wormholeStateId),
      fetchSharedObjectInitialVersion(network.network, network.pythStateId),
      fetchSharedObjectInitialVersion(network.network, network.wormholeStateId),
      fetchBaseUpdateFee(network),
      Promise.all(feedIds.map((feedId) => fetchPriceInfoObjectId(feedId, network))),
    ]);

  const verifiedVaa = await verifyVaa(tx, accumulatorMessage, wormholePackageId, wormholeVersion, network);

  let [hotPotato] = tx.moveCall({
    target: `${pythPackageId}::pyth::create_authenticated_price_infos_using_accumulator`,
    arguments: [
      tx.sharedObjectRef({ objectId: network.pythStateId, initialSharedVersion: pythVersion, mutable: false }),
      tx.pure(pureBytes(accumulatorMessage)),
      verifiedVaa,
      tx.sharedObjectRef({
        objectId: CLOCK_OBJECT_ID,
        initialSharedVersion: CLOCK_INITIAL_SHARED_VERSION,
        mutable: false,
      }),
    ],
  });

  const feeCoins = tx.splitCoins(
    tx.gas,
    feedIds.map(() => tx.pure.u64(baseUpdateFee))
  );

  for (let i = 0; i < feedIds.length; i++) {
    const priceInfoVersion = await fetchSharedObjectInitialVersion(network.network, priceInfoObjectIds[i]!);
    [hotPotato] = tx.moveCall({
      target: `${pythPackageId}::pyth::update_single_price_feed`,
      arguments: [
        tx.sharedObjectRef({ objectId: network.pythStateId, initialSharedVersion: pythVersion, mutable: false }),
        hotPotato!,
        tx.sharedObjectRef({
          objectId: priceInfoObjectIds[i]!,
          initialSharedVersion: priceInfoVersion,
          mutable: true,
        }),
        feeCoins[i]!,
        tx.sharedObjectRef({
          objectId: CLOCK_OBJECT_ID,
          initialSharedVersion: CLOCK_INITIAL_SHARED_VERSION,
          mutable: false,
        }),
      ],
    });
  }

  tx.moveCall({
    target: `${pythPackageId}::hot_potato_vector::destroy`,
    arguments: [hotPotato!],
    typeArguments: [`${pythPackageId}::price_info::PriceInfo`],
  });

  return priceInfoObjectIds;
}

export async function fetchBaseUpdateFee(network: PythNetworkInfo = TESTNET_PYTH): Promise<bigint> {
  const fields = await fetchObjectFields(network.network, network.pythStateId);
  return BigInt(fields.base_update_fee as string);
}

export function scalePythPrice(price: string, expo: number): bigint {
  const magnitude = BigInt(price);
  const expoMagnitude = -expo;
  if (expoMagnitude <= PRICE_DECIMALS) {
    return magnitude * 10n ** BigInt(PRICE_DECIMALS - expoMagnitude);
  }
  return magnitude / 10n ** BigInt(expoMagnitude - PRICE_DECIMALS);
}

function hermesClient(apiKey: string): HermesClient {
  return new HermesClient(HERMES_URL, { headers: { Authorization: `Bearer ${apiKey}` } });
}

export async function fetchLivePrice(feedId: string, apiKey: string): Promise<bigint> {
  const hermes = hermesClient(apiKey);
  const updates = await hermes.getLatestPriceUpdates([feedId], { parsed: true });
  const parsed = updates.parsed?.[0];
  if (!parsed) {
    throw new Error(`Hermes returned no parsed price update for feed ${feedId}`);
  }
  return scalePythPrice(parsed.price.price, parsed.price.expo);
}

export async function fetchFreshAccumulatorMessage(feedId: string, apiKey: string): Promise<Uint8Array> {
  const hermes = hermesClient(apiKey);
  const updates = await hermes.getLatestPriceUpdates([feedId]);
  return hexToBytes(updates.binary.data[0]!);
}
