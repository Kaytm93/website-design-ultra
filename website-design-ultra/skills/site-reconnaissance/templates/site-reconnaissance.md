# Site Reconnaissance Ledger

Copy this file into a project evidence directory and create the companion JSON
ledger with the same fields. Keep the URL public and credential-free. Replace
`unknown` only when a captured artifact supports the value; a screenshot cannot
activate this method or support a runtime field by itself.

```yaml
schemaVersion: wdu-site-reconnaissance/v1
status: PASS
activation:
  sourceUrl: https://example.com/public-3d-reference
  explicitRuntimeRequest: true
  publicAccess: true
  screenshotOnly: false
  evidenceFamilies: [bundle, network, renderer-info, inspector, shader]
runtime:
  browser: PASS
  gpu: PASS
  inspector: PASS
  shaderCapture: PASS
evidence:
  - id: bundle-main
    kind: bundle
    format: json
    file: evidence/bundle.json
    sha256: unknown
    locator: document scripts and chunks
  - id: network-first-frame
    kind: network
    format: json
    file: evidence/network.json
    sha256: unknown
    locator: request log through first stable frame
  - id: renderer-info
    kind: renderer-info
    format: json
    file: evidence/renderer-info.json
    sha256: unknown
    locator: renderer.info after warm-up
  - id: inspector-scene
    kind: inspector
    format: json
    file: evidence/inspector.json
    sha256: unknown
    locator: scene graph, camera, materials, programs
  - id: shader-program
    kind: shader
    format: text
    file: evidence/shaders.txt
    sha256: unknown
    locator: linked vertex and fragment program source

ledger:
  - id: bundle.entrypoints
    value: unknown
    evidence:
      - artifact: bundle-main
        locator: $.entrypoints
        excerpt: unknown
    observation: unknown
  - id: bundle.framework
    value: unknown
    evidence:
      - artifact: bundle-main
        locator: $.runtime.framework
        excerpt: unknown
    observation: unknown
  - id: network.document
    value: unknown
    evidence:
      - artifact: network-first-frame
        locator: $.requests[0]
        excerpt: unknown
    observation: unknown
  - id: network.first-frame-assets
    value: unknown
    evidence:
      - artifact: network-first-frame
        locator: $.requests
        excerpt: unknown
    observation: unknown
  - id: renderer.type
    value: unknown
    evidence:
      - artifact: renderer-info
        locator: $.renderer.type
        excerpt: unknown
    observation: unknown
  - id: renderer.info.calls
    value: unknown
    evidence:
      - artifact: renderer-info
        locator: $.rendererInfo.render.calls
        excerpt: unknown
    observation: unknown
  - id: renderer.info.triangles
    value: unknown
    evidence:
      - artifact: renderer-info
        locator: $.rendererInfo.render.triangles
        excerpt: unknown
    observation: unknown
  - id: inspector.scene
    value: unknown
    evidence:
      - artifact: inspector-scene
        locator: $.scene
        excerpt: unknown
    observation: unknown
  - id: inspector.camera
    value: unknown
    evidence:
      - artifact: inspector-scene
        locator: $.camera
        excerpt: unknown
    observation: unknown
  - id: inspector.materials
    value: unknown
    evidence:
      - artifact: inspector-scene
        locator: $.materials
        excerpt: unknown
    observation: unknown
  - id: shader.vertex
    value: unknown
    evidence:
      - artifact: shader-program
        locator: vertexShader
        excerpt: unknown
    observation: unknown
  - id: shader.fragment
    value: unknown
    evidence:
      - artifact: shader-program
        locator: fragmentShader
        excerpt: unknown
    observation: unknown
  - id: shader.uniforms
    value: unknown
    evidence:
      - artifact: shader-program
        locator: uniforms
        excerpt: unknown
    observation: unknown

contradictions: []
openQuestions: []
```

`status: PASS` is valid only when the runtime statuses are available and every
required family has captured evidence. Use `UNAVAILABLE` for a missing browser,
GPU, Inspector, or shader tool; do not convert it to a screenshot-only result.
