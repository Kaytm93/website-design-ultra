/**
 * Types for the shared WebGPU-claim contract. The module itself is plain JS so
 * that `node scripts/verify-lab.mjs` can import it without a TypeScript step;
 * this declaration is what lets the TypeScript test suite import it too.
 */
export declare const WEBGPU_EVIDENCE_ORIGINS: readonly string[];
export declare const WEBGPU_EVIDENCE_TEXT_FIELDS: readonly string[];
export declare const WEBGPU_EVIDENCE_FACTS: readonly string[];
export declare function webgpuClaimProblem(webgpu: unknown): string | null;
