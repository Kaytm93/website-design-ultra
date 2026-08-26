'use client'

import { Component, type ReactNode } from 'react'

interface SceneErrorBoundaryProps {
  /** Records the failure (telemetry surface when one exists). */
  onError: (message: string) => void
  children: ReactNode
}

interface SceneErrorBoundaryState {
  failed: boolean
}

/**
 * Catches canvas-scope render failures — WebGL context creation when the
 * browser has no GPU path, model decode errors that escape suspense — so the
 * page around the frame (poster, copy, controls) keeps working. The poster
 * stays visible because readiness never fired; the error is recorded for the
 * telemetry evidence when a surface exists.
 */
export class SceneErrorBoundary extends Component<
  SceneErrorBoundaryProps,
  SceneErrorBoundaryState
> {
  state: SceneErrorBoundaryState = { failed: false }

  static getDerivedStateFromError(): SceneErrorBoundaryState {
    return { failed: true }
  }

  componentDidCatch(error: unknown): void {
    this.props.onError(error instanceof Error ? error.message : String(error))
  }

  render(): ReactNode {
    return this.state.failed ? null : this.props.children
  }
}
