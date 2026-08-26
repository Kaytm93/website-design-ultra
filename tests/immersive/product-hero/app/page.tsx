import { SceneClient } from '../components/SceneClient'
import { getCameraStation } from '../lib/determinism-runtime'
import { CAMERA_STATIONS } from '../lib/camera-stations'
import { resolveRuntimeMode } from '../lib/runtime-config'

/**
 * The capture entry point. This page resolves WDU_DETERMINISTIC,
 * WDU_STATION, and WDU_REDUCED_MOTION per request at the application boundary
 * and injects the resolved mode and station into the scene runtime.
 * It is force-dynamic so the mode is never baked into a static page at build
 * time; the copy below is still server-rendered into the initial HTML on
 * every request.
 */
export const dynamic = 'force-dynamic'

export default function Page() {
  const { mode, stationId, motion } = resolveRuntimeMode()
  // Fail explicitly before scene initialization when the requested station id
  // is unknown. Never fall back to the first station.
  getCameraStation(CAMERA_STATIONS, stationId)

  return (
    <main>
      <header className="site-header">
        <a className="skip-link" href="#scene-heading">
          Skip to the scene
        </a>
        <img
          src="/brand-mark.svg"
          alt=""
          width="28"
          height="28"
          className="brand-mark"
        />
        <span>Orbit One</span>
      </header>

      <section className="hero" aria-labelledby="page-title">
        <p className="kicker">wdu-product-hero · immersive evaluation fixture</p>
        <h1 id="page-title">
          Orbit One: a 380 g speaker that plays 14 hours on one charge.
        </h1>
        <p className="lead">
          This fixture evaluates the shared immersive contracts on one
          optimized model. Next.js renders this copy as HTML; the client-only
          canvas leaf loads a single meshopt-compressed GLB declared in the
          asset manifest and renders it under the injected clock, the one
          camera owner, and the copied quality controller. The runtime fetches
          nothing that the manifest does not declare, so a fresh checkout
          installs and builds offline, and the page loads without further
          fetches.
        </p>
      </section>

      <section aria-labelledby="layout-heading">
        <h2 id="layout-heading">What stays where</h2>
        <dl className="contract-list">
          <div>
            <dt>Server-rendered page</dt>
            <dd>
              This copy and the motion control ship in the initial HTML. The
              canvas mounts only in the browser.
            </dd>
          </div>
          <div>
            <dt>One optimized model</dt>
            <dd>
              public/model/orbit-one.glb is the output of the documented
              inspect/validate/optimize pipeline (scripts/build-model.mjs),
              meshopt-compressed with three's bundled JS decoder, and
              validated by gltf-transform. The ready marker gates on its load,
              so readiness proves the model rendered.
            </dd>
          </div>
          <div>
            <dt>One camera owner</dt>
            <dd>
              CameraRig applies the selected camera station before every
              render. No other component writes camera position, target, or
              field of view.
            </dd>
          </div>
          <div>
            <dt>One clock</dt>
            <dd>
              Every animation reads the injected SceneClock. Deterministic
              mode advances a fixed 1/60 s step per rendered frame.
            </dd>
          </div>
          <div>
            <dt>One asset manifest</dt>
            <dd>
              lib/asset-manifest.json lists every runtime asset: the brand
              mark, the two poster variants, and the model.
            </dd>
          </div>
          <div>
            <dt>Wired determinism</dt>
            <dd>
              WDU_DETERMINISTIC=1 freezes the clock, seeds every named random
              stream, applies the requested camera station, and sets
              html[data-wdu-ready="true"] only after the stable frame renders,
              then freezes the loop so captures are byte-identical.
            </dd>
          </div>
          <div>
            <dt>Art-directed poster</dt>
            <dd>
              Two composed SVG variants, desktop and portrait, mirror the live
              composition: the Orbit One on its base, the same palette, the
              same accent light. The poster is the fallback behind loading,
              the poster quality tier, missing WebGL, and context loss: never
              a blank frame.
            </dd>
          </div>
          <div>
            <dt>Reduced motion</dt>
            <dd>
              The motion control in the DOM switches between the full rotation
              and the seeded static pose. WDU_REDUCED_MOTION=1 locks the same
              state for capture; the static shot keeps the subject, the
              controls, and the quality layer usable.
            </dd>
          </div>
          <div>
            <dt>Portrait reframe</dt>
            <dd>
              A named hero-portrait station reframes the product for tall
              viewports. Live mode selects it by orientation; deterministic
              capture requests it by id (WDU_STATION=hero-portrait).
            </dd>
          </div>
          <div>
            <dt>Quality and telemetry surfaces</dt>
            <dd>
              The copied quality controller owns Poster/Low/Medium/High and
              DPR; the telemetry surface exposes the IP-03 document on
              window.__WDU_IMMERSIVE_TELEMETRY__, and the plugin verifier
              reads the same three budget gates the controller reports.
            </dd>
          </div>
          <div>
            <dt>Context-loss recovery</dt>
            <dd>
              When the WebGL context is lost, the poster and a restore action
              appear over the frame; the action mounts a fresh canvas.
            </dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="scene-heading">
        <h2 id="scene-heading">The scene</h2>
        <p>
          The subject is the Orbit One speaker model: a lathe body, a grille
          band, a copper control ring, an LED, and a base. Five authored
          materials merge to two in the pipeline, with 3,122 visible triangles
          and two draw calls, far below the immersive-3d budget of 100 desktop
          draw calls and 500k visible triangles. Its rotation phase comes from
          the seeded product-motion stream; reduced motion holds that static
          pose while full motion advances it from the injected clock, so
          identical frames are a pure function of the same commit, seed,
          station, and motion.
        </p>
        <SceneClient mode={mode} stationId={stationId} motion={motion} />
      </section>

      <section aria-labelledby="run-heading">
        <h2 id="run-heading">Run it</h2>
        <ol className="run-steps">
          <li>
            <code>npm ci</code> installs the exact locked dependency set.
          </li>
          <li>
            <code>npm run build</code> produces the production bundle; the
            model and posters are committed, so the build needs no network.
          </li>
          <li>
            <code>
              WDU_DETERMINISTIC=1 npm run start
            </code>{' '}
            is the capture entry point: fixed clock, seeded streams, named
            station.
          </li>
          <li>
            <code>npm run verify:fixture -- --out /tmp/wdu-product-hero</code>{' '}
            builds, starts the deterministic server, and runs the plugin
            verifier's desktop, mobile, reduced-motion, fallback, and
            telemetry-gate captures.
          </li>
        </ol>
      </section>

      <section aria-labelledby="matrix-heading">
        <h2 id="matrix-heading">Pinned dependency matrix</h2>
        <table className="matrix">
          <thead>
            <tr>
              <th scope="col">Package</th>
              <th scope="col">Version</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Next.js</td>
              <td>15.5.24</td>
            </tr>
            <tr>
              <td>React</td>
              <td>19.2.8</td>
            </tr>
            <tr>
              <td>three</td>
              <td>0.185.1</td>
            </tr>
            <tr>
              <td>@react-three/fiber</td>
              <td>9.7.0</td>
            </tr>
            <tr>
              <td>@gltf-transform/cli</td>
              <td>4.4.2</td>
            </tr>
            <tr>
              <td>TypeScript</td>
              <td>5.9.3</td>
            </tr>
            <tr>
              <td>Node.js</td>
              <td>22.18 or newer, for type-stripped tests</td>
            </tr>
          </tbody>
        </table>
      </section>
    </main>
  )
}
