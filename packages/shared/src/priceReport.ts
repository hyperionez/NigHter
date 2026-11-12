export const MARKET_ID_BYTE_LENGTH = 32;
export const PRICE_REPORT_MESSAGE_BYTE_LENGTH = 48;
export const PRICE_SIGNATURE_BYTE_LENGTH = 64;
export const PRICE_SCALE_DECIMALS = 9;

const U64_MAX = (1n << 64n) - 1n;

export interface SignedPriceReport {
  marketId: string;
  price: string;
  timestampMs: string;
  signature: string;
  publicKey: string;
}

export function hexToBytes(hex: string): Uint8Array {
  const body = hex.startsWith("0x") || hex.startsWith("0X") ? hex.slice(2) : hex;
  if (body.length % 2 !== 0) {
    throw new Error(`Hex string must have an even number of digits, got ${body.length}`);
  }
  if (body.length > 0 && !/^[0-9a-fA-F]+$/.test(body)) {
    throw new Error("Hex string contains a non-hex character");
  }
  const bytes = new Uint8Array(body.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(body.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export function bytesToHexPrefixed(bytes: Uint8Array): string {
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i]!.toString(16).padStart(2, "0");
  }
  return `0x${hex}`;
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function u64BigEndianBytes(value: bigint, label: string): Uint8Array {
  if (value < 0n || value > U64_MAX) {
    throw new Error(`${label} ${value} does not fit in a Move u64 (0 .. ${U64_MAX})`);
  }
  const bytes = new Uint8Array(8);
  for (let i = 0; i < 8; i++) {
    bytes[i] = Number((value >> BigInt((7 - i) * 8)) & 0xffn);
  }
  return bytes;
}

export function encodePriceReportMessage(
  marketId: string,
  price: bigint,
  timestampMs: bigint
): Uint8Array {
  const idBytes = hexToBytes(marketId);
  if (idBytes.length !== MARKET_ID_BYTE_LENGTH) {
    throw new Error(
      `Market id must be exactly ${MARKET_ID_BYTE_LENGTH} bytes, got ${idBytes.length} from "${marketId}"`
    );
  }
  const message = new Uint8Array(PRICE_REPORT_MESSAGE_BYTE_LENGTH);
  message.set(idBytes, 0);
  message.set(u64BigEndianBytes(price, "price"), MARKET_ID_BYTE_LENGTH);
  message.set(u64BigEndianBytes(timestampMs, "timestampMs"), MARKET_ID_BYTE_LENGTH + 8);
  return message;
}

export function parseDecimalToScaled(decimal: string, decimals: number = PRICE_SCALE_DECIMALS): bigint {
  const trimmed = decimal.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error(`Not a non-negative decimal number: "${decimal}"`);
  }
  const dot = trimmed.indexOf(".");
  const integerPart = dot === -1 ? trimmed : trimmed.slice(0, dot);
  const fractionPart = dot === -1 ? "" : trimmed.slice(dot + 1);
  const scaledFraction = fractionPart.slice(0, decimals).padEnd(decimals, "0");
  return BigInt(`${integerPart}${scaledFraction}`);
}
