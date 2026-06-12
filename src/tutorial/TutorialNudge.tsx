/**
 * First-run nudge — a small toast that invites the user to try the
 * introductory tutorial. Shown once. Dismissible.
 *
 * Why plain CSS instead of motion.div + AnimatePresence: motion 12.x can
 * leave the exiting <motion.div> mounted forever with opacity:0 — the
 * orphaned node keeps eating clicks in the bottom-left corner invisibly.
 * Several documented workarounds (transitionEnd, pointerEvents in exit,
 * attribute-selector CSS) either don't fire on this version or break the
 * live nudge's enter animation under React StrictMode. A plain `if
 * (!open) return null;` + CSS enter keyframe is the simplest reliable
 * approach. We give up the fade-out (the toast just disappears the
 * moment the user clicks Dismiss) but the dismiss action feels
 * instantaneous anyway, so the trade-off is fine.
 *
 * QA pass 2026-05-27 verified: post-dismiss, the .tutorial-nudge element
 * is removed from the DOM entirely (no click-eating ghost).
 */

import { useTranslation } from 'react-i18next';
import { Sparkles, X } from 'lucide-react';
import { useTutorial } from './TutorialContext';

export function TutorialNudge() {
  const { t } = useTranslation();
  const { shouldNudge, dismissNudge, start, active } = useTutorial();

  // Hide while a tutorial is running or already permanently dismissed
  const open = shouldNudge && !active;
  if (!open) return null;

  return (
    <div
      className="tutorial-nudge tutorial-nudge--entering"
      role="status"
      aria-live="polite"
    >
      <span className="tutorial-nudge-icon" aria-hidden="true">
        <Sparkles size={16} />
      </span>
      <div className="tutorial-nudge-text">
        <span className="tutorial-nudge-title">{t('tutorial.nudgeTitle')}</span>
        <span className="tutorial-nudge-desc">{t('tutorial.nudgeDesc')}</span>
      </div>
      <div className="tutorial-nudge-actions">
        <button
          type="button"
          className="tutorial-nudge-cta"
          onClick={() => { start('encryptSimple'); }}
        >
          {t('tutorial.nudgeCta')}
        </button>
        <button
          type="button"
          className="tutorial-nudge-dismiss"
          onClick={dismissNudge}
          aria-label={t('tutorial.nudgeDismiss')}
          title={t('tutorial.nudgeDismiss')}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
