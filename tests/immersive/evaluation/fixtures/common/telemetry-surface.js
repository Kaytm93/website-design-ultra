/**
 * Shared telemetry surface for the deliberate failing fixtures (IP-07B).
 *
 * Implements the runtime side of the IP-03 surface
 * (window.__WDU_IMMERSIVE_TELEMETRY__) in the exact shape the plugin
 * verifier drives: read()/collect() return a document with the declared
 * three-gate budget and observed values. A fixture injects its defect
 * through window.__WDU_TELEMETRY_OVERRIDES__ (read lazily, so the override
 * script may run before or after this file):
 *
 *   warmGpuSamplesMs    frame-time sample value (default 16.7, on budget)
 *   firstFrameMs        observed first meaningful frame (default 1200)
 *   transferBudgetBytes declared transfer gate target (default 3 MB)
 *   errors              runtime error entries the surface reports
 *
 * The default document is deliberately on-budget and error-free, so a
 * fixture that includes this surface fails ONLY the gate its own defect
 * targets. This is fixture plumbing for the evaluation suite, never a
 * shipped runtime surface.
 */
(function () {
  'use strict'

  function overrides() {
    return window.__WDU_TELEMETRY_OVERRIDES__ ?? {}
  }

  function buildDocument() {
    const o = overrides()
    const sampleMs = o.warmGpuSamplesMs ?? 16.7
    const windowSize = 120
    const samples = Array.from({ length: windowSize }, () => ({
      value: sampleMs,
      unit: 'ms',
    }))
    const firstFrameMs = o.firstFrameMs ?? 1200
    const transferBudgetBytes = o.transferBudgetBytes ?? 3000000
    const errors = Array.isArray(o.errors) ? o.errors : []
    return {
      schemaVersion: 1,
      surface: 'wdu.immersive-telemetry',
      deviceProfile: {
        id: 'wdu-evaluation-static-desktop',
        class: 'desktop',
        browser: 'chromium',
        browserVersion: 'declared',
        renderer: 'webgl2',
        viewport: {
          width: { value: 1440, unit: 'css-px' },
          height: { value: 1000, unit: 'css-px' },
        },
        deviceScaleFactor: { value: 1, unit: 'ratio' },
        network: 'offline',
      },
      budget: {
        frameTarget: {
          rate: { value: 60, unit: 'fps' },
          frameTime: { value: 16.7, unit: 'ms' },
          justification:
            'declared by the deliberate evaluation fixture; mirrors the product-hero budget so only the injected defect differs.',
        },
        gates: [
          {
            class: 'warm-gpu-frame-time',
            comparison: 'less-than-or-equal',
            targets: {
              median: { value: 16.7, unit: 'ms' },
              p95: { value: 16.7, unit: 'ms' },
            },
            warmup: { value: 60, unit: 'frames' },
            sampleWindow: { value: 120, unit: 'frames' },
            justification:
              'mirrors the product-hero 60 Hz desktop target; a static fixture reports its declared fixed step.',
          },
          {
            class: 'first-meaningful-frame',
            comparison: 'less-than-or-equal',
            marker: 'html[data-wdu-ready="true"]',
            target: { value: 5000, unit: 'ms' },
            justification:
              'a static page has no network load; 5 s bounds a cold desktop load.',
          },
          {
            class: 'transfer-before-first-meaningful-frame',
            comparison: 'less-than-or-equal',
            boundary: 'first-meaningful-frame',
            target: { value: transferBudgetBytes, unit: 'bytes' },
            justification:
              'declared by the fixture; the deliberate failing variant sets an unreachable target to prove the gate fails.',
          },
        ],
      },
      runtime: {
        frame: {
          warmGpu: {
            samples,
            median: { value: sampleMs, unit: 'ms' },
            p95: { value: sampleMs, unit: 'ms' },
          },
          firstMeaningfulFrame: {
            marker: 'html[data-wdu-ready="true"]',
            observed: { value: firstFrameMs, unit: 'ms' },
          },
          transfer: {
            boundary: 'first-meaningful-frame',
            observed: { value: 0, unit: 'bytes' },
          },
          longFrameCount: { value: 0, unit: 'count' },
        },
        renderer: {
          api: 'webgl2',
          counters: {
            drawCalls: { value: 2, unit: 'count' },
            visibleTriangles: { value: 3122, unit: 'count' },
            textures: { value: 2, unit: 'count' },
            geometries: { value: 1, unit: 'count' },
            programs: { value: 1, unit: 'count' },
          },
        },
        quality: { tier: 'high', dpr: { value: 1, unit: 'ratio' } },
        errors,
        contextLoss: { count: { value: 0, unit: 'count' }, events: [] },
      },
    }
  }

  window.__WDU_IMMERSIVE_TELEMETRY__ = {
    read: () => buildDocument(),
    collect: async () => ({ document: buildDocument(), rendererInfo: null }),
    rendererInfo: () => null,
  }
})()
