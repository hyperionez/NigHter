import { config } from "./config.js";
import { PositionStore } from "./positionStore.js";
import type {
  PositionOpenedEvent,
  PositionClosedEvent,
  PositionLiquidatedEvent,
} from "./types.js";

const GRAPHQL_URL = `https://graphql.${config.network}.sui.io/graphql`;

const OPENED_TYPE = `${config.packageId}::router::PositionOpened`;
const CLOSED_TYPE = `${config.packageId}::router::PositionClosed`;
const LIQUIDATED_TYPE = `${config.packageId}::liquidation::PositionLiquidated`;

interface IndexerCursor {
  opened?: string | null;
  closed?: string | null;
  liquidated?: string | null;
}

interface EventsQueryResult {
  data?: {
    events: {
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
      nodes: Array<{ contents: { json: unknown } }>;
    };
  };
  errors?: Array<{ message: string }>;
}

const EVENTS_QUERY = `
  query Events($after: String, $eventType: String!) {
    events(first: 50, after: $after, filter: { type: $eventType }) {
      pageInfo { hasNextPage endCursor }
      nodes { contents { json } }
    }
  }
`;

async function fetchAllSince(
  eventType: string,
  cursor: string | null | undefined
): Promise<{ jsons: unknown[]; cursor: string | null | undefined }> {
  const jsons: unknown[] = [];
  let nextCursor = cursor ?? null;
  for (;;) {
    const response = await fetch(GRAPHQL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: EVENTS_QUERY,
        variables: { after: nextCursor, eventType },
      }),
    });
    const result = (await response.json()) as EventsQueryResult;
    if (result.errors?.length) {
      throw new Error(`GraphQL events query failed: ${result.errors[0]?.message}`);
    }
    const page = result.data!.events;
    jsons.push(...page.nodes.map((node) => node.contents.json));
    nextCursor = page.pageInfo.endCursor ?? nextCursor;
    if (!page.pageInfo.hasNextPage) break;
  }
  return { jsons, cursor: nextCursor };
}

export async function syncEvents(
  store: PositionStore,
  cursor: IndexerCursor
): Promise<IndexerCursor> {
  const [opened, closed, liquidated] = await Promise.all([
    fetchAllSince(OPENED_TYPE, cursor.opened),
    fetchAllSince(CLOSED_TYPE, cursor.closed),
    fetchAllSince(LIQUIDATED_TYPE, cursor.liquidated),
  ]);

  for (const json of opened.jsons) {
    const parsed = json as PositionOpenedEvent;
    if (parsed.market_id !== config.marketId) continue;
    store.add({
      positionId: parsed.position_id,
      marketId: parsed.market_id,
      owner: parsed.owner,
      isLong: parsed.is_long,
    });
  }

  for (const json of closed.jsons) {
    const parsed = json as PositionClosedEvent;
    if (parsed.market_id !== config.marketId) continue;
    store.remove(parsed.position_id);
  }

  for (const json of liquidated.jsons) {
    const parsed = json as PositionLiquidatedEvent;
    if (parsed.market_id !== config.marketId) continue;
    store.remove(parsed.position_id);
  }

  return { opened: opened.cursor, closed: closed.cursor, liquidated: liquidated.cursor };
}
