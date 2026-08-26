import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const LAB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE_FRAG = resolve(LAB_ROOT, 'src/fixtures/compile-error.frag');

// ── Mock WebGL2 context for deterministic offline testing ───────────────────
// Simulates shader compilation: a shader fails if its source contains a
// reference to an undeclared identifier (the real error the fixture uses).
// The error log follows the documented GLSL ERROR format so the parser can
// extract line numbers.

const GL_VERTEX_SHADER = 0x8b31;
const GL_FRAGMENT_SHADER = 0x8b30;
const GL_COMPILE_STATUS = 0x8b81;
const GL_LINK_STATUS = 0x8b82;

interface MockShader {
  id: number;
  type: number;
  source: string;
  compiled: boolean;
  log: string;
  deleted: boolean;
}

interface MockProgram {
  id: number;
  shaders: MockShader[];
  linked: boolean;
  log: string;
  deleted: boolean;
}

let nextId = 1;

function createMockGl() {
  const shaders: MockShader[] = [];
  const programs: MockProgram[] = [];

  /**
   * Simple deterministic GLSL validator: check if the source references
   * any identifier that is used but never declared. For the fixture, the
   * specific error is `uResolution` used without declaration. A robust
   * mock would parse declarations; this one uses a self-describing marker:
   * if the source contains `uResolution` and does NOT contain
   * `uniform vec2 uResolution`, the shader fails.
   */
  function diagnoseShaderSource(source: string, type: number): { ok: boolean; log: string } {
    // Check for known fixtures
    if (source.includes('uResolution') && !source.includes('uniform vec2 uResolution')) {
      // Find the line number
      const lines = source.split('\n');
      let errorLine = 1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('uResolution')) {
          errorLine = i + 1;
          break;
        }
      }
      return {
        ok: false,
        log: `ERROR: 0:${errorLine}: 'uResolution' : undeclared identifier`,
      };
    }
    return { ok: true, log: '' };
  }

  return {
    VERTEX_SHADER: GL_VERTEX_SHADER as number,
    FRAGMENT_SHADER: GL_FRAGMENT_SHADER as number,
    COMPILE_STATUS: GL_COMPILE_STATUS as number,
    LINK_STATUS: GL_LINK_STATUS as number,

    createShader(type: number): MockShader {
      const shader: MockShader = {
        id: nextId++,
        type,
        source: '',
        compiled: false,
        log: '',
        deleted: false,
      };
      shaders.push(shader);
      return shader;
    },
    shaderSource(shader: MockShader, source: string): void {
      shader.source = source;
    },
    compileShader(shader: MockShader): void {
      const result = diagnoseShaderSource(shader.source, shader.type);
      shader.compiled = result.ok;
      shader.log = result.log;
    },
    getShaderParameter(shader: MockShader, pname: number): boolean {
      if (pname === GL_COMPILE_STATUS) return shader.compiled;
      return false;
    },
    getShaderInfoLog(shader: MockShader): string {
      return shader.log;
    },
    deleteShader(shader: MockShader): void {
      shader.deleted = true;
    },
    createProgram(): MockProgram {
      const program: MockProgram = {
        id: nextId++,
        shaders: [],
        linked: false,
        log: '',
        deleted: false,
      };
      programs.push(program);
      return program;
    },
    attachShader(program: MockProgram, shader: MockShader): void {
      program.shaders.push(shader);
    },
    linkProgram(program: MockProgram): void {
      const allCompiled = program.shaders.every((s) => s.compiled);
      program.linked = allCompiled;
      program.log = allCompiled ? '' : 'Program link failed: shader compilation errors';
    },
    getProgramParameter(program: MockProgram, pname: number): boolean {
      if (pname === GL_LINK_STATUS) return program.linked;
      return false;
    },
    getProgramInfoLog(program: MockProgram): string {
      return program.log;
    },
    deleteProgram(program: MockProgram): void {
      program.deleted = true;
    },
  };
}

// ── Import the compile-error module (re-exports, no DOM side effects) ───────
const compileErrorModule = await import('../../lab/src/compile-error.ts');
const { compileShader, linkProgram, formatCompileError, displayError, clearError } = compileErrorModule;

test('compileShader returns error with line info for a broken shader', () => {
  const gl = createMockGl();

  const brokenSource = `#version 300 es
precision highp float;
uniform float uTime;
out vec4 fragColor;
void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  vec3 col = 0.5 + 0.5 * cos(uTime + uv.xyx);
  fragColor = vec4(col, 1.0);
}`;

  const result = compileShader(gl as unknown as WebGL2RenderingContext, brokenSource, 'fragment');

  assert.equal(result.shader, null, 'shader must be null on failure');
  assert.notEqual(result.error, null, 'error must be returned on failure');
  assert.equal(result.error!.type, 'fragment');
  assert.equal(result.error!.line, 6, 'line must point to the uResolution reference');
  assert.ok(result.error!.log.includes('uResolution'), 'log must mention the undeclared identifier');
});

test('compileShader returns shader for valid source', () => {
  const gl = createMockGl();

  const validSource = `#version 300 es
precision highp float;
in vec3 position;
void main() {
  gl_Position = vec4(position, 1.0);
}`;

  const result = compileShader(gl as unknown as WebGL2RenderingContext, validSource, 'vertex');

  assert.notEqual(result.shader, null, 'shader must be returned on success');
  assert.equal(result.error, null, 'error must be null on success');
  assert.equal((result.shader as unknown as MockShader).compiled, true, 'shader must be compiled');
});

test('linkProgram succeeds when both shaders compile', () => {
  const gl = createMockGl();

  const vertResult = compileShader(
    gl as unknown as WebGL2RenderingContext,
    `#version 300 es\nprecision highp float;\nin vec3 position;\nvoid main() { gl_Position = vec4(position, 1.0); }`,
    'vertex',
  );
  const fragResult = compileShader(
    gl as unknown as WebGL2RenderingContext,
    `#version 300 es\nprecision highp float;\nuniform float uTime;\nuniform vec2 uResolution;\nout vec4 fragColor;\nvoid main() { vec2 uv = gl_FragCoord.xy / uResolution; fragColor = vec4(uv, 0.0, 1.0); }`,
    'fragment',
  );

  assert.notEqual(vertResult.shader, null);
  assert.notEqual(fragResult.shader, null);

  const linkResult = linkProgram(
    gl as unknown as WebGL2RenderingContext,
    vertResult.shader!,
    fragResult.shader!,
  );

  assert.notEqual(linkResult.program, null, 'program must link on success');
  assert.equal(linkResult.error, null, 'no error on successful link');
});

test('formatCompileError includes source context and line marker', () => {
  const error = {
    type: 'fragment' as const,
    log: 'ERROR: 0:7: \'uResolution\' : undeclared identifier',
    line: 7,
    source: `#version 300 es
precision highp float;
uniform float uTime;
out vec4 fragColor;
void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  vec3 col = 0.5 + 0.5 * cos(uTime + uv.xyx);
  fragColor = vec4(col, 1.0);
}`,
  };

  const formatted = formatCompileError(error);

  assert.ok(formatted.includes('FRAGMENT'), 'must include shader type');
  assert.ok(formatted.includes('line 7'), 'must include line number');
  assert.ok(formatted.includes('uResolution'), 'must include the error log');
  assert.ok(formatted.includes('>'), 'must include the line marker');
  assert.ok(formatted.includes('|'), 'must include source context lines');
});

test('the fixture compile-error.frag contains the deliberate undeclared identifier', () => {
  assert.ok(existsSync(FIXTURE_FRAG), `fixture file must exist: ${FIXTURE_FRAG}`);

  const source = readFileSync(FIXTURE_FRAG, 'utf8');
  assert.ok(source.includes('uResolution'), 'fixture must reference the undeclared identifier');
  assert.ok(
    !source.includes('uniform vec2 uResolution'),
    'fixture must NOT declare uResolution',
  );
});

test('displayError and clearError manipulate a minimal DOM mock', () => {
  // Set up a minimal DOM mock
  const fakeEl = {
    textContent: 'initial',
    classList: {
      _classes: new Set<string>(),
      add(name: string) {
        this._classes.add(name);
      },
      remove(name: string) {
        this._classes.delete(name);
      },
      contains(name: string) {
        return this._classes.has(name);
      },
    },
  };
  (globalThis as any).document = {
    getElementById() {
      return fakeEl;
    },
  };

  const error = {
    type: 'fragment' as const,
    log: 'ERROR: 0:7: ...',
    line: 7,
  };

  displayError(error);
  assert.ok(fakeEl.classList.contains('visible'), 'error overlay must become visible');
  assert.ok(fakeEl.textContent!.includes('FRAGMENT'), 'error text must include shader type');

  clearError();
  assert.ok(!fakeEl.classList.contains('visible'), 'error overlay must be hidden after clear');
  assert.equal(fakeEl.textContent, '', 'error text must be cleared');

  delete (globalThis as any).document;
});