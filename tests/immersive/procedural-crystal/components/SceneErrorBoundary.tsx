'use client'

import { Component, type ReactNode } from 'react'

/**
 * Outer error boundary that surfaces any rendering or chunk-load failure.
 * ModelErrorBoundary (sibling) is the resource-load-specific catch, wired
 * inside the canvas subtree.
 */
export class SceneErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error) {
    console.error('[wdu-procedural-crystal] scene crashed:', error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div role="alert" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
          <p>The 3D scene crashed.</p>
        </div>
      )
    }
    return this.props.children
  }
}