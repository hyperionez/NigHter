import { config } from "./config.js";

const GRAPHQL_URL = `https://graphql.${config.network}.sui.io/graphql`;

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

export async function graphqlRequest<T>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const response = await fetch(GRAPHQL_URL, {
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

export async function fetchObjectFields(objectId: string): Promise<Record<string, unknown>> {
  const data = await graphqlRequest<{
    object: { asMoveObject: { contents: { json: Record<string, unknown> } } | null } | null;
  }>(
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

export async function fetchSharedObjectInitialVersion(objectId: string): Promise<string> {
  const data = await graphqlRequest<{
    object: { owner: { initialSharedVersion?: string } | null } | null;
  }>(
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

export async function fetchReferenceGasPrice(): Promise<bigint> {
  const data = await graphqlRequest<{ epoch: { referenceGasPrice: string } }>(
    `query { epoch { referenceGasPrice } }`
  );
  return BigInt(data.epoch.referenceGasPrice);
}

export async function fetchGasCoin(
  ownerAddress: string
): Promise<{ objectId: string; version: string; digest: string }> {
  const data = await graphqlRequest<{
    address: {
      objects: { nodes: Array<{ address: string; version: string; digest: string }> };
    } | null;
  }>(
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
  transactionDataBcs: Uint8Array,
  signatures: string[]
): Promise<{ digest: string; status: string; error?: string }> {
  const data = await graphqlRequest<{
    executeTransaction: {
      effects: {
        digest: string;
        status: string;
        executionError: { abortCode: string | null; message: string } | null;
      };
    };
  }>(
    `mutation Execute($bcs: Base64!, $sigs: [Base64!]!) {
      executeTransaction(transactionDataBcs: $bcs, signatures: $sigs) {
        effects { digest status executionError { abortCode message } }
      }
    }`,
    {
      bcs: Buffer.from(transactionDataBcs).toString("base64"),
      sigs: signatures,
    }
  );
  const effects = data.executeTransaction.effects;
  return {
    digest: effects.digest,
    status: effects.status,
    error: effects.executionError
      ? `${effects.executionError.message} (abort code: ${effects.executionError.abortCode})`
      : undefined,
  };
}
