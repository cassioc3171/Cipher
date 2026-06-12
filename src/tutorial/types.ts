/**
 * Tutorial type definitions.
 *
 * A `TutorialScenario` is a sequence of `TutorialStep`s. Each step
 * highlights one element in the real app UI, shows a tooltip with
 * explanatory copy, and advances either when the user performs an action
 * on the highlighted element (`advanceOn`) or when they press Next.
 *
 * Hybrid progression (per user decision): Next always works; the action
 * advances too. Action-based advancement is preferred where possible
 * because it lets the user actually feel the feature.
 */

export type TutorialAdvance = 'click' | 'input' | 'next';

export type TutorialSide = 'top' | 'right' | 'bottom' | 'left' | 'auto';

export interface TutorialStep {
  /** Stable id used for the i18n bundle path (`tutorial.<scenarioId>.steps.<id>.{title,body}`). */
  id: string;
  /** CSS selector for the element to highlight. Resolved at runtime against
   *  the live DOM each time the step becomes active. If the selector
   *  matches multiple, the first match is used. */
  selector: string;
  /** Where the tooltip prefers to anchor. `auto` lets the layout engine pick. */
  side?: TutorialSide;
  /** What advances this step. `click` = user clicks the target. `input`
   *  = user types into the target. `next` = explanatory step, only the
   *  tooltip Next button advances. */
  advanceOn: TutorialAdvance;
  /** Optional minimum text length for `input` advancement (default: 1). */
  inputMinLength?: number;
  /** Optional predicate. If it returns false at activation time, the step
   *  is skipped (useful when the user already did the action). */
  precondition?: () => boolean;
  /** Optional side-effect run when the step becomes active. Used by step 4
   *  to open the obfuscation popover so the user sees the modes inline. */
  setup?: () => Promise<void> | void;
  /** Optional side-effect run when the step is left (next or prev). Used to
   *  clean up a `setup` that opened something. */
  teardown?: () => Promise<void> | void;
  /** Optional override for whether the Next button is enabled. When set,
   *  bypasses the default rule (next-step always enabled, input-step
   *  needs inputMinLength). The engine re-evaluates this every 250 ms
   *  while the step is active, so DOM-derived predicates (e.g. "a
   *  file is attached") update without explicit notification. */
  canAdvance?: () => boolean;
}

export interface TutorialScenario {
  /** Stable id, used for storage keys + i18n. */
  id: string;
  /** Estimated minutes to complete, shown on the scenario card. */
  estimatedMinutes: number;
  /** Optional setup run once before the first step. */
  setup?: () => Promise<void> | void;
  steps: TutorialStep[];
}
