'use client'

import { Component, type ReactNode } from 'react'
import type { ImmersiveTelemetrySurface } from '../lib/telemetry-surface.ts'

interface Props {
  telemetry: ImmersiveTelemetrySurface
  children: ReactNode
}

/**
 * GLB / decoder load failures are recorded on the telemetry surface and
 * re-thrown so SceneErrorBoundary can replace the canvas with the poster.
 * This is the resource-failure path the verifier expects to see FAIL on.
 */
export class ModelErrorBoundary extends Component<Props, { hasError: boolean }> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error) {
    this.props.telemetry.recordError('resource-load', error.message, '/model/procedural-crystal.glb')
  }

  render() {
    if (this.state.hasError) {
      return (
        <div role="alert" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
          <p>The crystal failed to load.</p>
        </div>
      )
    }
    return this.props.children
  }
}