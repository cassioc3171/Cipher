/**
 * Tutorial overlay — 4-segment dim backdrop + spotlight ring + animated tooltip.
 *
 * The "spotlight" is a click-through hole in the dim layer. Instead of one
 * full-screen backdrop (which blocks every click), we render four fixed
 * segments — top, bottom, left, right — that frame the spotlight rect.
 * The cutout area in the middle has no overlay, so the highlighted button
 * is naturally clickable / focusable / typeable.
 *
 * A separate ring element draws the coral outline and pulse animation
 * around the spotlight without blocking clicks.
 */

import { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowLeft, ArrowRight, X, Check, BookOpen } from 'lucide-react';
import { useTutorial } from './TutorialContext';

const SPOTLIGHT_PADDING = 6;
// Mobile gets a narrower tooltip (the CSS `@media (max-width: 760px)`
// overrides width to `calc(100vw - 24px)`, but pickSide / position math
// still uses the JS constants). Computing both widths upfront keeps the
// "fits" check honest on small viewports.
function tooltipWidth(): number {
  return window.innerWidth <= 760
    ? Math.max(280, window.innerWidth - 24)
    : 340;
}
// Compact tooltip CSS kicks in at <=760 px, so the height estimate drops
// too. Real measured heights: desktop ~263 px, mobile-compact ~200 px.
// Keep a small safety margin over the measured value so pickSide doesn't
// place the tooltip flush against the spotlight target.
function tooltipHeightEst(): number {
  return window.innerWidth <= 760 ? 220 : 280;
}
const TOOLTIP_GAP = 14;
const VIEWPORT_MARGIN = 12;

type Side = 'top' | 'right' | 'bottom' | 'left' | 'center';

function pickSide(rect: DOMRect, preferred: Side | 'auto'): Side {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const TW = tooltipWidth();
  const TH = tooltipHeightEst();
  const fits = (side: Side): boolean => {
    if (side === 'top')    return rect.top - TOOLTIP_GAP - TH >= VIEWPORT_MARGIN;
    if (side === 'bottom') return rect.bottom + TOOLTIP_GAP + TH <= vh - VIEWPORT_MARGIN;
    if (side === 'left')   return rect.left - TOOLTIP_GAP - TW >= VIEWPORT_MARGIN;
    if (side === 'right')  return rect.right + TOOLTIP_GAP + TW <= vw - VIEWPORT_MARGIN;
    return false;
  };
  const order: Side[] = preferred === 'auto'
    ? ['bottom', 'top', 'right', 'left']
    : [preferred as Side, 'bottom', 'top', 'right', 'left'];
  for (const s of order) {
    if (s !== 'center' && fits(s)) return s;
  }
  return 'center';
}

function computeTooltipPosition(rect: DOMRect, side: Side): { top: number; left: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const TW = tooltipWidth();
  const TH = tooltipHeightEst();
  // Clamp helpers so the tooltip can never end up scrolled off-screen,
  // even when the target rect lives in an animating bottom sheet whose
  // getBoundingClientRect() trails its CSS-positioned bounds. (Scenario
  // 3 inside .obf-popover on mobile hit this — QA 2026-05-27.)
  const clampTop = (top: number): number =>
    Math.max(VIEWPORT_MARGIN, Math.min(vh - TH - VIEWPORT_MARGIN, top));
  const clampLeft = (left: number): number =>
    Math.max(VIEWPORT_MARGIN, Math.min(vw - TW - VIEWPORT_MARGIN, left));

  // When the target rect is reported below the viewport (real bottom-sheet
  // popovers on mobile sometimes do this — getBoundingClientRect lags the
  // CSS bottom:0 positioning), forcibly pin the tooltip to the top half of
  // the viewport so it doesn't overlap the sheet it's supposed to describe.
  const targetOffscreenBelow = rect.top >= vh - VIEWPORT_MARGIN;
  if (targetOffscreenBelow) {
    return { top: VIEWPORT_MARGIN, left: clampLeft(vw / 2 - TW / 2) };
  }

  if (side === 'center') {
    return { top: clampTop(vh / 2 - TH / 2), left: clampLeft(vw / 2 - TW / 2) };
  }
  if (side === 'top') {
    return {
      top: clampTop(rect.top - TH - TOOLTIP_GAP),
      left: clampLeft(rect.left + rect.width / 2 - TW / 2),
    };
  }
  if (side === 'bottom') {
    return {
      top: clampTop(rect.bottom + TOOLTIP_GAP),
      left: clampLeft(rect.left + rect.width / 2 - TW / 2),
    };
  }
  if (side === 'left') {
    return {
      top: clampTop(rect.top + rect.height / 2 - TH / 2),
      left: rect.left - TW - TOOLTIP_GAP,
    };
  }
  // right
  return {
    top: clampTop(rect.top + rect.height / 2 - TH / 2),
    left: rect.right + TOOLTIP_GAP,
  };
}

export function TutorialOverlay() {
  const { t } = useTranslation();
  const { active, currentStep, activeRect, next, prev, close, hintActive, triggerHint, canAdvance } = useTutorial();
  const reduceMotion = useReducedMotion();

  const stepKey = active && currentStep
    ? `${active.scenario.id}.${currentStep.id}`
    : '';
  const stepNumber = active ? active.stepIndex + 1 : 0;
  const stepTotal = active?.scenario.steps.length ?? 0;
  const isLast = active ? active.stepIndex === active.scenario.steps.length - 1 : false;
  const isFirst = active?.stepIndex === 0;

  /** The padded spotlight rect, in viewport pixels. */
  const spotlight = useMemo(() => {
    if (!activeRect) return null;
    return {
      top: activeRect.top - SPOTLIGHT_PADDING,
      left: activeRect.left - SPOTLIGHT_PADDING,
      width: activeRect.width + SPOTLIGHT_PADDING * 2,
      height: activeRect.height + SPOTLIGHT_PADDING * 2,
    };
  }, [activeRect]);

  /** The four dim segments framing the spotlight (top / bottom / left / right). */
  const segments = useMemo(() => {
    if (!spotlight) return null;
    const right = spotlight.left + spotlight.width;
    const bottom = spotlight.top + spotlight.height;
    return {
      top:    { top: 0,             left: 0,             width: '100vw',                                     height: Math.max(0, spotlight.top) },
      bottom: { top: bottom,        left: 0,             width: '100vw',                                     height: `calc(100vh - ${bottom}px)` },
      left:   { top: spotlight.top, left: 0,             width: Math.max(0, spotlight.left),                 height: spotlight.height },
      right:  { top: spotlight.top, left: right,         width: `calc(100vw - ${right}px)`,                  height: spotlight.height },
    } as const;
  }, [spotlight]);

  const tooltip = useMemo(() => {
    if (!activeRect || !currentStep) {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      return { top: vh / 2 - tooltipHeightEst() / 2, left: vw / 2 - tooltipWidth() / 2, side: 'center' as Side };
    }
    const side = pickSide(activeRect, currentStep.side ?? 'auto');
    const { top, left } = computeTooltipPosition(activeRect, side);
    return { top, left, side };
  }, [activeRect, currentStep]);

  if (!active || !currentStep) return null;

  const title = t(`tutorial.scenarios.${active.scenario.id}.steps.${currentStep.id}.title`, '');
  const body = t(`tutorial.scenarios.${active.scenario.id}.steps.${currentStep.id}.body`, '');

  // Motion spring — falls back to plain ease when prefers-reduced-motion
  const spring = reduceMotion
    ? { duration: 0.2 }
    : { type: 'spring' as const, stiffness: 260, damping: 28, mass: 0.85 };

  return createPortal(
    <div className="tutorial-root" role="presentation">
      {segments && (
        <>
          <motion.div className="tutorial-cutout-seg" initial={false} animate={segments.top}    transition={spring} aria-hidden="true" onClick={triggerHint} />
          <motion.div className="tutorial-cutout-seg" initial={false} animate={segments.bottom} transition={spring} aria-hidden="true" onClick={triggerHint} />
          <motion.div className="tutorial-cutout-seg" initial={false} animate={segments.left}   transition={spring} aria-hidden="true" onClick={triggerHint} />
          <motion.div className="tutorial-cutout-seg" initial={false} animate={segments.right}  transition={spring} aria-hidden="true" onClick={triggerHint} />
        </>
      )}

      {spotlight && (
        <motion.div
          key="spotlight-ring"
          className="tutorial-spotlight-ring"
          initial={false}
          animate={spotlight}
          transition={spring}
          aria-hidden="true"
        >
          <span className="tutorial-pulse" aria-hidden="true" />
        </motion.div>
      )}

      {/* Soft hint shown when the user clicks the dim backdrop instead
          of the highlighted element. Auto-dismisses after ~1.6 s. */}
      {spotlight && (
        <AnimatePresence>
          {hintActive && (
            <motion.div
              key="hint"
              className="tutorial-hint"
              style={{
                top: spotlight.top + spotlight.height + 10,
                left: spotlight.left + spotlight.width / 2,
              }}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -2, scale: 0.96 }}
              transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.16, 1, 0.3, 1] }}
              role="status"
              aria-live="polite"
            >
              <span className="tutorial-hint-arrow" aria-hidden="true" />
              <span className="tutorial-hint-label">
                {currentStep?.advanceOn === 'next'
                  ? t('tutorial.hintNext')
                  : currentStep?.advanceOn === 'input'
                    ? t('tutorial.hintType')
                    : t('tutorial.hintClick')}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={stepKey}
          className={`tutorial-tooltip side-${tooltip.side}`}
          role="dialog"
          aria-modal="false"
          aria-labelledby="tutorial-title"
          aria-describedby="tutorial-body"
          initial={reduceMotion ? false : { opacity: 0, y: 8, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1, pointerEvents: 'auto' }}
          exit={reduceMotion
            ? { opacity: 0, pointerEvents: 'none' }
            : { opacity: 0, y: -4, scale: 0.985, pointerEvents: 'none', transition: { duration: 0.14 } }}
          transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.16, 1, 0.3, 1] }}
          style={{ top: tooltip.top, left: tooltip.left, width: tooltipWidth() }}
        >
          <header className="tutorial-tooltip-head">
            <span className="tutorial-progress">
              <BookOpen size={12} aria-hidden="true" />
              <span>{stepNumber} / {stepTotal}</span>
            </span>
            <button
              className="tutorial-close"
              onClick={close}
              type="button"
              aria-label={t('tutorial.close')}
              title={t('tutorial.close')}
            >
              <X size={15} />
            </button>
          </header>

          <h3 id="tutorial-title" className="tutorial-tooltip-title">{title}</h3>
          <p id="tutorial-body" className="tutorial-tooltip-body">{body}</p>

          <footer className="tutorial-tooltip-foot">
            <button
              className="tutorial-btn ghost"
              onClick={prev}
              type="button"
              disabled={isFirst}
            >
              <ArrowLeft size={14} />
              <span>{t('tutorial.prev')}</span>
            </button>
            <button
              className={`tutorial-btn primary${canAdvance ? '' : ' disabled'}`}
              onClick={canAdvance ? next : triggerHint}
              type="button"
              aria-disabled={!canAdvance}
            >
              <span>{isLast ? t('tutorial.finish') : t('tutorial.next')}</span>
              {isLast ? <Check size={14} /> : <ArrowRight size={14} />}
            </button>
          </footer>
        </motion.div>
      </AnimatePresence>
    </div>,
    document.body,
  );
}
