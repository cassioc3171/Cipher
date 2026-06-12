/**
 * In-app guide — Anthropic editorial layout.
 *
 * Two-column on desktop: a sticky table-of-contents on the left, prose on
 * the right. Stacks on mobile (TOC becomes a horizontal scroll strip of
 * tabs above the body).
 *
 * Sections:
 *   1. Quick start
 *   2. Encryption & obfuscation modes (with a per-mode comparison list)
 *   3. Paired chats (with a worked example)
 *   4. Security (open-source + offline)
 *   5. FAQ (each question on its own line)
 *
 * First-run behaviour: `useFirstRunGuide` returns a boolean indicating
 * whether the panel should auto-open. Dismissing sets the localStorage
 * flag `cipher_v2_guide_seen` so subsequent visits do not auto-open.
 */

import { useEffect, useState, useRef, type ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import { X, BookOpen, Zap, Layers, Link2, Shield, MessageSquare, GraduationCap, Play, Eye } from 'lucide-react';
import { useTutorial } from '../tutorial/TutorialContext';
import { SCENARIOS } from '../tutorial/scenarios';
import { LanguageSwitcher } from './LanguageSwitcher';

const GUIDE_SEEN_KEY = 'cipher_v2_guide_seen';

const MODE_KEYS = ['standard', 'emoji', 'persian', 'steg', 'stegCarrier', 'qr', 'noise', 'snow'] as const;
const FAQ_PAIRS = [
  ['q1', 'a1'], ['q2', 'a2'], ['q3', 'a3'], ['q4', 'a4'],
  ['q5', 'a5'], ['q6', 'a6'], ['q7', 'a7'], ['q8', 'a8'],
  ['q9', 'a9'], ['q10', 'a10'], ['q11', 'a11'], ['q12', 'a12'],
] as const;

type SectionId = 'gettingStarted' | 'tutorials' | 'modes' | 'paired' | 'cryptoVsSteg' | 'security' | 'faq';
const SECTIONS: { id: SectionId; icon: ComponentType<{ size?: number }>; tKey?: string }[] = [
  { id: 'gettingStarted', icon: Zap },
  { id: 'tutorials',      icon: GraduationCap, tKey: 'tutorial.scenariosTitle' },
  { id: 'modes',          icon: Layers },
  { id: 'paired',         icon: Link2 },
  { id: 'cryptoVsSteg',   icon: Eye },
  { id: 'security',       icon: Shield },
  { id: 'faq',            icon: MessageSquare },
];

export function useFirstRunGuide(): [boolean, () => void] {
  const [shouldOpen, setShouldOpen] = useState<boolean>(() => {
    try {
      return !localStorage.getItem(GUIDE_SEEN_KEY);
    } catch {
      return false;
    }
  });

  const markSeen = () => {
    try { localStorage.setItem(GUIDE_SEEN_KEY, '1'); } catch { /* ignore */ }
    setShouldOpen(false);
  };

  return [shouldOpen, markSeen];
}

interface GuidePanelProps {
  open: boolean;
  onClose: () => void;
}

export function GuidePanel({ open, onClose }: GuidePanelProps) {
  const { t } = useTranslation();
  const [activeId, setActiveId] = useState<SectionId>('gettingStarted');
  const contentRef = useRef<HTMLDivElement>(null);
  const { start: startTutorial } = useTutorial();

  const handleStartScenario = (scenarioId: string) => {
    onClose();
    // Wait for the Guide panel exit animation before kicking off the
    // overlay so they don't race.
    window.setTimeout(() => {
      startTutorial(scenarioId as Parameters<typeof startTutorial>[0]);
    }, 250);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Scroll the content area to top whenever the user changes sections
  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, [activeId]);

  if (!open) return null;

  return (
    <div className="settings-overlay guide-overlay" onClick={onClose}>
      <div
        className="guide-shell"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="guide-shell-title"
      >
        {/* Header bar. On wide screens lays out as
                [icon + title]   [lang switcher]  [close]
             on narrow (mobile) it wraps to two rows:
                [icon + title]                    [close]
                [lang switcher (full width)]
             so the title never collides with the switcher. */}
        <header className="guide-header">
          <div className="guide-header-title">
            <BookOpen size={18} className="guide-header-icon" aria-hidden="true" />
            <div className="guide-header-text">
              <h2 id="guide-shell-title">{t('guide.title')}</h2>
              <p className="guide-header-subtitle">{t('guide.subtitle')}</p>
            </div>
          </div>
          <button
            className="icon-btn guide-close-btn"
            onClick={onClose}
            aria-label={t('guide.closeGuide')}
          >
            <X size={20} />
          </button>
          {/* Language switcher — first-time visitors can pick their
              language right from the welcome guide. */}
          <div className="guide-header-lang">
            <LanguageSwitcher />
          </div>
        </header>

        <div className="guide-body">
          {/* Sticky table of contents */}
          <nav className="guide-toc" aria-label={t('guide.tocLabel')}>
            {SECTIONS.map(({ id, icon: Icon, tKey }) => {
              const active = activeId === id;
              const label = tKey ? t(tKey) : t(`guide.articles.${id}.title`);
              return (
                <button
                  key={id}
                  type="button"
                  className={`guide-toc-item${active ? ' active' : ''}`}
                  onClick={() => setActiveId(id)}
                  aria-current={active ? 'page' : undefined}
                >
                  <Icon size={15} />
                  <span>{label}</span>
                </button>
              );
            })}
          </nav>

          {/* Prose column */}
          <article className="guide-content" ref={contentRef}>
            {activeId === 'gettingStarted' && (
              <section>
                <h3 className="guide-section-title">{t('guide.articles.gettingStarted.title')}</h3>
                <p className="guide-prose">{t('guide.articles.gettingStarted.body')}</p>
              </section>
            )}

            {activeId === 'tutorials' && (
              <section>
                <h3 className="guide-section-title">{t('tutorial.scenariosTitle')}</h3>
                <p className="guide-prose">{t('tutorial.scenariosIntro')}</p>
                <div className="guide-scenarios">
                  {Object.values(SCENARIOS).map((scn) => (
                    <button
                      key={scn.id}
                      type="button"
                      className="guide-scenario"
                      onClick={() => handleStartScenario(scn.id)}
                    >
                      <div className="guide-scenario-text">
                        <span className="guide-scenario-title">
                          {t(`tutorial.scenarios.${scn.id}.title`)}
                        </span>
                        <span className="guide-scenario-meta">
                          {t(`tutorial.scenarios.${scn.id}.summary`)}
                          {' · '}
                          {t('tutorial.minutes', { count: scn.estimatedMinutes })}
                        </span>
                      </div>
                      <span className="guide-scenario-cta">
                        <Play size={11} aria-hidden="true" />
                        <span>{t('tutorial.startScenario')}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {activeId === 'modes' && (
              <section>
                <h3 className="guide-section-title">{t('guide.articles.modes.title')}</h3>
                <p className="guide-prose">{t('guide.articles.modes.body')}</p>
                <ul className="guide-mode-list">
                  {MODE_KEYS.map((key) => (
                    <li key={key} className="guide-mode-item">
                      <span className="guide-mode-text">{t(`guide.articles.modes.items.${key}`)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {activeId === 'paired' && (
              <section>
                <h3 className="guide-section-title">{t('guide.articles.paired.title')}</h3>
                <p className="guide-prose">{t('guide.articles.paired.body')}</p>
                <div className="guide-callout">
                  {t('guide.articles.paired.example').split('\n\n').map((para, i) => (
                    <p key={i} className="guide-prose">{para}</p>
                  ))}
                </div>
              </section>
            )}

            {activeId === 'cryptoVsSteg' && (() => {
              const tableRows = t('guide.articles.cryptoVsSteg.tableRows', { returnObjects: true }) as string[];
              return (
                <section>
                  <h3 className="guide-section-title">{t('guide.articles.cryptoVsSteg.title')}</h3>
                  <p className="guide-prose">{t('guide.articles.cryptoVsSteg.intro')}</p>
                  <h4 className="guide-subsection-title">{t('guide.articles.cryptoVsSteg.cryptoTitle')}</h4>
                  {t('guide.articles.cryptoVsSteg.cryptoBody').split('\n\n').map((para, i) => (
                    <p key={i} className="guide-prose">{para}</p>
                  ))}
                  <h4 className="guide-subsection-title">{t('guide.articles.cryptoVsSteg.stegTitle')}</h4>
                  {t('guide.articles.cryptoVsSteg.stegBody').split('\n\n').map((para, i) => (
                    <p key={i} className="guide-prose">{para}</p>
                  ))}
                  <h4 className="guide-subsection-title">{t('guide.articles.cryptoVsSteg.tableTitle')}</h4>
                  {tableRows.length > 0 && (
                    <ul className="guide-mode-list">
                      {tableRows.map((row, i) => (
                        <li key={i} className="guide-mode-item">
                          <span className="guide-mode-text">{row}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="guide-callout">
                    {t('guide.articles.cryptoVsSteg.combined').split('\n\n').map((para, i) => (
                      <p key={i} className="guide-prose">{para}</p>
                    ))}
                  </div>
                </section>
              );
            })()}

            {activeId === 'security' && (
              <section>
                <h3 className="guide-section-title">{t('guide.articles.security.title')}</h3>
                <p className="guide-prose">{t('guide.articles.security.body')}</p>
              </section>
            )}

            {activeId === 'faq' && (
              <section>
                <h3 className="guide-section-title">{t('guide.articles.faq.title')}</h3>
                <dl className="guide-faq">
                  {FAQ_PAIRS.map(([qKey, aKey]) => (
                    <div key={qKey} className="guide-faq-row">
                      <dt>{t(`guide.articles.faq.items.${qKey}`)}</dt>
                      <dd>{t(`guide.articles.faq.items.${aKey}`)}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}
          </article>
        </div>
      </div>
    </div>
  );
}
