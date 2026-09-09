/** One cancellable frame owner; invalidation also works for still scenes. */
export function createFrameLoop(options: {
  request: (callback: FrameRequestCallback) => number
  cancel: (id: number) => void
  render: () => void
  continuous: () => boolean
  onPause?: () => void
  onResume?: () => void
}) {
  let pending: number | null = null
  let paused = true
  let disposed = false
  const request = () => {
    if (disposed || paused || pending !== null) return
    pending = options.request(() => {
      pending = null
      if (disposed || paused) return
      options.render()
      if (options.continuous()) request()
    })
  }
  const stop = () => {
    if (pending !== null) options.cancel(pending)
    pending = null
  }
  return {
    invalidate: request,
    setPaused(next: boolean) {
      if (disposed || next === paused) return
      paused = next
      if (paused) {
        stop()
        options.onPause?.()
      } else {
        options.onResume?.()
        request()
      }
    },
    dispose() {
      if (disposed) return
      disposed = true
      stop()
      options.onPause?.()
    },
  }
}
