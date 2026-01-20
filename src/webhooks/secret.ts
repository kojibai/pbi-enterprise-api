import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { config } from "../config.js";

export type EncryptedSecret = {
  hash: string;
  ciphertext: string;
  iv: string;
  tag: string;
};

function getKeyBytes(): Buffer {
  if (!config.webhookSecretKey) {
    throw new Error("webhook_secret_key_missing");
  }
  const keyBytes = Buffer.from(config.webhookSecretKey, "base64");
  if (keyBytes.length !== 32) {
    throw new Error("webhook_secret_key_invalid");
  }
  return keyBytes;
}

export function generateWebhookSecret(): { raw: string; encrypted: EncryptedSecret } {
  const raw = Buffer.from(randomBytes(32)).toString("base64url");
  const encrypted = encryptWebhookSecret(raw);
  return { raw, encrypted };
}

export function hashWebhookSecret(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

export function encryptWebhookSecret(raw: string): EncryptedSecret {
  const key = getKeyBytes();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(raw, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    hash: hashWebhookSecret(raw),
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64")
  };
}

export function decryptWebhookSecret(secret: {
  ciphertext: string;
  iv: string;
  tag: string;
}): string {
  const key = getKeyBytes();
  const iv = Buffer.from(secret.iv, "base64");
  const ciphertext = Buffer.from(secret.ciphertext, "base64");
  const tag = Buffer.from(secret.tag, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}
