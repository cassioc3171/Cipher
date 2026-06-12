/**
 * Locale picker. Renders inline as a small segmented control:
 *
 *    [ English ] [ فارسی ]
 *
 * Used inside the Settings panel. Lightweight — uses native buttons, no
 * dropdown, no Radix dependency, no extra animation primitives. The active
 * locale is highlighted with the standard `--blue` accent (which becomes
 * the Anthropic coral in the Ivory theme).
 */

import { useTranslation } from 'react-i18next';
import { SUPPORTED_LOCALES, setLocale, type Locale } from '../i18n';

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const current = (i18n.language || 'en').split('-')[0] as Locale;

  return (
    <div
      className="lang-switcher"
      role="radiogroup"
      aria-label={t('settings.language')}
    >
      {SUPPORTED_LOCALES.map(({ code, nativeLabel }) => {
        const active = code === current;
        return (
          <button
            key={code}
            type="button"
            role="radio"
            aria-checked={active}
            className={`lang-chip${active ? ' active' : ''}`}
            onClick={() => setLocale(code)}
            lang={code}
            dir={code === 'fa' ? 'rtl' : 'ltr'}
          >
            {nativeLabel}
          </button>
        );
      })}
    </div>
  );
}
