/**
 * The five things React was doing for the R3F starter, wired by hand.
 *
 * `r3f-patterns/references/vanilla-three.md` names them: a `matchMedia`
 * listener, a DOM layer outside the canvas that becomes visible on context
 * loss, an `IntersectionObserver`, a `document.hidden` pause, and disposal on
 * teardown. Without a framework nothing supplies these, and a copied demo that
 * omits them is exactly the failure the contract exists to prevent — so they
 * live in one module with one `dispose()` rather than scattered across scene
 * code where a copy can drop one silently.
 *
 * Every browser API this module needs is injected. That is not ceremony: it is
 * what lets `tests/lifecycle.test.mjs` assert the pause and resume transitions
 * in Node, with no browser and no WebGL context.
 */

export type RunState = 'running' | 'paused'

export interface PauseReason {
  readonly hidden: boolean
  readonly offscreen: boolean
  readonly contextLost: boolean
}

export interface MediaQueryLike {
  readonly matches: boolean
  addEventListener(type: 'change', listener: (event: { matches: boolean }) => void): void
  removeEventListener(type: 'change', listener: (event: { matches: boolean }) => void): void
}

export interface LifecycleHost {
  /** Called whenever the run state changes, never on an unchanged state. */
  onRunStateChange(state: RunState, reason: PauseReason): void
  /** Called when the reduced-motion media query flips. */
  onReducedMotionChange(reduced: boolean): void
  /** Called when the context is lost or restored, so the DOM layer can show. */
  onContextChange(lost: boolean): void
}

export interface LifecycleOptions {
  readonly host: LifecycleHost
  readonly reducedMotionQuery: MediaQueryLike
  /** Injected so tests drive it; in the browser this is `document`. */
  readonly visibility: {
    readonly hidden: boolean
    addEventListener(type: 'visibilitychange', listener: () => void): void
    removeEventListener(type: 'visibilitychange', listener: () => void): void
  }
}

export interface Lifecycle {
  readonly runState: RunState
  readonly reducedMotion: boolean
  readonly contextLost: boolean
  /** Report the canvas entering or leaving the viewport. */
  setOffscreen(offscreen: boolean): void
  /** Report a WebGL context loss or restore. */
  setContextLost(lost: boolean): void
  /** Re-read the injected visibility source. */
  syncVisibility(): void
  dispose(): void
}

/**
 * A scene may run only when it is visible, on screen, and holding a context.
 * Three independent reasons, one run state: any one of them pauses, and only
 * their absence resumes. Tracking them as one boolean is the bug this shape
 * prevents — a scene that came back from `document.hidden` while still
 * scrolled out of view would resume and burn frames nobody sees.
 */
export function createLifecycle(options: LifecycleOptions): Lifecycle {
  const { host, reducedMotionQuery, visibility } = options

  let hidden = visibility.hidden
  let offscreen = false
  let contextLost = false
  let reducedMotion = reducedMotionQuery.matches
  let runState: RunState = 'running'
  let disposed = false

  const reason = (): PauseReason => ({ hidden, offscreen, contextLost })

  const settle = () => {
    const next: RunState = hidden || offscreen || contextLost ? 'paused' : 'running'
    if (next === runState) return
    runState = next
    host.onRunStateChange(runState, reason())
  }

  const onVisibility = () => {
    hidden = visibility.hidden
    settle()
  }

  const onMotion = (event: { matches: boolean }) => {
    if (event.matches === reducedMotion) return
    reducedMotion = event.matches
    host.onReducedMotionChange(reducedMotion)
  }

  visibility.addEventListener('visibilitychange', onVisibility)
  reducedMotionQuery.addEventListener('change', onMotion)
  settle()

  return {
    get runState() {
      return runState
    },
    get reducedMotion() {
      return reducedMotion
    },
    get contextLost() {
      return contextLost
    },
    setOffscreen(next: boolean) {
      if (disposed || next === offscreen) return
      offscreen = next
      settle()
    },
    setContextLost(lost: boolean) {
      if (disposed || lost === contextLost) return
      contextLost = lost
      host.onContextChange(lost)
      settle()
    },
    syncVisibility: onVisibility,
    dispose() {
      if (disposed) return
      disposed = true
      visibility.removeEventListener('visibilitychange', onVisibility)
      reducedMotionQuery.removeEventListener('change', onMotion)
    },
  }
}
