import process from "node:process";
import { Ed25519Keypair, Ed25519PublicKey } from "@mysten/sui/keypairs/ed25519";
import {
  bytesToHexPrefixed,
  encodePriceReportMessage,
  hexToBytes,
  parseDecimalToScaled,
  PRICE_REPORT_MESSAGE_BYTE_LENGTH,
  PRICE_SIGNATURE_BYTE_LENGTH,
} from "@perp-dex/shared";

const MOVE_MARKET_ID = "0xa058cccb1180e0c063232bed5fcf330614d57c74f056f8b3db0317812e129eb2";
const MOVE_PRICE = 81508030000000n;
const MOVE_TIMESTAMP_MS = 70000n;
const MOVE_EXPECTED_MESSAGE =
  "0xa058cccb1180e0c063232bed5fcf330614d57c74f056f8b3db0317812e129eb200004a21912cab800000000000011170";
const MOVE_SIGNER_PUBKEY = "0x79b5562e8fe654f94078b112e8a98ba7901f853ae695bed7e0e3910bad049664";
const MOVE_VALID_SIGNATURE =
  "0x89fa6897e8185c3fb05b683f196e8f405babc0dac7ad47e0c1839d4cb6f219eef98a5418aa731cbde3164b825c0339ba57e23eac0ba10b036bd48dc86907d302";

let failures = 0;
let checks = 0;

function check(name: string, condition: boolean, detail?: string): void {
  checks += 1;
  if (condition) {
    console.log(`  ok   ${name}`);
    return;
  }
  failures += 1;
  console.error(`  FAIL ${name}${detail ? ` - ${detail}` : ""}`);
}

function checkEqual(name: string, actual: unknown, expected: unknown): void {
  check(name, actual === expected, `expected ${String(expected)}, got ${String(actual)}`);
}

function checkThrows(name: string, fn: () => unknown): void {
  try {
    fn();
    check(name, false, "no error was thrown");
  } catch {
    check(name, true);
  }
}

async function main() {
  console.log("Move known-good vector (tests/signed_price_tests.move)");
  const message = encodePriceReportMessage(MOVE_MARKET_ID, MOVE_PRICE, MOVE_TIMESTAMP_MS);
  checkEqual("message is 48 bytes", message.length, PRICE_REPORT_MESSAGE_BYTE_LENGTH);
  checkEqual("message hex matches the Move encoder byte for byte", bytesToHexPrefixed(message), MOVE_EXPECTED_MESSAGE);

  const moveSignature = hexToBytes(MOVE_VALID_SIGNATURE);
  checkEqual("Move test signature is 64 bytes", moveSignature.length, PRICE_SIGNATURE_BYTE_LENGTH);
  const movePublicKey = new Ed25519PublicKey(hexToBytes(MOVE_SIGNER_PUBKEY));
  check(
    "the signature the Move test accepted verifies as plain ed25519 over this message",
    await movePublicKey.verify(message, moveSignature)
  );
  check(
    "a tampered price does not verify against the same signature",
    !(await movePublicKey.verify(
      encodePriceReportMessage(MOVE_MARKET_ID, MOVE_PRICE + 1n, MOVE_TIMESTAMP_MS),
      moveSignature
    ))
  );

  console.log("keypair.sign produces a raw signature ed25519_verify would accept");
  const ephemeral = Ed25519Keypair.generate();
  const signature = await ephemeral.sign(message);
  checkEqual("sign() returns 64 bytes", signature.length, PRICE_SIGNATURE_BYTE_LENGTH);
  check("sign() output verifies with no intent prefix", await ephemeral.getPublicKey().verify(message, signature));
  check(
    "sign() output is not a personal-message signature",
    !(await ephemeral.getPublicKey().verifyPersonalMessage(message, signature))
  );

  console.log("Binance decimal string to 1e9-scaled bigint");
  checkEqual("81508.03 scales to the Move test's price", parseDecimalToScaled("81508.03"), MOVE_PRICE);
  checkEqual("whole number", parseDecimalToScaled("81508"), 81508000000000n);
  checkEqual("Binance trailing-zero form", parseDecimalToScaled("81508.03000000"), MOVE_PRICE);
  checkEqual("leading-zero fraction", parseDecimalToScaled("0.1"), 100000000n);
  checkEqual("fraction longer than 9 digits truncates", parseDecimalToScaled("1.0000000009"), 1000000000n);
  checkEqual(
    "18 significant digits survive (Number would not)",
    parseDecimalToScaled("123456789.123456789"),
    123456789123456789n
  );

  console.log("rejections");
  checkThrows("market id shorter than 32 bytes", () => encodePriceReportMessage("0xdeadbeef", 1n, 1n));
  checkThrows("market id longer than 32 bytes", () =>
    encodePriceReportMessage(`${MOVE_MARKET_ID}ff`, 1n, 1n)
  );
  checkThrows("price above u64 max", () =>
    encodePriceReportMessage(MOVE_MARKET_ID, 1n << 64n, 1n)
  );
  checkThrows("negative timestamp", () => encodePriceReportMessage(MOVE_MARKET_ID, 1n, -1n));
  checkThrows("non-numeric price string", () => parseDecimalToScaled("not-a-price"));
  checkThrows("negative price string", () => parseDecimalToScaled("-1.5"));

  console.log("");
  if (failures > 0) {
    console.error(`${failures} of ${checks} checks FAILED`);
    process.exitCode = 1;
    return;
  }
  console.log(`all ${checks} checks passed`);
}

main().catch((err) => {
  console.error("verify-signed-price crashed:", err);
  process.exitCode = 1;
});
