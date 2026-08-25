'use client'

import type { MotionPreference, RuntimeMode } from '../lib/runtime-config.ts'

interface MotionControlProps {
  mode: RuntimeMode
  motion: MotionPreference
  onChange: (motion: MotionPreference) => void
}

/**
 * The visible motion control, in the DOM outside the canvas (IP-05C). Reduced
 * motion holds the hero's seeded static pose — the strongest static shot, per
 * 3d-art-direction — while full motion rotates it from the injected clock.
 * The choice is persisted, so an explicit user setting is preserved across
 * sessions. In deterministic mode the control is locked: WDU_REDUCED_MOTION is
 * the capture contract and input must not move it.
 */
export function MotionControl({ mode, motion, onChange }: MotionControlProps) {
  const locked = mode === 'deterministic'

  return (
    <fieldset className="motion-control" disabled={locked}>
      <legend>Motion</legend>
      <div className="motion-options">
        <button
          type="button"
          aria-pressed={motion === 'full'}
          onClick={() => onChange('full')}
        >
          Full
        </button>
        <button
          type="button"
          aria-pressed={motion === 'reduced'}
          onClick={() => onChange('reduced')}
        >
          Reduced
        </button>
      </div>
      <p className="motion-note">
        {locked
          ? 'Deterministic mode: the reduced-motion capture state is locked.'
          : motion === 'reduced'
            ? 'Reduced motion: the hero holds its seeded static pose; copy, controls, and quality stay available.'
            : 'Full motion: the hero rotates from the injected clock.'}
      </p>
    </fieldset>
  )
}
