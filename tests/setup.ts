import { webcrypto } from 'node:crypto';

// crypto.ts uses the bare global `crypto.subtle` / `crypto.getRandomValues`
// and `window.btoa` / `window.atob`. Node 24 already exposes global crypto +
// btoa/atob, but not `window`. Provide the missing globals so the production
// code runs byte-identically to the browser.
const g = globalThis as unknown as Record<string, unknown> & {
  crypto?: Crypto;
  btoa?: (s: string) => string;
  atob?: (s: string) => string;
  window?: Record<string, unknown>;
};

if (!g.crypto || !(g.crypto as Crypto).subtle) {
  g.crypto = webcrypto as unknown as Crypto;
}

const b64encode = (s: string): string => Buffer.from(s, 'binary').toString('base64');
const b64decode = (s: string): string => Buffer.from(s, 'base64').toString('binary');
if (typeof g.btoa === 'undefined') g.btoa = b64encode;
if (typeof g.atob === 'undefined') g.atob = b64decode;

if (typeof g.window === 'undefined') g.window = g as unknown as Record<string, unknown>;
if (!g.window.btoa) g.window.btoa = g.btoa;
if (!g.window.atob) g.window.atob = g.atob;
