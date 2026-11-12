import process from "node:process";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";

function toHex(bytes: Uint8Array): string {
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i]!.toString(16).padStart(2, "0");
  }
  return hex;
}

function main() {
  const keypair = Ed25519Keypair.generate();
  const publicKey = keypair.getPublicKey().toRawBytes();
  const hex = toHex(publicKey);

  console.log("");
  console.log("A fresh ed25519 price-signing keypair. This is NOT a Sui account you fund or trade");
  console.log("with - it never signs a transaction, only 48-byte price reports.");
  console.log("");
  console.log("1. Public key - pass this to create_market as the price_signer argument:");
  console.log("");
  console.log(`   0x${hex}`);
  console.log("");
  console.log("   For the Sui CLI, a vector<u8> argument is given as the same hex string:");
  console.log("");
  console.log(`   --args ... 0x${hex} ...`);
  console.log("");
  console.log("2. Secret key - put this in keeper/.env and nowhere else:");
  console.log("");
  console.log(`   PRICE_SIGNER_PRIVATE_KEY=${keypair.getSecretKey()}`);
  console.log("");
  console.log("   Anyone holding it can sign any price for this market. Do not commit it, do not");
  console.log("   paste it into a chat or an issue, and generate a new one if it ever leaks");
  console.log("   (market::set_price_signer rotates the on-chain half).");
  console.log("");
}

try {
  main();
} catch (err) {
  console.error("Failed to generate a price signer keypair:", err);
  process.exitCode = 1;
}
