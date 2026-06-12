/**
 * Theme definitions for Cipher.
 * Auto = follow system preference (light/dark).
 * Named themes override CSS custom properties on :root.
 */

export type ThemeId = 'auto' | 'ivory' | 'ivory-night' | 'material3' | 'material3-night' | 'light' | 'dark' | 'ocean-depths' | 'midnight-galaxy' | 'tech-innovation' | 'emerald-forest' | 'sunset-ember' | 'arctic-frost' | 'rose-gold' | 'cyber-noir' | 'retro' | 'anime';

interface ThemeColors {
  bg: string;
  surface: string;
  surfaceDim: string;
  surfaceContainer: string;
  surfaceContainerHigh: string;
  surfaceContainerLow: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textPlaceholder: string;
  outline: string;
  outlineVariant: string;
  divider: string;
  blue: string;
  blueHover: string;
  blueContainer: string;
  blueOnContainer: string;
  teal: string;
  tealContainer: string;
  tealOnContainer: string;
  red: string;
  redContainer: string;
}

/* ===== Ivory — Anthropic-inspired warm minimal light theme =====
 * Reference: anthropic.com — warm off-white background, near-black with
 * a slight warm undertone, signature coral accent used sparingly for
 * primary actions. Sophisticated, editorial, trustworthy.
 */
const IVORY: ThemeColors = {
  bg: '#FAF9F5',                    // Anthropic Light
  surface: '#FFFFFF',
  surfaceDim: '#F1EFE7',
  surfaceContainer: '#F5F3EB',
  surfaceContainerHigh: '#EAE7DA',  // close to Anthropic Light Gray (#E8E6DC)
  surfaceContainerLow: '#FCFBF7',
  textPrimary: '#141413',           // Anthropic Dark — true brand value
  textSecondary: '#3B3A38',
  textTertiary: '#6F6D67',          // close to Mid Gray
  textPlaceholder: '#B0AEA5',       // Anthropic Mid Gray
  outline: '#D6D2C5',
  outlineVariant: '#E8E6DC',        // Anthropic Light Gray
  divider: '#E8E6DC',               // Anthropic Light Gray — official divider hue
  blue: '#D97757',                  // Anthropic Orange — official primary accent
  blueHover: '#C26648',
  blueContainer: '#F4E1D8',
  blueOnContainer: '#7A3D24',
  teal: '#788C5D',                  // Anthropic Green — tertiary accent
  tealContainer: '#E4E8D9',
  tealOnContainer: '#2F3B1F',
  red: '#B54838',                   // muted sophisticated red
  redContainer: '#F5DDD7',
};

/* ===== Ivory Night — warm dark counterpart for Ivory ===== */
const IVORY_NIGHT: ThemeColors = {
  bg: '#141413',                    // Anthropic Dark
  surface: '#1F1E1C',
  surfaceDim: '#0C0C0B',
  surfaceContainer: '#262523',
  surfaceContainerHigh: '#33312D',
  surfaceContainerLow: '#1A1918',
  textPrimary: '#FAF9F5',           // Anthropic Light
  textSecondary: '#C9C5B8',
  textTertiary: '#8E8B82',
  textPlaceholder: '#5C5852',
  outline: '#4A453D',
  outlineVariant: '#2C2A26',
  divider: '#262523',
  blue: '#E89272',                  // Orange brightened a touch for dark contrast
  blueHover: '#F0A488',
  blueContainer: '#3E2519',
  blueOnContainer: '#F8D3BD',
  teal: '#A6B888',                  // Green brightened for dark
  tealContainer: '#2F3B22',
  tealOnContainer: '#E4ECCD',
  red: '#E26F5F',
  redContainer: '#3C1A15',
};

/* ===== Material 3 Expressive (Google) — vibrant, expressive Material 3 palette =====
 * Reference: Google I/O 2025 launch — purples / pinks / corals, bold action
 * colors, HCT-derived neutrals. Primary mapped to the M3 "Primary" purple
 * (#6750A4) with M3-standard surfaces. Tertiary accent uses Material's
 * coral-pink for the "expressive" pop.
 */
const MATERIAL_3: ThemeColors = {
  bg: '#FEF7FF',                    // M3 Expressive surface — very pale purple-white
  surface: '#FFFFFF',
  surfaceDim: '#EDDCFF',
  surfaceContainer: '#F3EDF7',
  surfaceContainerHigh: '#ECE6F0',
  surfaceContainerLow: '#F7F2FA',
  textPrimary: '#1D1B20',           // M3 onSurface
  textSecondary: '#49454F',         // M3 onSurfaceVariant
  textTertiary: '#79747E',
  textPlaceholder: '#AEA9B4',
  outline: '#79747E',
  outlineVariant: '#CAC4D0',
  divider: '#E7E0EC',
  blue: '#6750A4',                  // M3 Primary purple
  blueHover: '#7F67BE',
  blueContainer: '#EADDFF',
  blueOnContainer: '#21005D',
  teal: '#7D5260',                  // M3 Tertiary coral-pink
  tealContainer: '#FFD8E4',
  tealOnContainer: '#31111D',
  red: '#B3261E',                   // M3 Error
  redContainer: '#F9DEDC',
};

const MATERIAL_3_NIGHT: ThemeColors = {
  bg: '#141218',                    // M3 Dark surface
  surface: '#1D1B20',
  surfaceDim: '#0E0C12',
  surfaceContainer: '#211F26',
  surfaceContainerHigh: '#2B2930',
  surfaceContainerLow: '#1C1B1F',
  textPrimary: '#E6E1E5',           // M3 onSurface dark
  textSecondary: '#CAC4D0',
  textTertiary: '#938F99',
  textPlaceholder: '#605D66',
  outline: '#938F99',
  outlineVariant: '#49454F',
  divider: '#322F35',
  blue: '#D0BCFF',                  // M3 Primary purple (dark variant)
  blueHover: '#E1CDFF',
  blueContainer: '#4F378B',
  blueOnContainer: '#EADDFF',
  teal: '#EFB8C8',                  // M3 Tertiary coral-pink (dark variant)
  tealContainer: '#633B48',
  tealOnContainer: '#FFD8E4',
  red: '#F2B8B5',
  redContainer: '#601410',
};

/* ===== Light defaults (same as current CSS) ===== */
const LIGHT: ThemeColors = {
  bg: '#f0f4f9',
  surface: '#ffffff',
  surfaceDim: '#e3e7ec',
  surfaceContainer: '#eef2f6',
  surfaceContainerHigh: '#e3e8ed',
  surfaceContainerLow: '#f6f8fc',
  textPrimary: '#1b1b1f',
  textSecondary: '#44474e',
  textTertiary: '#74777f',
  textPlaceholder: '#9aa0a6',
  outline: '#c4c7c5',
  outlineVariant: '#e1e3df',
  divider: '#e8eaed',
  blue: '#1a73e8',
  blueHover: '#1557b0',
  blueContainer: '#d2e3fc',
  blueOnContainer: '#185abc',
  teal: '#0d7377',
  tealContainer: '#b2dfdb',
  tealOnContainer: '#004d40',
  red: '#d93025',
  redContainer: '#fce8e6',
};

/* ===== Dark defaults ===== */
const DARK: ThemeColors = {
  bg: '#131316',
  surface: '#1e1e22',
  surfaceDim: '#111114',
  surfaceContainer: '#252529',
  surfaceContainerHigh: '#2e2e33',
  surfaceContainerLow: '#1a1a1e',
  textPrimary: '#e3e3e8',
  textSecondary: '#b4b4be',
  textTertiary: '#8e8e98',
  textPlaceholder: '#5c5c66',
  outline: '#44444e',
  outlineVariant: '#363640',
  divider: '#2c2c36',
  blue: '#8ab4f8',
  blueHover: '#aecbfa',
  blueContainer: '#1a3a5c',
  blueOnContainer: '#a8c7fa',
  teal: '#4db6ac',
  tealContainer: '#0a3d3e',
  tealOnContainer: '#80cbc4',
  red: '#f28b82',
  redContainer: '#3c1414',
};

/* ===== Named themes ===== */
const OCEAN_DEPTHS: ThemeColors = {
  bg: '#0f1923',
  surface: '#172533',
  surfaceDim: '#0b1219',
  surfaceContainer: '#1d2f3f',
  surfaceContainerHigh: '#263a4c',
  surfaceContainerLow: '#13202d',
  textPrimary: '#e8f1f5',
  textSecondary: '#a8c4d4',
  textTertiary: '#6d94aa',
  textPlaceholder: '#4a7088',
  outline: '#2d5a73',
  outlineVariant: '#1e3f54',
  divider: '#1a3347',
  blue: '#2d8b8b',
  blueHover: '#3aa0a0',
  blueContainer: '#163e3e',
  blueOnContainer: '#5ec4c4',
  teal: '#a8dadc',
  tealContainer: '#1a3e3f',
  tealOnContainer: '#c5eced',
  red: '#e57373',
  redContainer: '#3c1a1a',
};

const MIDNIGHT_GALAXY: ThemeColors = {
  bg: '#1a1226',
  surface: '#241a35',
  surfaceDim: '#130d1c',
  surfaceContainer: '#2d2142',
  surfaceContainerHigh: '#382a50',
  surfaceContainerLow: '#1f1630',
  textPrimary: '#ebe0f5',
  textSecondary: '#b8a6d0',
  textTertiary: '#8873a4',
  textPlaceholder: '#5f4d7a',
  outline: '#5a4478',
  outlineVariant: '#3d2d58',
  divider: '#312447',
  blue: '#7c6bba',
  blueHover: '#9384ce',
  blueContainer: '#2e234a',
  blueOnContainer: '#b4a6e0',
  teal: '#a490c2',
  tealContainer: '#2e2144',
  tealOnContainer: '#c9b8e0',
  red: '#d48c8c',
  redContainer: '#3c1e2a',
};

const TECH_INNOVATION: ThemeColors = {
  bg: '#0a0a0f',
  surface: '#151518',
  surfaceDim: '#060608',
  surfaceContainer: '#1c1c22',
  surfaceContainerHigh: '#26262e',
  surfaceContainerLow: '#111115',
  textPrimary: '#f0f0f5',
  textSecondary: '#a8a8b8',
  textTertiary: '#6e6e80',
  textPlaceholder: '#4a4a5a',
  outline: '#3a3a48',
  outlineVariant: '#2a2a36',
  divider: '#222230',
  blue: '#0066ff',
  blueHover: '#3388ff',
  blueContainer: '#001a40',
  blueOnContainer: '#66aaff',
  teal: '#00cccc',
  tealContainer: '#003333',
  tealOnContainer: '#66e6e6',
  red: '#ff4444',
  redContainer: '#330808',
};

export const THEME_COLORS: Record<string, ThemeColors> = {
  'ivory': IVORY,
  'ivory-night': IVORY_NIGHT,
  'material3': MATERIAL_3,
  'material3-night': MATERIAL_3_NIGHT,
  'light': LIGHT,
  'dark': DARK,
  'ocean-depths': OCEAN_DEPTHS,
  'midnight-galaxy': MIDNIGHT_GALAXY,
  'tech-innovation': TECH_INNOVATION,
  'emerald-forest': {
    bg: '#0b1a12',
    surface: '#122119',
    surfaceDim: '#070f0a',
    surfaceContainer: '#182a20',
    surfaceContainerHigh: '#1f3328',
    surfaceContainerLow: '#0f1d15',
    textPrimary: '#e2efe7',
    textSecondary: '#a3c9b0',
    textTertiary: '#6b9b7c',
    textPlaceholder: '#4e7a5e',
    outline: '#2f7049',
    outlineVariant: '#1d4a30',
    divider: '#173823',
    blue: '#34d399',
    blueHover: '#5eead4',
    blueContainer: '#0d3b28',
    blueOnContainer: '#6ee7b7',
    teal: '#a7f3d0',
    tealContainer: '#0f3d2a',
    tealOnContainer: '#bbf7d0',
    red: '#f87171',
    redContainer: '#3b1212',
  },
  'sunset-ember': {
    bg: '#191110',
    surface: '#241916',
    surfaceDim: '#120c0a',
    surfaceContainer: '#2c1f1b',
    surfaceContainerHigh: '#362823',
    surfaceContainerLow: '#1e1512',
    textPrimary: '#f5ebe5',
    textSecondary: '#d4b4a2',
    textTertiary: '#a67e6a',
    textPlaceholder: '#7d5a48',
    outline: '#7a4a30',
    outlineVariant: '#4e2e1c',
    divider: '#3a2118',
    blue: '#fb923c',
    blueHover: '#fdba74',
    blueContainer: '#451a03',
    blueOnContainer: '#fed7aa',
    teal: '#fbbf24',
    tealContainer: '#451a03',
    tealOnContainer: '#fde68a',
    red: '#f87171',
    redContainer: '#451212',
  },
  'arctic-frost': {
    bg: '#f4f8fc',
    surface: '#ffffff',
    surfaceDim: '#e6eef6',
    surfaceContainer: '#edf3f9',
    surfaceContainerHigh: '#e0e8f2',
    surfaceContainerLow: '#f8fbff',
    textPrimary: '#1a2332',
    textSecondary: '#4a5568',
    textTertiary: '#718096',
    textPlaceholder: '#a0aec0',
    outline: '#cbd5e0',
    outlineVariant: '#e2e8f0',
    divider: '#edf2f7',
    blue: '#3182ce',
    blueHover: '#2b6cb0',
    blueContainer: '#bee3f8',
    blueOnContainer: '#2a4365',
    teal: '#319795',
    tealContainer: '#b2f5ea',
    tealOnContainer: '#234e52',
    red: '#e53e3e',
    redContainer: '#fed7d7',
  },
  'rose-gold': {
    bg: '#1a1215',
    surface: '#231a1f',
    surfaceDim: '#130d10',
    surfaceContainer: '#2c2126',
    surfaceContainerHigh: '#352a30',
    surfaceContainerLow: '#1e161a',
    textPrimary: '#f4e8ed',
    textSecondary: '#d4afc0',
    textTertiary: '#a87b90',
    textPlaceholder: '#7e566a',
    outline: '#7a4e62',
    outlineVariant: '#4e2e3e',
    divider: '#38202c',
    blue: '#f472b6',
    blueHover: '#f9a8d4',
    blueContainer: '#4c1233',
    blueOnContainer: '#fbcfe8',
    teal: '#c4b5fd',
    tealContainer: '#2e1f5e',
    tealOnContainer: '#ddd6fe',
    red: '#fb7185',
    redContainer: '#4c1222',
  },
  'cyber-noir': {
    bg: '#0a0a0a',
    surface: '#141414',
    surfaceDim: '#050505',
    surfaceContainer: '#1a1a1a',
    surfaceContainerHigh: '#222222',
    surfaceContainerLow: '#0f0f0f',
    textPrimary: '#e0e0e0',
    textSecondary: '#999999',
    textTertiary: '#666666',
    textPlaceholder: '#444444',
    outline: '#333333',
    outlineVariant: '#262626',
    divider: '#1e1e1e',
    blue: '#00e676',
    blueHover: '#69f0ae',
    blueContainer: '#003d1f',
    blueOnContainer: '#b9f6ca',
    teal: '#00e676',
    tealContainer: '#003d1f',
    tealOnContainer: '#b9f6ca',
    red: '#ff1744',
    redContainer: '#3c0a10',
  },
  'anime': {
    bg: '#1a1028',
    surface: '#231438',
    surfaceDim: '#130b1e',
    surfaceContainer: '#2c1a45',
    surfaceContainerHigh: '#371f55',
    surfaceContainerLow: '#1e1030',
    textPrimary: '#f0e6ff',
    textSecondary: '#c4a8e0',
    textTertiary: '#9373b5',
    textPlaceholder: '#6a4d8a',
    outline: '#5c3d80',
    outlineVariant: '#3d2660',
    divider: '#2f1c4a',
    blue: '#ff6b9d',
    blueHover: '#ff8ab5',
    blueContainer: '#4a1a35',
    blueOnContainer: '#ffb3d0',
    teal: '#7dd3fc',
    tealContainer: '#1a3448',
    tealOnContainer: '#bae6fd',
    red: '#ff6b6b',
    redContainer: '#4a1a1a',
  },
  'retro': {
    bg: '#c0c0ff',
    surface: '#e8e0f0',
    surfaceDim: '#b0a8d0',
    surfaceContainer: '#d8d0e8',
    surfaceContainerHigh: '#ccc4e0',
    surfaceContainerLow: '#e0d8f0',
    textPrimary: '#000080',
    textSecondary: '#800080',
    textTertiary: '#4b0082',
    textPlaceholder: '#8080c0',
    outline: '#ff00ff',
    outlineVariant: '#ff69b4',
    divider: '#ff00ff',
    blue: '#ff00ff',
    blueHover: '#ff69b4',
    blueContainer: '#ffe0f5',
    blueOnContainer: '#8b008b',
    teal: '#00ffff',
    tealContainer: '#e0ffff',
    tealOnContainer: '#008080',
    red: '#ff0000',
    redContainer: '#ffe0e0',
  },
};

export type ThemeCategory = 'system' | 'light' | 'dark' | 'fun';

export const THEMES: { id: ThemeId; name: string; description: string; category: ThemeCategory; preview: [string, string, string] }[] = [
  // System
  { id: 'auto', name: 'Auto', description: 'Follow system', category: 'system', preview: ['#FAF9F5', '#D97757', '#141413'] },
  // Light
  { id: 'ivory',           name: 'Ivory',           description: 'Anthropic — warm, editorial, sophisticated', category: 'light', preview: ['#FAF9F5', '#D97757', '#E8E6DC'] },
  { id: 'ivory-night',     name: 'Ivory Night',     description: 'Anthropic — warm dark counterpart',          category: 'dark',  preview: ['#141413', '#E89272', '#1F1E1C'] },
  { id: 'material3',       name: 'Material 3',      description: 'Google — vibrant, expressive Material 3',    category: 'light', preview: ['#FEF7FF', '#6750A4', '#FFD8E4'] },
  { id: 'material3-night', name: 'Material 3 Dark', description: 'Google — Material 3 Expressive, dark',       category: 'dark',  preview: ['#141218', '#D0BCFF', '#4F378B'] },
  { id: 'light', name: 'Light', description: 'Clean & bright', category: 'light', preview: ['#f0f4f9', '#1a73e8', '#ffffff'] },
  { id: 'arctic-frost', name: 'Arctic Frost', description: 'Cool winter blues', category: 'light', preview: ['#f4f8fc', '#3182ce', '#ffffff'] },
  // Dark
  { id: 'dark', name: 'Dark', description: 'Easy on the eyes', category: 'dark', preview: ['#131316', '#8ab4f8', '#1e1e22'] },
  { id: 'ocean-depths', name: 'Ocean Depths', description: 'Deep maritime blues', category: 'dark', preview: ['#0f1923', '#2d8b8b', '#172533'] },
  { id: 'midnight-galaxy', name: 'Midnight Galaxy', description: 'Cosmic purples', category: 'dark', preview: ['#1a1226', '#7c6bba', '#241a35'] },
  { id: 'tech-innovation', name: 'Tech Innovation', description: 'Electric neon', category: 'dark', preview: ['#0a0a0f', '#0066ff', '#151518'] },
  { id: 'emerald-forest', name: 'Emerald Forest', description: 'Nature greens', category: 'dark', preview: ['#0b1a12', '#34d399', '#122119'] },
  { id: 'sunset-ember', name: 'Sunset Ember', description: 'Warm amber glow', category: 'dark', preview: ['#191110', '#fb923c', '#241916'] },
  { id: 'rose-gold', name: 'Rose Gold', description: 'Elegant pink tones', category: 'dark', preview: ['#1a1215', '#f472b6', '#231a1f'] },
  { id: 'cyber-noir', name: 'Cyber Noir', description: 'Hacker green', category: 'dark', preview: ['#0a0a0a', '#00e676', '#141414'] },
  // Fun
  { id: 'anime', name: 'Anime', description: 'Sakura fantasy ✿', category: 'fun', preview: ['#1a1028', '#ff6b9d', '#7dd3fc'] },
  { id: 'retro', name: '90s Retro', description: 'GeoCities vibes!', category: 'fun', preview: ['#c0c0ff', '#ff00ff', '#ffff00'] },
];

export const VAR_MAP: [keyof ThemeColors, string][] = [
  ['bg', '--bg'],
  ['surface', '--surface'],
  ['surfaceDim', '--surface-dim'],
  ['surfaceContainer', '--surface-container'],
  ['surfaceContainerHigh', '--surface-container-high'],
  ['surfaceContainerLow', '--surface-container-low'],
  ['textPrimary', '--text-primary'],
  ['textSecondary', '--text-secondary'],
  ['textTertiary', '--text-tertiary'],
  ['textPlaceholder', '--text-placeholder'],
  ['outline', '--outline'],
  ['outlineVariant', '--outline-variant'],
  ['divider', '--divider'],
  ['blue', '--blue'],
  ['blueHover', '--blue-hover'],
  ['blueContainer', '--blue-container'],
  ['blueOnContainer', '--blue-on-container'],
  ['teal', '--teal'],
  ['tealContainer', '--teal-container'],
  ['tealOnContainer', '--teal-on-container'],
  ['red', '--red'],
  ['redContainer', '--red-container'],
];

function getSystemDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Apply a theme to the document root.
 * For 'auto', uses system preference to pick light/dark.
 */
export function applyTheme(id: ThemeId): void {
  const root = document.documentElement;

  let colors: ThemeColors;
  let effectiveId: string;
  if (id === 'auto') {
    // Auto now picks Ivory (light) or Ivory Night (dark) — the new default pair.
    colors = getSystemDark() ? IVORY_NIGHT : IVORY;
    effectiveId = getSystemDark() ? 'ivory-night' : 'ivory';
    root.setAttribute('data-theme', effectiveId);
  } else if (id === 'light') {
    colors = LIGHT;
    root.setAttribute('data-theme', 'light');
    effectiveId = 'light';
  } else if (id === 'dark') {
    colors = DARK;
    root.setAttribute('data-theme', 'dark');
    effectiveId = 'dark';
  } else {
    colors = THEME_COLORS[id] ?? IVORY;
    root.setAttribute('data-theme', id);
    effectiveId = id;
  }

  for (const [key, varName] of VAR_MAP) {
    root.style.setProperty(varName, colors[key]);
  }

  // Update scrollbar colors for dark themes
  const lightThemeIds = new Set(['light', 'ivory', 'material3', 'arctic-frost', 'retro']);
  const isDark = !lightThemeIds.has(effectiveId);
  root.style.setProperty('--scrollbar-thumb', isDark ? 'rgba(255,255,255,.15)' : 'rgba(0,0,0,.15)');
  root.style.setProperty('--scrollbar-thumb-hover', isDark ? 'rgba(255,255,255,.25)' : 'rgba(0,0,0,.25)');

  // Update meta theme-color
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', colors.bg);
}

/**
 * Listen for system theme changes (only relevant for 'auto' mode).
 * Returns a cleanup function.
 */
export function watchSystemTheme(callback: () => void): () => void {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener('change', callback);
  return () => mq.removeEventListener('change', callback);
}

const THEME_STORAGE_KEY = 'cipher_v2_theme';

export function loadThemeId(): ThemeId {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  const valid: string[] = THEMES.map((t) => t.id);
  if (stored && valid.includes(stored)) {
    return stored as ThemeId;
  }
  return 'auto';
}

export function saveThemeId(id: ThemeId): void {
  localStorage.setItem(THEME_STORAGE_KEY, id);
}
