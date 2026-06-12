/**
 * i18n bootstrap for Cipher.
 *
 * - English (en) is the source of truth and the fallback for every missing key.
 * - Farsi (fa) is the second locale. Persian text needs RTL — the i18n init
 *   handler below also sets `<html lang>` and `<html dir>` on every locale change.
 * - Locale choice is persisted in localStorage under `cipher_v2_locale` so it
 *   survives reload, and also read from <html lang> on startup for SSR
 *   compatibility (we don't have SSR but it keeps the pattern clean).
 *
 * Adding a third locale:
 * 1. Create `locales/<code>.json` with the same keys as `en.json`.
 * 2. Import it below and add to `resources`.
 * 3. Add the code to `SUPPORTED_LOCALES` (handles RTL flag).
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import fa from './locales/fa.json';

export type Locale = 'en' | 'fa';

/** Locales that should render right-to-left. */
const RTL_LOCALES = new Set<Locale>(['fa']);

export const SUPPORTED_LOCALES: { code: Locale; label: string; nativeLabel: string }[] = [
  { code: 'en', label: 'English', nativeLabel: 'English' },
  { code: 'fa', label: 'Persian', nativeLabel: 'فارسی' },
];

const STORAGE_KEY = 'cipher_v2_locale';

/** Apply <html lang> and <html dir> for the given locale. Idempotent. */
export function applyHtmlDirection(locale: Locale): void {
  const html = document.documentElement;
  html.setAttribute('lang', locale);
  html.setAttribute('dir', RTL_LOCALES.has(locale) ? 'rtl' : 'ltr');
}

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      fa: { translation: fa },
    },
    fallbackLng: 'en',
    supportedLngs: ['en', 'fa'],
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: STORAGE_KEY,
    },
    interpolation: {
      escapeValue: false, // React already escapes
    },
    returnEmptyString: false,
  });

// Set <html lang dir> on startup and on every locale change.
applyHtmlDirection((i18n.language as Locale) || 'en');
i18n.on('languageChanged', (lng) => {
  applyHtmlDirection((lng as Locale) || 'en');
});

export { i18n };

/** Programmatic locale switch — also writes to localStorage via the detector cache. */
export function setLocale(locale: Locale): void {
  void i18n.changeLanguage(locale);
}

/** Returns true if the current locale is right-to-left. */
export function isRtl(): boolean {
  return RTL_LOCALES.has(i18n.language as Locale);
}
