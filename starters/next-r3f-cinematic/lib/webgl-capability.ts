/** Probe before mounting R3F, whose asynchronous renderer construction can reject. */
export function supportsWebGL2(createCanvas: () => HTMLCanvasElement): boolean {
  try {
    const gl = createCanvas().getContext('webgl2')
    if (!gl) return false
    const supported = !gl.isContextLost()
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return supported
  } catch {
    return false
  }
}
