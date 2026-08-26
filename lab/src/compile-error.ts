/**
 * Lab compile-error capture, formatting, and display.
 *
 * Every experiment routes WebGL shader compilation errors through these
 * functions so that a syntax error returns source/line diagnostics instead
 * of a blank canvas.
 *
 * @module
 */

export interface CompileError {
  readonly type: 'vertex' | 'fragment' | 'program';
  readonly source?: string;
  readonly log: string;
  readonly line?: number;
  readonly column?: number;
}

/**
 * Attempt to compile a shader and return a structured error on failure.
 * The shader is deleted on failure; on success the caller owns the shader.
 */
export function compileShader(
  gl: WebGL2RenderingContext,
  source: string,
  type: 'vertex' | 'fragment',
): { shader: WebGLShader; error: null } | { shader: null; error: CompileError } {
  const glType = type === 'vertex' ? gl.VERTEX_SHADER : gl.FRAGMENT_SHADER;
  const shader = gl.createShader(glType)!;

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  const status = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  if (status) {
    return { shader, error: null };
  }

  const log = gl.getShaderInfoLog(shader) || 'Unknown compile error';
  gl.deleteShader(shader);

  const error = parseCompileError(type, log, source);
  return { shader: null, error };
}

/**
 * Link a program from already-compiled shaders and return a structured
 * error on failure. The program is deleted on failure.
 */
export function linkProgram(
  gl: WebGL2RenderingContext,
  vertShader: WebGLShader,
  fragShader: WebGLShader,
): { program: WebGLProgram; error: null } | { program: null; error: CompileError } {
  const program = gl.createProgram()!;
  gl.attachShader(program, vertShader);
  gl.attachShader(program, fragShader);
  gl.linkProgram(program);

  const status = gl.getProgramParameter(program, gl.LINK_STATUS);
  if (status) {
    return { program, error: null };
  }

  const log = gl.getProgramInfoLog(program) || 'Unknown link error';
  gl.deleteProgram(program);
  return { program: null, error: { type: 'program', log: log.trim() } };
}

function parseCompileError(
  type: 'vertex' | 'fragment',
  log: string,
  source?: string,
): CompileError {
  const trimmed = log.trim();
  let line: number | undefined;
  let column: number | undefined;

  // GLSL errors: "ERROR: 0:LINE: message" or "ERROR: 0:LINE(COL): message"
  const lineMatch = trimmed.match(/ERROR:\s*\d+:(\d+)(?:\((\d+)\))?/);
  if (lineMatch) {
    line = parseInt(lineMatch[1], 10);
    if (lineMatch[2]) column = parseInt(lineMatch[2], 10);
  }

  return { type, source, log: trimmed, line, column };
}

/**
 * Format a CompileError as a human-readable diagnostic string with source
 * context lines around the error location.
 */
export function formatCompileError(error: CompileError): string {
  const lines: string[] = [];
  lines.push(`[WDU] ${error.type.toUpperCase()} SHADER COMPILE ERROR`);
  if (error.line !== undefined) {
    lines.push(`  at line ${error.line}${error.column !== undefined ? `, col ${error.column}` : ''}`);
  }
  lines.push(`  ${error.log}`);

  if (error.source && error.line !== undefined) {
    const srcLines = error.source.split('\n');
    const start = Math.max(0, error.line - 3);
    const end = Math.min(srcLines.length, error.line + 2);
    const pad = String(end).length;
    for (let i = start; i < end; i++) {
      const marker = i + 1 === error.line ? '>' : ' ';
      lines.push(`  ${marker} ${String(i + 1).padStart(pad)} | ${srcLines[i]}`);
    }
  }

  return lines.join('\n');
}

/**
 * Display a CompileError or a plain string in the lab-error overlay.
 */
export function displayError(diagnostic: CompileError | string): void {
  const el = document.getElementById('lab-error');
  if (!el) return;
  const text = typeof diagnostic === 'string' ? diagnostic : formatCompileError(diagnostic);
  el.textContent = text;
  el.classList.add('visible');
}

/**
 * Clear the error overlay.
 */
export function clearError(): void {
  const el = document.getElementById('lab-error');
  if (!el) return;
  el.classList.remove('visible');
  el.textContent = '';
}