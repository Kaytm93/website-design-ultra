'use client'

import { Component, type ReactNode } from 'react'
import { useSceneRuntime } from './SceneRuntime.tsx'
import { MODEL_ASSET_URL } from '../lib/scene-config.ts'

interface ModelErrorBoundaryProps {
  children: ReactNode
}

interface ModelErrorBoundaryState {
  failed: boolean
}

/**
 * Catches model decode/render failures inside the scene (the GLTFLoader
 * rejection surfaces here through suspense). The failure is recorded on the
 * shared telemetry surface as a resource-load error — the T0.2 failed-resource
 * evidence — and the boundary renders nothing, so the poster (which stayed
 * visible because readiness never fired) remains the composed fallback. The
 * scene runtime, camera, and quality layer stay alive.
 */
class ModelErrorBoundaryInner extends Component<
  ModelErrorBoundaryProps & { onError: (message: string) => void },
  ModelErrorBoundaryState
> {
  state: ModelErrorBoundaryState = { failed: false }

  static getDerivedStateFromError(): ModelErrorBoundaryState {
    return { failed: true }
  }

  componentDidCatch(error: unknown): void {
    this.props.onError(error instanceof Error ? error.message : String(error))
  }

  render(): ReactNode {
    return this.state.failed ? null : this.props.children
  }
}

export function ModelErrorBoundary({ children }: ModelErrorBoundaryProps) {
  const { telemetry } = useSceneRuntime()
  return (
    <ModelErrorBoundaryInner
      onError={(message) =>
        telemetry.recordError('resource-load', message, MODEL_ASSET_URL)
      }
    >
      {children}
    </ModelErrorBoundaryInner>
  )
}
