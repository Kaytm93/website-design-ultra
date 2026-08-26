/**
 * Audio runtime for the sound-present interaction fixture (IP-06B).
 *
 * A zero-dependency capture fixture. It implements the spatial-audio
 * contract as a deterministic state machine recorded on the document root,
 * exactly like the pointer state in the reference starter:
 *
 * - data-wdu-mode: "deterministic" only when the declared capture entry
 *   point (?wdu-deterministic=1) resolved it; the manifest declares the URL.
 * - data-wdu-ready: set after the first stable frame; audio state changes do
 *   not move the page, so they never invalidate it.
 * - data-wdu-audio: locked | enabled | muted — the declared audio state.
 * - data-wdu-audio-context: the real AudioContext.state (the host's autoplay
 *   policy decides whether it starts running; this fixture never assumes it).
 * - data-wdu-audio-restored: "true" when the boot state came from storage,
 *   which is the only way a returning session differs from a fresh one.
 * - data-wdu-voices / data-wdu-voice-attempts / data-wdu-voice-clamped: the
 *   concurrent-voice counters the voice-limit observation reads.
 *
 * The AudioContext is created at load (the graph is built early) and resumed
 * only by the declared unlock gesture. Nothing plays before a gesture, mute
 * persists under the declared key, and concurrent voices are capped at the
 * declared limit.
 */
(() => {
  const root = document.documentElement
  const storageKey = 'wdu:audio'
  const voiceLimit = 4
  const voiceSeconds = 1.2

  const readStorage = () => {
    try {
      return window.localStorage.getItem(storageKey)
    } catch {
      return null
    }
  }

  const deterministic =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).has('wdu-deterministic')
  root.setAttribute('data-wdu-mode', deterministic ? 'deterministic' : 'live')

  // Build the graph early, resume it late (spatial-audio contract).
  const context = new AudioContext()
  const master = context.createGain()
  master.gain.value = 0.7
  master.connect(context.destination)

  let audioState = 'locked'
  let restored = false
  let voices = 0
  let attempts = 0
  let clamped = 0

  const badge = document.getElementById('state-badge')
  const stateLabel = document.getElementById('state-label')
  const contextState = document.getElementById('context-state')

  const render = () => {
    root.setAttribute('data-wdu-audio', audioState)
    root.setAttribute('data-wdu-audio-context', context.state)
    root.setAttribute('data-wdu-voices', String(voices))
    root.setAttribute('data-wdu-voice-attempts', String(attempts))
    root.setAttribute('data-wdu-voice-clamped', String(clamped))
    if (restored) root.setAttribute('data-wdu-audio-restored', 'true')
    else root.removeAttribute('data-wdu-audio-restored')
    if (badge) {
      badge.textContent = audioState
      badge.classList.toggle('muted', audioState === 'muted')
      badge.classList.toggle('locked', audioState === 'locked')
    }
    if (stateLabel) {
      stateLabel.textContent =
        audioState === 'locked'
          ? 'Audio is locked until the unlock gesture.'
          : audioState === 'muted'
            ? 'Audio is muted; the choice persists for the returning session.'
            : 'Audio is enabled after the unlock gesture.'
    }
    if (contextState) contextState.textContent = context.state
    const counters = document.getElementById('counters')
    if (counters) {
      counters.firstChild.textContent = `voices ${voices} · attempts ${attempts} · clamped ${clamped} · context state — `
    }
  }

  const setState = (next) => {
    audioState = next
    render()
  }

  // Boot from stored consent: the returning session is the only path that
  // can produce a restored state.
  const stored = readStorage()
  if (stored === 'muted') {
    restored = true
    setState('muted')
  } else if (stored === 'enabled') {
    restored = true
    setState('enabled')
  } else {
    setState('locked')
  }

  const playVoice = () => {
    attempts += 1
    if (audioState !== 'enabled') {
      render()
      return
    }
    if (voices >= voiceLimit) {
      clamped += 1
      render()
      return
    }
    voices += 1
    render()
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.frequency.value = 220 + (attempts % 5) * 40
    gain.gain.setValueAtTime(0.0001, context.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.4, context.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + voiceSeconds)
    oscillator.connect(gain)
    gain.connect(master)
    oscillator.start()
    oscillator.stop(context.currentTime + voiceSeconds)
    oscillator.addEventListener('ended', () => {
      voices = Math.max(0, voices - 1)
      render()
    })
  }

  document.getElementById('unlock').addEventListener('click', () => {
    if (audioState === 'locked') {
      setState('enabled')
    }
    // A blocked resume is a normal state, never an error: the control stays
    // visible and the experience stays complete without sound.
    void context.resume().catch(() => {})
  })

  document.getElementById('mute').addEventListener('click', () => {
    setState('muted')
    try {
      window.localStorage.setItem(storageKey, 'muted')
    } catch {
      // Storage can be unavailable (privacy mode); the state stays muted for
      // the session, and the persistence evidence reads null honestly.
    }
    void context.suspend().catch(() => {})
  })

  document.getElementById('trigger').addEventListener('click', playVoice)
  document.getElementById('trigger').addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') playVoice()
  })

  context.addEventListener('statechange', render)

  // First stable frame: deterministic mode has no animation, so one rendered
  // frame after load is the stable frame. The marker is the capture gate.
  requestAnimationFrame(() => {
    root.setAttribute('data-wdu-ready', 'true')
  })
})()
