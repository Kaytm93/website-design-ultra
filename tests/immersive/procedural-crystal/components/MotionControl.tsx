'use client'

import { useId } from 'react'
import type { MotionPreference, RuntimeMode } from '../lib/runtime-config.ts'

interface Props {
  mode: RuntimeMode
  motion: MotionPreference
  onChange: (next: MotionPreference) => void
}

/**
 * DOM motion control. Pressed-state button group with aria-pressed; disabled
 * in deterministic mode so WDU_REDUCED_MOTION stays the capture contract.
 */
export function MotionControl({ mode, motion, onChange }: Props) {
  const groupId = useId()
  const locked = mode === 'deterministic'
  return (
    <div role="group" aria-labelledby={`${groupId}-label`}>
      <span id={`${groupId}-label`}>Motion</span>
      <button
        type="button"
        aria-pressed={motion === 'full'}
        disabled={locked}
        onClick={() => onChange('full')}
      >Full</button>
      <button
        type="button"
        aria-pressed={motion === 'reduced'}
        disabled={locked}
        onClick={() => onChange('reduced')}
      >Reduced</button>
    </div>
  )
}