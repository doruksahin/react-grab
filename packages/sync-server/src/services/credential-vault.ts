import type {
  JiraCredential,
  SealedCredential,
} from "../repositories/types.js";
import type { CredentialEnv } from "../schemas/env.js";

const IV_BYTES = 12;

const toBase64 = (bytes: ArrayBuffer | Uint8Array): string =>
  Buffer.from(
    bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes),
  ).toString("base64");

const fromBase64 = (value: string): Uint8Array<ArrayBuffer> =>
  new Uint8Array(Buffer.from(value, "base64"));

/**
 * Binds a ciphertext to its row, key version and credential kind, so it cannot
 * be moved to another account or read as another kind (AES-GCM additional data).
 */
const additionalData = (
  accountId: string,
  keyVersion: string,
  kind: JiraCredential["kind"],
): Uint8Array<ArrayBuffer> =>
  new TextEncoder().encode(`${accountId}\n${keyVersion}\n${kind}`);

/**
 * Encrypts and decrypts Jira credentials with AES-256-GCM through the Web
 * Crypto API that Workers implement (ADR-0027). It does nothing else.
 */
export class CredentialVault {
  private readonly importedKeys = new Map<string, Promise<CryptoKey>>();

  constructor(private readonly keyRing: CredentialEnv) {}

  private key(version: string): Promise<CryptoKey> {
    const cached = this.importedKeys.get(version);
    if (cached) return cached;
    const raw = this.keyRing.JIRA_CREDENTIAL_KEYS[version];
    if (!raw) {
      return Promise.reject(
        new Error(`No Jira credential key with version "${version}"`),
      );
    }
    const imported = crypto.subtle.importKey(
      "raw",
      fromBase64(raw),
      "AES-GCM",
      false,
      ["encrypt", "decrypt"],
    );
    this.importedKeys.set(version, imported);
    return imported;
  }

  async seal(
    accountId: string,
    credential: JiraCredential,
  ): Promise<SealedCredential> {
    const keyVersion = this.keyRing.JIRA_CREDENTIAL_KEY_CURRENT;
    const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
    const ciphertext = await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv,
        additionalData: additionalData(accountId, keyVersion, credential.kind),
      },
      await this.key(keyVersion),
      new TextEncoder().encode(credential.token),
    );
    return {
      kind: credential.kind,
      ciphertext: toBase64(ciphertext),
      iv: toBase64(iv),
      keyVersion,
    };
  }

  async open(
    accountId: string,
    sealed: SealedCredential,
  ): Promise<JiraCredential> {
    const plaintext = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: fromBase64(sealed.iv),
        additionalData: additionalData(
          accountId,
          sealed.keyVersion,
          sealed.kind,
        ),
      },
      await this.key(sealed.keyVersion),
      fromBase64(sealed.ciphertext),
    );
    return { kind: sealed.kind, token: new TextDecoder().decode(plaintext) };
  }
}
