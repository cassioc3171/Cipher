import { defineConfig } from 'vitest/config';

// Node environment + a setup shim that guarantees real WebCrypto (subtle) and
// window.btoa/atob, so src/lib/crypto.ts (which uses window.btoa / crypto.subtle)
// runs unmodified under Vitest. See tests/setup.ts.
export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
    // PBKDF2-600k derivations are CPU-bound; several per test means the suite
    // can legitimately take tens of seconds under load (e.g. a parallel build).
    testTimeout: 30_000,
  },
});
