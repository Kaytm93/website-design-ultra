/**
 * compile-error fixture
 *
 * Loads a fragment shader with a deliberate syntax error (undeclared
 * identifier `uResolution`) and displays the resulting WebGL compile
 * diagnostic in the lab-error overlay. The canvas remains visible but
 * does not render the broken shader — this proves that a syntax error
 * returns source/line diagnostics instead of a blank canvas.
 *
 * @module
 */

import type { ExperimentContext } from '../main.js';
import { compileShader, displayError, formatCompileError } from '../compile-error.js';
import vertSrc from './compile-error.vert?raw';
import fragSrc from './compile-error.frag?raw';

export function mount(ctx: ExperimentContext): void {
  const { root, errorEl } = ctx;

  // Create a WebGL2 context for compilation
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 240;
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  canvas.style.background = '#0a0a0c';
  root.appendChild(canvas);

  const gl = canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: false });
  if (!gl) {
    displayError('[WDU] WebGL2 not available — cannot compile fixture shader');
    return;
  }

  // Compile the valid vertex shader
  const vertResult = compileShader(gl, vertSrc, 'vertex');
  if (vertResult.error) {
    displayError(vertResult.error);
    return;
  }

  // Compile the deliberately broken fragment shader
  const fragResult = compileShader(gl, fragSrc, 'fragment');
  if (fragResult.error) {
    // Display the error diagnostic — this is the expected path
    displayError(fragResult.error);
    // Delete the vertex shader since we won't use it
    gl.deleteShader(vertResult.shader);
    // Render a dark placeholder to prove the canvas is not blank
    gl.clearColor(0.04, 0.04, 0.05, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    // Label the canvas that the error was caught
    errorEl.dataset.compileErrorCaught = 'true';
    return;
  }

  // If the fragment shader somehow compiled (shouldn't happen), clean up
  gl.deleteShader(vertResult.shader);
  gl.deleteShader(fragResult.shader);
  displayError('[WDU] Fixture error: broken shader compiled without error — fixture may need updating');
}

export function cleanup(): void {
  // Nothing to clean; the canvas is removed when the root is cleared
}