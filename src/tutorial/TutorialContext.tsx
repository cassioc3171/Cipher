/**
 * Tutorial state container.
 *
 * Owns the currently-active scenario + step index, resolves selectors to
 * live DOM elements, tracks the active element's bounding rect, lifts the
 * target above the overlay so it stays clickable, and listens for the
 * configured advancement event (`click`, `input`, or only `next`).
 *
 * Persistence: when a tutorial is active, we mirror `{scenarioId,
 * stepIndex}` to localStorage so a refresh resumes mid-flow. When the
 * user finishes or closes, we clear the active key and (on finish) set a
 * per-scenario "done" flag.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { getScenario, type ScenarioId } from './scenarios';
import type { TutorialScenario, TutorialStep } from './types';

const ACTIVE_KEY = 'cipher_v2_tutorial_active';
const DONE_KEY_PREFIX = 'cipher_v2_tutorial_done_';
const NUDGE_KEY = 'cipher_v2_tutorial_nudge_dismissed';

interface ActiveState {
  scenario: TutorialScenario;
  stepIndex: number;
}

interface TutorialContextValue {
  /** The active scenario, or null when no tutorial is running. */
  active: ActiveState | null;
  /** The currently-active step (derived from `active`). */
  currentStep: TutorialStep | null;
  /** The live bounding rect of the highlighted element. Recomputed on
   *  scroll, resize, and step change. Null while resolving. */
  activeRect: DOMRect | null;
  /** Start a scenario by id. Resets step to 0 and clears any done flag. */
  start: (id: ScenarioId) => void;
  /** Advance to the next step. Calls scenario.onFinish when past the last. */
  next: () => void;
  /** Go back one step (does nothing on step 0). */
  prev: () => void;
  /** Abort the tutorial without marking it complete. */
  close: () => void;
  /** True when the first-run nudge toast should be visible. */
  shouldNudge: boolean;
  /** Dismiss the nudge without starting any tutorial. */
  dismissNudge: () => void;
  /** Briefly flash the "click the highlighted button" hint near the
   *  spotlight. Triggered when the user clicks the dim backdrop
   *  segments. Auto-dismisses after ~1.6 s. */
  hintActive: boolean;
  triggerHint: () => void;
  /** True when the Next button should be live for the active step.
   *  False for `input` steps when the field hasn't reached its
   *  `inputMinLength` yet — clicking Next in that state should flash
   *  the hint instead of advancing, otherwise the next step's premise
   *  is broken (e.g. "press Encrypt" with nothing to encrypt). */
  canAdvance: boolean;
}

const TutorialContext = createContext<TutorialContextValue | null>(null);

/** Read the persisted active state on app boot. Returns null on parse errors. */
function readPersistedActive(): ActiveState | null {
  try {
    const raw = localStorage.getItem(ACTIVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { scenarioId: string; stepIndex: number };
    const scenario = getScenario(parsed.scenarioId);
    if (!scenario) return null;
    const stepIndex = Math.max(0, Math.min(scenario.steps.length - 1, parsed.stepIndex || 0));
    return { scenario, stepIndex };
  } catch {
    return null;
  }
}

function isDoneInStorage(scenarioId: string): boolean {
  try { return !!localStorage.getItem(DONE_KEY_PREFIX + scenarioId); } catch { return false; }
}

function writePersistedActive(active: ActiveState | null): void {
  try {
    if (active) {
      localStorage.setItem(ACTIVE_KEY, JSON.stringify({
        scenarioId: active.scenario.id,
        stepIndex: active.stepIndex,
      }));
    } else {
      localStorage.removeItem(ACTIVE_KEY);
    }
  } catch { /* private mode etc. */ }
}

function markDone(scenarioId: string): void {
  try { localStorage.setItem(DONE_KEY_PREFIX + scenarioId, '1'); } catch { /* ignore */ }
}

function readNudgeDismissed(): boolean {
  try { return !!localStorage.getItem(NUDGE_KEY); } catch { return false; }
}

function writeNudgeDismissed(): void {
  try { localStorage.setItem(NUDGE_KEY, '1'); } catch { /* ignore */ }
}

/**
 * Resolve a tutorial selector to a live DOM element.
 *
 * Supports a custom `:last` suffix (anywhere in the chain) that yields
 * the last `querySelectorAll` match — not the CSS `:last-of-type` which
 * only checks tag name and breaks once unrelated siblings (toasts, end-
 * refs) appear. For example, `.msg-bubble.encrypt:last .msg-output`
 * returns the .msg-output inside the LAST `.msg-bubble.encrypt` even
 * when a `.msg-bubble.decrypt` or a trailing scroll ref sits after it.
 */
function resolveSelector(sel: string): HTMLElement | null {
  // `parent:last child` — split on the first `:last `, take last match
  // of the parent, then querySelector inside it.
  const lastIdx = sel.indexOf(':last ');
  if (lastIdx >= 0) {
    const parentSel = sel.slice(0, lastIdx);
    const childSel = sel.slice(lastIdx + ':last '.length);
    const parents = document.querySelectorAll<HTMLElement>(parentSel);
    const parent = parents[parents.length - 1];
    if (!parent) return null;
    return parent.querySelector<HTMLElement>(childSel);
  }
  // `selector:last` — return the last `querySelectorAll` match.
  if (sel.endsWith(':last')) {
    const base = sel.slice(0, -':last'.length);
    const matches = document.querySelectorAll<HTMLElement>(base);
    return matches.length > 0 ? matches[matches.length - 1] : null;
  }
  return document.querySelector<HTMLElement>(sel);
}

export function TutorialProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<ActiveState | null>(() => readPersistedActive());
  const [activeRect, setActiveRect] = useState<DOMRect | null>(null);
  const [shouldNudge, setShouldNudge] = useState<boolean>(() => {
    // Nudge only if the user has never dismissed it AND no scenario is finished
    return !readNudgeDismissed() && !isDoneInStorage('encryptSimple');
  });
  const targetRef = useRef<HTMLElement | null>(null);
  const epochRef = useRef<number>(0);
  const hintTimerRef = useRef<number>(0);
  const [hintActive, setHintActive] = useState<boolean>(false);
  /** Handle of the active recovery interval, exposed so the click
   *  listener can cancel it the moment a click registers — otherwise
   *  the interval can tick between the click (which closes the
   *  obfuscation popover) and the 80 ms-delayed `advance()`, see the
   *  previous step's target as detached, and re-run that step's
   *  `setup()` to reopen the popover. Set in the rect-update effect,
   *  read in the action-listener effect. */
  const recoveryIntervalRef = useRef<number>(0);
  /** Live value of the highlighted input/textarea, tracked so the Next
   *  button can be disabled until the user has typed enough. Reset on
   *  every step change. */
  const [liveInputValue, setLiveInputValue] = useState<string>('');
  const inputTimerRef = useRef<number>(0);
  /** Bumped whenever a new target element is bound. Used as the
   *  re-run trigger for the action-listener effect so that listener
   *  attachment is decoupled from rect changes (smooth-scroll
   *  animations, layout shifts) — those would otherwise reset the
   *  input-auto-advance timer mid-step. */
  const [targetVersion, setTargetVersion] = useState<number>(0);

  const currentStep = active ? active.scenario.steps[active.stepIndex] ?? null : null;

  /* Persist on change */
  useEffect(() => {
    writePersistedActive(active);
  }, [active]);

  /* Hide the nudge as soon as a tutorial starts */
  useEffect(() => {
    if (active && shouldNudge) {
      setShouldNudge(false);
      writeNudgeDismissed();
    }
  }, [active, shouldNudge]);

  /* Re-measure on scroll/resize, and recover when the target gets
   *  removed from the DOM mid-step (e.g. the obfuscation popover gets
   *  dismissed by a stray click). When that happens we re-run the
   *  step's setup() to recreate the surface, then re-resolve the
   *  selector and lift the new target. */
  useEffect(() => {
    if (!active) return;
    let recovering = false;
    const update = async () => {
      const el = targetRef.current;
      if (el && document.contains(el)) {
        const next = el.getBoundingClientRect();
        // Only commit if the rect actually moved — DOMRect objects are
        // new on every read, so blindly setting state would cause a
        // re-render every 250 ms (tooltip / spotlight reposition for
        // no visible change). The action-listener effect uses a
        // separate `targetVersion` re-run trigger so it's unaffected
        // by rect changes, but keeping this stable still avoids
        // unnecessary repaints.
        setActiveRect((prev) => {
          if (prev
            && prev.top === next.top
            && prev.left === next.left
            && prev.width === next.width
            && prev.height === next.height) return prev;
          return next;
        });
        return;
      }
      // Target lost. Run step setup if it can rebuild it.
      if (recovering) return;
      const step = active.scenario.steps[active.stepIndex];
      if (!step) return;
      recovering = true;
      try {
        if (step.setup) await step.setup();
      } catch { /* swallow */ }
      const fresh = resolveSelector(step.selector);
      if (fresh) {
        const r = fresh.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          const same = targetRef.current === fresh;
          targetRef.current = fresh;
          setActiveRect(r);
          if (!same) setTargetVersion((v) => v + 1);
          if (step.advanceOn === 'input'
              && (fresh instanceof HTMLInputElement || fresh instanceof HTMLTextAreaElement)) {
            try { fresh.focus({ preventScroll: true }); } catch { /* swallow */ }
          }
        }
      }
      recovering = false;
    };
    // Named handler so removeEventListener actually matches (inline arrows
    // are different function objects and would never be removed → listener leak).
    const onWindowChange = () => void update();
    window.addEventListener('resize', onWindowChange, { passive: true });
    window.addEventListener('scroll', onWindowChange, { passive: true, capture: true });
    const interval = window.setInterval(() => void update(), 250);
    recoveryIntervalRef.current = interval;
    return () => {
      window.removeEventListener('resize', onWindowChange);
      window.removeEventListener('scroll', onWindowChange, { capture: true } as unknown as EventListenerOptions);
      window.clearInterval(interval);
      if (recoveryIntervalRef.current === interval) recoveryIntervalRef.current = 0;
    };
  }, [active]);

  /* Resolve the selector for the current step + apply lift styling.
   *
   *  Epoch-tracked instead of cancellation-tracked: each time the
   *  effect runs we bump a ref. The async chain reads the ref via
   *  closure and bails only when the live ref no longer matches the
   *  epoch it started with. That side-steps React StrictMode's
   *  double-invocation cleanup-cancels-everything trap because the
   *  second effect run bumps the epoch and proceeds; the first run
   *  is the one that bails.
   */
  useEffect(() => {
    if (!active || !currentStep) {
      setActiveRect(null);
      return;
    }
    epochRef.current += 1;
    const myEpoch = epochRef.current;
    let timeoutId = 0;
    const stillCurrent = () => epochRef.current === myEpoch;

    const apply = async () => {
      // Step-level setup (e.g. open the obfuscation popover).
      if (currentStep.setup) {
        try { await currentStep.setup(); } catch { /* swallow */ }
        if (!stillCurrent()) return;
      }
      // Wait a tick for the DOM to settle after setup / state change.
      // Using setTimeout instead of requestAnimationFrame because rAF
      // is throttled (sometimes paused) in background / hidden tabs.
      await new Promise((r) => window.setTimeout(r, 16));
      if (!stillCurrent()) return;

      // Check precondition; if it fails, auto-skip the step.
      if (currentStep.precondition && !currentStep.precondition()) {
        timeoutId = window.setTimeout(() => {
          if (stillCurrent()) advance();
        }, 0);
        return;
      }

      // Retry-resolve the selector for up to ~1.2 s. Element may not yet
      // be in the DOM when the step activates (e.g. the popover opens
      // after a click, or async encryption hasn't appended the new
      // bubble yet).
      //
      // For `:last` selectors we keep polling for an additional 1.8 s
      // even after we find a valid element, because the "latest" match
      // can change as new elements arrive (an in-flight encrypt may
      // append a fresh bubble after the previous step's click). We end
      // when the resolved element has been stable for ~400 ms.
      const isLastSelector = currentStep.selector.includes(':last');
      let el: HTMLElement | null = null;
      let lastEl: HTMLElement | null = null;
      let stableSince = 0;
      const startedAt = performance.now();
      const deadline = startedAt + (isLastSelector ? 3000 : 1200);
      while (performance.now() < deadline) {
        const candidate = resolveSelector(currentStep.selector);
        if (candidate) {
          const r = candidate.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) {
            if (candidate === lastEl) {
              if (performance.now() - stableSince >= 400) {
                el = candidate;
                break; // stable enough
              }
            } else {
              lastEl = candidate;
              stableSince = performance.now();
              // For non-last selectors any stable hit will do — break
              // out of the inner loop sooner.
              if (!isLastSelector) {
                el = candidate;
                break;
              }
            }
          }
        }
        await new Promise((res) => window.setTimeout(res, 80));
        if (!stillCurrent()) return;
      }
      // Fall through to whatever we found last (better than null).
      el = el ?? lastEl;
      if (!el) {
        setActiveRect(null);
        return;
      }

      // Scroll into view if needed
      const rect = el.getBoundingClientRect();
      const inView =
        rect.top >= 60 && rect.bottom <= window.innerHeight - 60 &&
        rect.left >= 8 && rect.right <= window.innerWidth - 8;
      if (!inView) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        await new Promise((r) => window.setTimeout(r, 320));
        if (!stillCurrent()) return;
      }
      // The element stays in its natural location and z-index. The
      // 4-segment cutout overlay leaves the spotlight area uncovered,
      // so the user can click / focus / type the element directly.
      const same = targetRef.current === el;
      targetRef.current = el;
      setActiveRect(el.getBoundingClientRect());
      if (!same) setTargetVersion((v) => v + 1);

      // For input-style steps, focus the target so typing works without
      // the user having to click it first. Skip auto-focus on click
      // steps so we don't accidentally trigger their default behaviour.
      if (currentStep.advanceOn === 'input') {
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
          try { el.focus({ preventScroll: true }); } catch { /* swallow */ }
        }
      }
    };
    void apply();

    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
      targetRef.current = null;
      if (currentStep?.teardown) {
        try { void currentStep.teardown(); } catch { /* swallow */ }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.scenario.id, active?.stepIndex]);

  /* Reset the tracked input value on every step change so the Next
   *  button doesn't stay enabled with a stale value when the next
   *  input step activates with an empty field. */
  useEffect(() => {
    setLiveInputValue('');
  }, [active?.scenario.id, active?.stepIndex]);

  /* Wire the action-based advancement: listen for click/input on the
   *  highlighted element. The Next button works as a manual override
   *  for click-style steps, but is disabled on input steps until the
   *  field reaches its inputMinLength. */
  useEffect(() => {
    if (!active || !currentStep || currentStep.advanceOn === 'next') return;
    const el = targetRef.current;
    if (!el) return;
    // Prime liveInputValue from the existing value when the step
    // activates — handles the case where the user already typed
    // something while Previous-ing back, or a scenario.setup() pre-
    // filled the field before the listener was attached. If the
    // pre-existing value already satisfies minLength, kick the auto-
    // advance debounce so the tutorial doesn't stall.
    if (currentStep.advanceOn === 'input'
        && (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) {
      setLiveInputValue(el.value);
      if (el.value.length >= (currentStep.inputMinLength ?? 1)) {
        window.clearTimeout(inputTimerRef.current);
        inputTimerRef.current = window.setTimeout(() => advance(), 700);
      }
    }
    const handler = (e: Event) => {
      if (currentStep.advanceOn === 'click') {
        // Cancel the recovery interval right away. The 80 ms grace
        // period below is enough for an in-flight tick to fire its
        // "target gone — re-run setup()" branch, which on popover-
        // pick steps re-opens the popover the click just dismissed.
        // The next step's own effect installs a fresh interval.
        if (recoveryIntervalRef.current) {
          window.clearInterval(recoveryIntervalRef.current);
          recoveryIntervalRef.current = 0;
        }
        // Any click on the element counts.
        // Let the click run first so the underlying app state updates,
        // then advance after a tick.
        window.setTimeout(() => advance(), 80);
      } else if (currentStep.advanceOn === 'input') {
        const value = (e.target as HTMLInputElement | HTMLTextAreaElement)?.value ?? '';
        setLiveInputValue(value);
        if (value.length >= (currentStep.inputMinLength ?? 1)) {
          // Debounce: only advance once typing pauses
          window.clearTimeout(inputTimerRef.current);
          inputTimerRef.current = window.setTimeout(() => advance(), 700);
        }
      }
    };
    if (currentStep.advanceOn === 'click') {
      el.addEventListener('click', handler);
    } else {
      el.addEventListener('input', handler);
    }
    return () => {
      el.removeEventListener('click', handler);
      el.removeEventListener('input', handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.scenario.id, active?.stepIndex, targetVersion]);

  /** Cancel any pending input auto-advance debounce. Called whenever the
   *  user manually moves (next/prev/close) so a stale typing-debounce
   *  timer can't re-advance the step a moment after the user has
   *  navigated away. This was the "Previous doesn't work" bug. */
  const clearAutoAdvance = useCallback(() => {
    window.clearTimeout(inputTimerRef.current);
    inputTimerRef.current = 0;
  }, []);

  const advance = useCallback(() => {
    setActive((prev) => {
      if (!prev) return null;
      const next = prev.stepIndex + 1;
      if (next >= prev.scenario.steps.length) {
        // Finished — clear active, mark done
        markDone(prev.scenario.id);
        return null;
      }
      return { ...prev, stepIndex: next };
    });
  }, []);

  const start = useCallback((id: ScenarioId) => {
    const scenario = getScenario(id);
    if (!scenario) return;
    clearAutoAdvance();
    // Run scenario setup before showing step 0.
    void Promise.resolve(scenario.setup?.()).then(() => {
      setActive({ scenario, stepIndex: 0 });
    });
  }, [clearAutoAdvance]);

  const next = useCallback(() => { clearAutoAdvance(); advance(); }, [advance, clearAutoAdvance]);

  const prev = useCallback(() => {
    clearAutoAdvance();
    setActive((p) => (p && p.stepIndex > 0 ? { ...p, stepIndex: p.stepIndex - 1 } : p));
  }, [clearAutoAdvance]);

  const close = useCallback(() => {
    clearAutoAdvance();
    setActive(null);
  }, [clearAutoAdvance]);

  const dismissNudge = useCallback(() => {
    writeNudgeDismissed();
    setShouldNudge(false);
  }, []);

  const triggerHint = useCallback(() => {
    setHintActive(true);
    window.clearTimeout(hintTimerRef.current);
    hintTimerRef.current = window.setTimeout(() => setHintActive(false), 1600);
  }, []);

  /** Next is live when:
   *  - the step provides its own canAdvance predicate (whatever it
   *    returns), or
   *  - the step's advanceOn is `next` / `click` (manual override is
   *    fine), or
   *  - the step's advanceOn is `input` and the user has typed at
   *    least `inputMinLength` characters.
   *
   *  Stored as state (not memo) because DOM-derived predicates need
   *  polling — the rect-stability optimization keeps `activeRect`
   *  stable when the target element doesn't move, so we can't piggy-
   *  back on it for re-evaluation. A 250 ms poller below recomputes
   *  for steps with a `canAdvance` callback. */
  const [canAdvance, setCanAdvance] = useState<boolean>(false);

  useEffect(() => {
    if (!currentStep) { setCanAdvance(false); return; }
    const compute = (): boolean => {
      if (currentStep.canAdvance) {
        try { return currentStep.canAdvance(); } catch { return false; }
      }
      if (currentStep.advanceOn !== 'input') return true;
      return liveInputValue.length >= (currentStep.inputMinLength ?? 1);
    };
    const apply = () => {
      const ok = compute();
      setCanAdvance((prev) => (prev === ok ? prev : ok));
    };
    apply();
    // Only poll when the step has a DOM-derived predicate. Pure input
    // steps update via `liveInputValue` changing, which already
    // triggers this effect to re-run.
    if (!currentStep.canAdvance) return;
    const id = window.setInterval(apply, 250);
    return () => window.clearInterval(id);
  }, [currentStep, liveInputValue]);

  const value = useMemo<TutorialContextValue>(
    () => ({ active, currentStep, activeRect, start, next, prev, close, shouldNudge, dismissNudge, hintActive, triggerHint, canAdvance }),
    [active, currentStep, activeRect, start, next, prev, close, shouldNudge, dismissNudge, hintActive, triggerHint, canAdvance],
  );

  return <TutorialContext.Provider value={value}>{children}</TutorialContext.Provider>;
}

export function useTutorial(): TutorialContextValue {
  const ctx = useContext(TutorialContext);
  if (!ctx) throw new Error('useTutorial must be used inside <TutorialProvider>');
  return ctx;
}
