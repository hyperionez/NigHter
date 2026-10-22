export function graphqlUrl(network: string): string {
  return `https://graphql.${network}.sui.io/graphql`;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

export async function graphqlRequest<T>(
  network: string,
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const response = await fetch(graphqlUrl(network), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const result = (await response.json()) as GraphQLResponse<T>;
  if (result.errors?.length) {
    throw new Error(`GraphQL request failed: ${result.errors.map((e) => e.message).join("; ")}`);
  }
  return result.data as T;
}

export async function fetchObjectFields(network: string, objectId: string): Promise<Record<string, unknown>> {
  const data = await graphqlRequest<{
    object: { asMoveObject: { contents: { json: Record<string, unknown> } } | null } | null;
  }>(
    network,
    `query ObjectFields($id: SuiAddress!) {
      object(address: $id) { asMoveObject { contents { json } } }
    }`,
    { id: objectId }
  );
  const json = data.object?.asMoveObject?.contents.json;
  if (!json) {
    throw new Error(`Object ${objectId} not found or is not a Move object`);
  }
  return json;
}

export async function fetchSharedObjectInitialVersion(network: string, objectId: string): Promise<string> {
  const data = await graphqlRequest<{
    object: { owner: { initialSharedVersion?: string } | null } | null;
  }>(
    network,
    `query SharedVersion($id: SuiAddress!) {
      object(address: $id) { owner { __typename ... on Shared { initialSharedVersion } } }
    }`,
    { id: objectId }
  );
  const version = data.object?.owner?.initialSharedVersion;
  if (version === undefined) {
    throw new Error(`Object ${objectId} is not a shared object (or was not found)`);
  }
  return version;
}

export async function fetchObjectRef(
  network: string,
  objectId: string
): Promise<{ objectId: string; version: string; digest: string }> {
  const data = await graphqlRequest<{
    object: { address: string; version: string; digest: string } | null;
  }>(
    network,
    `query ObjectRef($id: SuiAddress!) {
      object(address: $id) { address version digest }
    }`,
    { id: objectId }
  );
  if (!data.object) {
    throw new Error(`Object ${objectId} not found`);
  }
  return { objectId: data.object.address, version: data.object.version, digest: data.object.digest };
}

export async function fetchReferenceGasPrice(network: string): Promise<bigint> {
  const data = await graphqlRequest<{ epoch: { referenceGasPrice: string } }>(
    network,
    `query { epoch { referenceGasPrice } }`
  );
  return BigInt(data.epoch.referenceGasPrice);
}

export async function fetchGasCoin(
  network: string,
  ownerAddress: string
): Promise<{ objectId: string; version: string; digest: string }> {
  const data = await graphqlRequest<{
    address: {
      objects: { nodes: Array<{ address: string; version: string; digest: string }> };
    } | null;
  }>(
    network,
    `query GasCoin($owner: SuiAddress!) {
      address(address: $owner) {
        objects(first: 1, filter: { type: "0x2::coin::Coin<0x2::sui::SUI>" }) {
          nodes { address version digest }
        }
      }
    }`,
    { owner: ownerAddress }
  );
  const coin = data.address?.objects.nodes[0];
  if (!coin) {
    throw new Error(`No SUI gas coin found for ${ownerAddress} - fund it via faucet first`);
  }
  return { objectId: coin.address, version: coin.version, digest: coin.digest };
}

export async function executeTransaction(
  network: string,
  transactionDataBcs: Uint8Array,
  signatures: string[]
): Promise<{
  digest: string;
  status: string;
  error?: string;
  gasObject?: { objectId: string; version: string; digest: string };
}> {
  const data = await graphqlRequest<{
    executeTransaction: {
      effects: {
        digest: string;
        status: string;
        executionError: { abortCode: string | null; message: string } | null;
        gasEffects: {
          gasObject: { address: string; version: string; digest: string } | null;
        } | null;
      };
    };
  }>(
    network,
    `mutation Execute($bcs: Base64!, $sigs: [Base64!]!) {
      executeTransaction(transactionDataBcs: $bcs, signatures: $sigs) {
        effects {
          digest
          status
          executionError { abortCode message }
          gasEffects { gasObject { address version digest } }
        }
      }
    }`,
    {
      bcs: bytesToBase64(transactionDataBcs),
      sigs: signatures,
    }
  );
  const effects = data.executeTransaction.effects;
  const gas = effects.gasEffects?.gasObject;
  return {
    digest: effects.digest,
    status: effects.status,
    error: effects.executionError
      ? `${effects.executionError.message} (abort code: ${effects.executionError.abortCode})`
      : undefined,
    gasObject: gas
      ? { objectId: gas.address, version: gas.version, digest: gas.digest }
      : undefined,
  };
}
