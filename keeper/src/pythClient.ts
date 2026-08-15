import { bcs } from "@mysten/sui/bcs";
import { Transaction } from "@mysten/sui/transactions";
import { fetchObjectFields, fetchSharedObjectInitialVersion, graphqlRequest } from "./graphqlClient.js";

const MAX_ARGUMENT_SIZE = 16 * 1024;
const CLOCK_OBJECT_ID = "0x6";
const CLOCK_INITIAL_SHARED_VERSION = "1";
const PRICE_TABLE_PAGE_SIZE = 50;

export interface PythNetworkInfo {
  pythStateId: string;
  wormholeStateId: string;
}

export const TESTNET_PYTH: PythNetworkInfo = {
  pythStateId: "0x243759059f4c3111179da5878c12f68d612c21a8d54d85edc86164bb18be1c7c",
  wormholeStateId: "0x31358d198147da50db32eda2562951d53973a0c0ad5ed738e9b17d88b213d790",
};

async function fetchPackageIdFromStateType(stateId: string): Promise<string> {
  const data = await graphqlRequest<{ object: { asMoveObject: { contents: { type: { repr: string } } } } | null }>(
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

async function fetchPriceTableId(pythStateId: string): Promise<string> {
  const data = await graphqlRequest<{
    object: { dynamicFields: { nodes: Array<{ name: { json: unknown }; value: { address?: string } | null }> } } | null;
  }>(
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
  const tableId = await fetchPriceTableId(network.pythStateId);

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
      const hex = Buffer.from(b64, "base64").toString("hex");
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

function extractVaaBytesFromAccumulatorMessage(accumulatorMessage: Buffer): Buffer {
  const trailingPayloadSize = accumulatorMessage.readUint8(6);
  const vaaSizeOffset = 7 + trailingPayloadSize + 1;
  const vaaSize = accumulatorMessage.readUint16BE(vaaSizeOffset);
  const vaaOffset = vaaSizeOffset + 2;
  return accumulatorMessage.subarray(vaaOffset, vaaOffset + vaaSize);
}

function pureBytes(bytes: Uint8Array) {
  return bcs.vector(bcs.u8()).serialize([...bytes], { maxSize: MAX_ARGUMENT_SIZE }).toBytes();
}

async function verifyVaa(
  tx: Transaction,
  accumulatorMessage: Buffer,
  wormholePackageId: string,
  wormholeVersion: string
) {
  const vaa = extractVaaBytesFromAccumulatorMessage(accumulatorMessage);
  const [verifiedVaa] = tx.moveCall({
    target: `${wormholePackageId}::vaa::parse_and_verify`,
    arguments: [
      tx.sharedObjectRef({ objectId: TESTNET_PYTH.wormholeStateId, initialSharedVersion: wormholeVersion, mutable: false }),
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
  accumulatorMessage: Buffer,
  network: PythNetworkInfo = TESTNET_PYTH
): Promise<void> {
  const [pythPackageId, wormholePackageId, pythVersion, wormholeVersion] = await Promise.all([
    fetchPackageIdFromStateType(network.pythStateId),
    fetchPackageIdFromStateType(network.wormholeStateId),
    fetchSharedObjectInitialVersion(network.pythStateId),
    fetchSharedObjectInitialVersion(network.wormholeStateId),
  ]);

  const verifiedVaa = await verifyVaa(tx, accumulatorMessage, wormholePackageId, wormholeVersion);

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
  accumulatorMessage: Buffer,
  feedIds: string[],
  network: PythNetworkInfo = TESTNET_PYTH
): Promise<string[]> {
  const [pythPackageId, wormholePackageId, pythVersion, wormholeVersion, baseUpdateFee, priceInfoObjectIds] =
    await Promise.all([
      fetchPackageIdFromStateType(network.pythStateId),
      fetchPackageIdFromStateType(network.wormholeStateId),
      fetchSharedObjectInitialVersion(network.pythStateId),
      fetchSharedObjectInitialVersion(network.wormholeStateId),
      fetchBaseUpdateFee(network),
      Promise.all(feedIds.map((feedId) => fetchPriceInfoObjectId(feedId, network))),
    ]);

  const verifiedVaa = await verifyVaa(tx, accumulatorMessage, wormholePackageId, wormholeVersion);

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
    const priceInfoVersion = await fetchSharedObjectInitialVersion(priceInfoObjectIds[i]!);
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
  const fields = await fetchObjectFields(network.pythStateId);
  return BigInt(fields.base_update_fee as string);
}
