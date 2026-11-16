import { describe, expect, it } from "vitest";
import { CredentialVault } from "../credential-vault.js";

const KEY_ONE = "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=";
const KEY_TWO = "HxwdHhsaGRgXFhUUExIREA8ODQwLCgkIBwYFBAMCAQA=";

const vault = (current: string, keys: Record<string, string>) =>
  new CredentialVault({
    JIRA_CREDENTIAL_KEYS: keys,
    JIRA_CREDENTIAL_KEY_CURRENT: current,
  });

/** ADR-0027: credentials at rest are AES-256-GCM, bound to their row. */
describe("CredentialVault", () => {
  const credential = { kind: "api-token" as const, token: "secret-token" };

  it("opens what it sealed", async () => {
    const subject = vault("v1", { v1: KEY_ONE });
    const sealed = await subject.seal("account-1", credential);
    expect(sealed.ciphertext).not.toContain("secret-token");
    expect(sealed.keyVersion).toBe("v1");
    expect(await subject.open("account-1", sealed)).toEqual(credential);
  });

  it("uses a new IV for every write", async () => {
    const subject = vault("v1", { v1: KEY_ONE });
    const first = await subject.seal("account-1", credential);
    const second = await subject.seal("account-1", credential);
    expect(first.iv).not.toBe(second.iv);
    expect(first.ciphertext).not.toBe(second.ciphertext);
  });

  it("refuses a ciphertext moved to another account", async () => {
    const subject = vault("v1", { v1: KEY_ONE });
    const sealed = await subject.seal("account-1", credential);
    await expect(subject.open("account-2", sealed)).rejects.toThrow();
  });

  it("refuses a ciphertext whose key version was changed", async () => {
    const subject = vault("v1", { v1: KEY_ONE, v2: KEY_ONE });
    const sealed = await subject.seal("account-1", credential);
    await expect(
      subject.open("account-1", { ...sealed, keyVersion: "v2" }),
    ).rejects.toThrow();
  });

  it("still opens rows sealed with an older key after rotation", async () => {
    const before = vault("v1", { v1: KEY_ONE });
    const sealed = await before.seal("account-1", credential);
    const after = vault("v2", { v1: KEY_ONE, v2: KEY_TWO });
    expect(await after.open("account-1", sealed)).toEqual(credential);
    expect((await after.seal("account-1", credential)).keyVersion).toBe("v2");
  });
});
