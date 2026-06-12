import { describe, it, expect } from 'vitest';
import {
  generateEccKeyPair,
  exportPublicKeyB64,
  deriveSharedSessionSecret,
  generateMnemonic,
  deriveKeyPairFromMnemonic,
} from '../src/lib/ecc';

describe('ecc paired mode (ECDH P-256)', () => {
  it('Alice and Bob derive the SAME shared session secret + salt', async () => {
    const alice = await generateEccKeyPair();
    const bob = await generateEccKeyPair();
    const aPub = await exportPublicKeyB64(alice.publicKey);
    const bPub = await exportPublicKeyB64(bob.publicKey);

    const aSide = await deriveSharedSessionSecret(alice.privateKey, bPub, aPub);
    const bSide = await deriveSharedSessionSecret(bob.privateKey, aPub, bPub);

    expect(aSide.secret).toBe(bSide.secret); // ECDH agreement
    expect(aSide.saltB64).toBe(bSide.saltB64); // deterministic sorted salt
    expect(aSide.secret.length).toBeGreaterThan(0);
  });

  it('different counterparties yield different secrets', async () => {
    const a = await generateEccKeyPair();
    const b = await generateEccKeyPair();
    const c = await generateEccKeyPair();
    const aPub = await exportPublicKeyB64(a.publicKey);
    const bPub = await exportPublicKeyB64(b.publicKey);
    const cPub = await exportPublicKeyB64(c.publicKey);
    const ab = (await deriveSharedSessionSecret(a.privateKey, bPub, aPub)).secret;
    const ac = (await deriveSharedSessionSecret(a.privateKey, cPub, aPub)).secret;
    expect(ab).not.toBe(ac);
  });

  it('generateMnemonic returns 12 words', () => {
    expect(generateMnemonic()).toHaveLength(12);
  });

  it('deriveKeyPairFromMnemonic recovers a deterministic identity that does ECDH with a normal peer', async () => {
    const phrase = generateMnemonic();
    const recovered = await deriveKeyPairFromMnemonic(phrase);
    expect(recovered.publicKeyB64.length).toBeGreaterThan(0);

    // Deterministic: the same words must recover the same identity.
    const again = await deriveKeyPairFromMnemonic(phrase);
    expect(again.publicKeyB64).toBe(recovered.publicKeyB64);

    // The recovered key must interoperate with a normally-generated peer
    // (full ECDH agreement) — i.e. mnemonic recovery yields a real, usable key.
    const peer = await generateEccKeyPair();
    const peerPub = await exportPublicKeyB64(peer.publicKey);
    const fromRecovered = await deriveSharedSessionSecret(recovered.keyPair.privateKey, peerPub, recovered.publicKeyB64);
    const fromPeer = await deriveSharedSessionSecret(peer.privateKey, recovered.publicKeyB64, peerPub);
    expect(fromRecovered.secret).toBe(fromPeer.secret);
  });
});
