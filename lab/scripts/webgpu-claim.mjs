/**
 * lab/scripts/webgpu-claim.mjs — the one definition of what a WebGPU claim in
 * lab/src/fixtures/backend-matrix.json is allowed to say.
 *
 * It lives on its own because three places had an opinion about this and two
 * of them disagreed with the file: verify-lab.mjs required UNAVAILABLE
 * outright, lab/tests/gpu-particles.test.ts accepted a PASS if two prose
 * regexes matched the `source`/`executed` strings, and the matrix itself
 * claimed PASS. A rule stated three times is a rule that drifts, so it is
 * stated here once and imported by both checkers.
 *
 * ADR-010 is unchanged: an unavailable device is never a pass. What changed
 * is that a real device PASS is no longer impossible by definition — it is
 * possible, and it costs evidence. Exactly two shapes are accepted:
 *
 *   UNAVAILABLE + a reason saying why no device execution stands behind it
 *   PASS        + an `evidence` record identifying the run that produced it
 *
 * The evidence fields deliberately identify the run rather than restate its
 * outcome. "GPUDevice=true, compute dispatch=true, render=true" is a sentence
 * anyone can type; a probe path, a command, a host, a browser build, a date
 * and a non-blank artifact of a stated size are things a run leaves behind.
 * `origin` keeps a developer-host observation from being read as a CI result.
 * Every field is required and must be non-empty, so a bare `"status": "PASS"`
 * is refused — which is the whole point of loosening the rule at all.
 */

/** Where an observation came from. A CI result and a laptop are not the same claim. */
export const WEBGPU_EVIDENCE_ORIGINS = ['developer-host', 'ci'];

/** Evidence fields that must be present and non-empty strings. */
export const WEBGPU_EVIDENCE_TEXT_FIELDS = [
  'probe',
  'command',
  'host',
  'browser',
  'artifact',
  'note',
];

/** The probe facts a PASS asserts. Each must be boolean `true`, not the string. */
export const WEBGPU_EVIDENCE_FACTS = ['device', 'dispatch', 'render'];

/**
 * Describe the first thing wrong with a matrix entry's `webgpu` claim.
 *
 * @param {unknown} webgpu the entry's `webgpu` object
 * @returns {string | null} null when the claim is well formed, else the problem
 */
export function webgpuClaimProblem(webgpu) {
  if (!webgpu || typeof webgpu !== 'object' || Array.isArray(webgpu)) {
    return 'the entry carries no webgpu claim';
  }

  if (webgpu.status === 'UNAVAILABLE') {
    const reason = typeof webgpu.reason === 'string' ? webgpu.reason.trim() : '';
    return reason === '' ? 'UNAVAILABLE carries no reason' : null;
  }

  if (webgpu.status !== 'PASS') {
    return `status is ${JSON.stringify(webgpu.status)}; only PASS or UNAVAILABLE is a claim`;
  }

  const evidence = webgpu.evidence;
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) {
    return 'PASS carries no evidence object — a bare PASS is refused';
  }
  for (const field of WEBGPU_EVIDENCE_TEXT_FIELDS) {
    const value = evidence[field];
    if (typeof value !== 'string' || value.trim() === '') {
      return `PASS evidence.${field} is missing or empty`;
    }
  }
  if (!WEBGPU_EVIDENCE_ORIGINS.includes(evidence.origin)) {
    return `PASS evidence.origin must be one of ${WEBGPU_EVIDENCE_ORIGINS.join('/')}, got ${JSON.stringify(evidence.origin)}`;
  }
  if (
    typeof evidence.observedAt !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}(?:T[0-9:.]+Z?)?$/.test(evidence.observedAt)
  ) {
    return `PASS evidence.observedAt must be an ISO date, got ${JSON.stringify(evidence.observedAt)}`;
  }
  // The probe writes a screenshot; a blank or absent capture is not evidence.
  // 1000 bytes is the same non-blank floor the WebGL2 half of this entry uses.
  if (!Number.isInteger(evidence.artifactBytes) || evidence.artifactBytes <= 1000) {
    return `PASS evidence.artifactBytes must be a non-blank capture size (>1000), got ${JSON.stringify(evidence.artifactBytes)}`;
  }
  for (const fact of WEBGPU_EVIDENCE_FACTS) {
    if (evidence[fact] !== true) {
      return `PASS evidence.${fact} must be boolean true, got ${JSON.stringify(evidence[fact])}`;
    }
  }
  if (!Array.isArray(evidence.errors) || evidence.errors.length > 0) {
    return `PASS evidence.errors must be an empty array, got ${JSON.stringify(evidence.errors)}`;
  }
  return null;
}
