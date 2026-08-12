import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { config } from "./config.js";

const { secretKey } = decodeSuiPrivateKey(config.keeperPrivateKey);
export const keeperKeypair = Ed25519Keypair.fromSecretKey(secretKey);
export const keeperAddress = keeperKeypair.getPublicKey().toSuiAddress();
