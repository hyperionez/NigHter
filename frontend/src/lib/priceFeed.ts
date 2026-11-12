import { config } from '@/config/index.ts'

export interface SignedPriceReport {
  marketId: string
  price: bigint
  timestampMs: bigint
  signature: Uint8Array
  publicKey: string
}

export const PRICE_SIGNATURE_BYTES = 64
export const PRICE_ENDPOINT = `${config.priceSignerUrl}/price`

const U64_MAX = 2n ** 64n - 1n
const REQUEST_TIMEOUT_MS = 5_000

export class PriceFeedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PriceFeedError'
  }
}

export function hexToBytes(hex: string): Uint8Array {
  const body = hex.startsWith('0x') || hex.startsWith('0X') ? hex.slice(2) : hex
  if (body.length === 0 || body.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(body)) {
    throw new PriceFeedError(`Expected a 0x-prefixed hex string, got "${hex}".`)
  }
  const out = new Uint8Array(body.length / 2)
  for (let i = 0; i < out.length; i += 1) {
    out[i] = parseInt(body.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

export function normalizeObjectId(id: string): string {
  const body = id.startsWith('0x') || id.startsWith('0X') ? id.slice(2) : id
  if (!/^[0-9a-fA-F]{1,64}$/.test(body)) return id.toLowerCase()
  return `0x${body.toLowerCase().padStart(64, '0')}`
}

function parseU64(value: unknown, field: string): bigint {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw new PriceFeedError(
      `Price report field "${field}" must be a decimal string: it is a u64 and a JSON number would silently lose precision. Got ${JSON.stringify(value)}.`,
    )
  }
  const parsed = BigInt(value)
  if (parsed > U64_MAX) {
    throw new PriceFeedError(`Price report field "${field}" does not fit in u64: ${value}.`)
  }
  return parsed
}

export function parseSignedPriceReport(body: unknown): SignedPriceReport {
  if (typeof body !== 'object' || body === null) {
    throw new PriceFeedError(`Price service returned ${JSON.stringify(body)} instead of a report object.`)
  }
  const raw = body as Record<string, unknown>

  if (typeof raw.marketId !== 'string') {
    throw new PriceFeedError('Price report is missing a string "marketId".')
  }
  if (normalizeObjectId(raw.marketId) !== normalizeObjectId(config.marketId)) {
    throw new PriceFeedError(
      `Price report is signed for market ${raw.marketId}, but this app trades ${config.marketId}. The signature covers the market id, so submitting it would abort on chain as EInvalidPriceSignature (8).`,
    )
  }

  if (typeof raw.signature !== 'string') {
    throw new PriceFeedError('Price report is missing a string "signature".')
  }
  const signature = hexToBytes(raw.signature)
  if (signature.length !== PRICE_SIGNATURE_BYTES) {
    throw new PriceFeedError(
      `Price signature must decode to exactly ${PRICE_SIGNATURE_BYTES} bytes, got ${signature.length} from "${raw.signature}". An ed25519 signature of the wrong length aborts on chain as EInvalidPriceSignature (8) with no further detail.`,
    )
  }

  return {
    marketId: raw.marketId,
    price: parseU64(raw.price, 'price'),
    timestampMs: parseU64(raw.timestampMs, 'timestampMs'),
    signature,
    publicKey: typeof raw.publicKey === 'string' ? raw.publicKey : '',
  }
}

export async function fetchSignedPrice(signal?: AbortSignal): Promise<SignedPriceReport> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  const forwardAbort = () => controller.abort()
  signal?.addEventListener('abort', forwardAbort)

  let response: Response
  try {
    response = await fetch(PRICE_ENDPOINT, { signal: controller.signal, cache: 'no-store' })
  } catch {
    throw new PriceFeedError(
      `Price service unreachable at ${PRICE_ENDPOINT}. This market needs a signed price from the keeper, so trading cannot proceed until that service is running.`,
    )
  } finally {
    clearTimeout(timeout)
    signal?.removeEventListener('abort', forwardAbort)
  }

  if (!response.ok) {
    throw new PriceFeedError(
      `Price service at ${PRICE_ENDPOINT} answered HTTP ${response.status}. It is up but not serving a signed price.`,
    )
  }

  let body: unknown
  try {
    body = await response.json()
  } catch {
    throw new PriceFeedError(`Price service at ${PRICE_ENDPOINT} returned a body that is not JSON.`)
  }

  return parseSignedPriceReport(body)
}
