// tools/codegen/extract-shared.ts
//
// Single-source-of-truth extractor (§5.2). Builders IMPORT the real web modules
// (never regex-parse) and produce the JSON the Android app consumes from
// `android/app/src/main/assets/shared/*`. Driven by `generate.test.ts`
// (write-mode gated by env CODEGEN_WRITE=1; otherwise it drift-checks).
//
// Web = source of truth: hand-copying data between apps is forbidden from here on.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { THEMES, THEME_COLORS, VAR_MAP } from '../../src/lib/themes';
import { COVER_TEXTS, COVER_TEXT_CATEGORIES } from '../../src/lib/coverTexts';
import {
  WORLD_COVER_CATEGORIES,
  WORLD_COVER_CATEGORY_META,
  getWorldCoverTexts,
} from '../../src/lib/coverTextsWorld';
import { IRAN_CASTLES } from '../../src/lib/castles';
import { SCENARIOS } from '../../src/tutorial/scenarios';

// Mirror of applyTheme()'s light-theme set + scrollbar derivation (themes.ts:542-545).
// Kept here so the generated themes.json fully describes what applyTheme would set,
// and the Compose engine can reproduce it without re-deriving.
export const LIGHT_THEME_IDS = ['light', 'ivory', 'material3', 'arctic-frost', 'retro'];

/** themes.json — 17 picker entries + 16 fully-resolved palettes + the `auto` rule. */
export function buildThemes() {
  const colors: Record<string, unknown> = {};
  for (const id of Object.keys(THEME_COLORS)) {
    const c = THEME_COLORS[id];
    const vars: Record<string, string> = {};
    for (const [field, varName] of VAR_MAP) vars[varName] = c[field];
    const isDark = !LIGHT_THEME_IDS.includes(id);
    colors[id] = {
      vars,
      isDark,
      scrollbarThumb: isDark ? 'rgba(255,255,255,.15)' : 'rgba(0,0,0,.15)',
      scrollbarThumbHover: isDark ? 'rgba(255,255,255,.25)' : 'rgba(0,0,0,.25)',
      metaThemeColor: c.bg,
    };
  }
  return {
    // exact applyTheme() auto rule (themes.ts:518-522): system dark → ivory-night else ivory
    auto: { light: 'ivory', dark: 'ivory-night' },
    lightThemeIds: LIGHT_THEME_IDS,
    themes: THEMES, // id / name / description / category / preview (17 incl auto)
    colors, // 16 resolved palettes (no `auto`)
  };
}

/** coverTexts.json — Persian (6000) + World (1000) datasets with category meta. */
export function buildCoverTexts() {
  const worldTexts: Record<string, string[]> = {};
  for (const cat of WORLD_COVER_CATEGORIES) worldTexts[cat] = getWorldCoverTexts(cat);
  return {
    persian: {
      categories: Object.keys(COVER_TEXTS),
      meta: COVER_TEXT_CATEGORIES,
      texts: COVER_TEXTS,
    },
    world: {
      categories: WORLD_COVER_CATEGORIES,
      meta: WORLD_COVER_CATEGORY_META,
      texts: worldTexts,
    },
  };
}

/** castles.json — bilingual fortress dataset (selection algorithm ported in Kotlin). */
export function buildCastles() {
  return IRAN_CASTLES;
}

/** tutorials.json — 7 scenarios; only serializable step fields (selectors re-map to Compose tags). */
export function buildTutorials() {
  return Object.keys(SCENARIOS).map((id) => {
    const sc = SCENARIOS[id] as unknown as {
      id: string;
      estimatedMinutes: number;
      steps: Array<{ id: string; selector?: string; side?: string; advanceOn: string; inputMinLength?: number }>;
    };
    return {
      id: sc.id,
      estimatedMinutes: sc.estimatedMinutes,
      steps: sc.steps.map((s) => ({
        id: s.id,
        selector: s.selector ?? null,
        side: s.side ?? null,
        advanceOn: s.advanceOn,
        inputMinLength: s.inputMinLength ?? null,
      })),
    };
  });
}

/** Parse a locale JSON (for verbatim copy + drift checks). */
export function readLocale(locale: 'en' | 'fa'): Record<string, unknown> {
  const p = resolve(process.cwd(), 'src/i18n/locales', `${locale}.json`);
  return JSON.parse(readFileSync(p, 'utf8'));
}
