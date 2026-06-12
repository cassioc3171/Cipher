// tests/codegen-generate.test.ts
//
// Single-source-of-truth codegen + drift test (§5.2). Lives under tests/ so it
// runs as part of `npm test` (vitest include = tests/**). The extractor itself
// is tools/codegen/extract-shared.ts.
//
// CODEGEN_WRITE=1  → (re)writes android/app/src/main/assets/shared/* from live web modules.
// (no env)         → DRIFT: deep-equals committed JSON vs live imports + spot-asserts.
//
// Run write:  CODEGEN_WRITE=1 npx vitest run tests/codegen-generate.test.ts
// Run drift:  npm test

import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdirSync, readFileSync, existsSync, copyFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import {
  buildThemes,
  buildCoverTexts,
  buildCastles,
  buildTutorials,
  readLocale,
} from '../tools/codegen/extract-shared';

const ROOT = process.cwd();
const ASSETS = resolve(ROOT, 'android/app/src/main/assets/shared');
const WRITE = process.env.CODEGEN_WRITE === '1';

function assetPath(rel: string): string {
  return resolve(ASSETS, rel);
}
function writeJson(rel: string, obj: unknown): void {
  const p = assetPath(rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}
function readJson(rel: string): unknown {
  return JSON.parse(readFileSync(assetPath(rel), 'utf8'));
}
function leafKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const out: string[] = [];
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) out.push(...leafKeys(v as Record<string, unknown>, key));
    else out.push(key);
  }
  return out;
}

describe('shared codegen → android/app/src/main/assets/shared', () => {
  it('themes.json matches live themes.ts (17 picker / 16 palettes; ivory bg #FAF9F5)', () => {
    const built = buildThemes();
    if (WRITE) writeJson('themes.json', built);
    expect(existsSync(assetPath('themes.json'))).toBe(true);
    expect(readJson('themes.json')).toEqual(built);
    expect((built.colors['ivory'] as { vars: Record<string, string> }).vars['--bg']).toBe('#FAF9F5');
    expect(built.themes.length).toBe(17);
    expect(Object.keys(built.colors).length).toBe(16);
    expect(built.auto).toEqual({ light: 'ivory', dark: 'ivory-night' });
    expect(built.lightThemeIds).toContain('retro');
  });

  it('coverTexts.json matches live data (Persian 6000, World 1000)', () => {
    const built = buildCoverTexts();
    if (WRITE) writeJson('coverTexts.json', built);
    expect(readJson('coverTexts.json')).toEqual(built);
    const pCount = Object.values(built.persian.texts as Record<string, string[]>).reduce((n, a) => n + a.length, 0);
    const wCount = Object.values(built.world.texts as Record<string, string[]>).reduce((n, a) => n + a.length, 0);
    expect(pCount).toBe(6000);
    expect(wCount).toBe(1000);
    expect(built.persian.categories).toEqual(['neutral', 'proverbs', 'pro_government', 'kotlet_recipe', 'poetry']);
    expect(built.world.categories).toEqual(['english', 'arabic', 'french', 'german', 'spanish', 'russian', 'italian']);
  });

  it('castles.json matches live data (108 bilingual entries)', () => {
    const built = buildCastles();
    if (WRITE) writeJson('castles.json', built);
    expect(readJson('castles.json')).toEqual(built);
    expect(built.length).toBe(108);
    expect(built[0]).toHaveProperty('nameFa');
    expect(built[0]).toHaveProperty('nameEn');
    expect(built[0]).toHaveProperty('wiki');
  });

  it('tutorials.json matches live scenarios (9 incl setAppPassword)', () => {
    const built = buildTutorials();
    if (WRITE) writeJson('tutorials.json', built);
    expect(readJson('tutorials.json')).toEqual(built);
    expect(built.length).toBe(9);
    expect(built.map((s) => s.id)).toContain('setAppPassword');
  });

  it('i18n en/fa copied verbatim + identical key sets', () => {
    const en = readLocale('en');
    const fa = readLocale('fa');
    if (WRITE) {
      mkdirSync(assetPath('i18n'), { recursive: true });
      copyFileSync(resolve(ROOT, 'src/i18n/locales/en.json'), assetPath('i18n/en.json'));
      copyFileSync(resolve(ROOT, 'src/i18n/locales/fa.json'), assetPath('i18n/fa.json'));
    }
    expect(readJson('i18n/en.json')).toEqual(en);
    expect(readJson('i18n/fa.json')).toEqual(fa);
    const enKeys = leafKeys(en).sort();
    const faKeys = leafKeys(fa).sort();
    expect(faKeys).toEqual(enKeys); // en ≡ fa key sets (parity invariant)
    expect(enKeys.length).toBeGreaterThan(400);
    // eslint-disable-next-line no-console
    console.log(`[codegen] i18n leaf keys: ${enKeys.length}`);
  });
});
