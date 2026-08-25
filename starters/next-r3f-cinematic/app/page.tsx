import { SceneClient } from '../components/SceneClient'
import { getCameraStation } from '../lib/determinism-runtime'
import { CAMERA_STATIONS } from '../lib/camera-stations'
import { resolveRuntimeMode } from '../lib/runtime-config'

/**
 * The capture entry point. This page resolves WDU_DETERMINISTIC and
 * WDU_STATION per request at the application boundary and injects the resolved
 * mode and station into the scene runtime. It is force-dynamic so the mode is
 * never baked into a static page at build time; the copy below is still
 * server-rendered into the initial HTML on every request.
 */
export const dynamic = 'force-dynamic'

export default function Page() {
  const { mode, stationId } = resolveRuntimeMode()
  // Fail explicitly before scene initialization when the requested station id
  // is unknown. Never fall back to the first station.
  getCameraStation(CAMERA_STATIONS, stationId)

  return (
    <main>
      <header className="site-header">
        <img
          src="/brand-mark.svg"
          alt=""
          width="28"
          height="28"
          className="brand-mark"
        />
        <span>next-r3f-cinematic</span>
      </header>

      <section className="hero" aria-labelledby="page-title">
        <p className="kicker">next-r3f-cinematic · a website-design-ultra starter</p>
        <h1 id="page-title">One server-rendered page around one client canvas.</h1>
        <p className="lead">
          This starter scaffolds a cinematic 3D hero for website-design-ultra.
          Next.js renders the copy below as HTML; a client-only canvas leaf runs
          the three.js scene. The scene is procedural geometry with no network
          assets, so a fresh checkout installs, builds, and renders offline.
        </p>
      </section>

      <section aria-labelledby="layout-heading">
        <h2 id="layout-heading">What stays where</h2>
        <dl className="contract-list">
          <div>
            <dt>Server-rendered page</dt>
            <dd>
              This copy, the station control, and the status note ship in the
              initial HTML. The canvas mounts only in the browser.
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
              Every animation reads the injected SceneClock. Deterministic mode
              advances a fixed 1/60 s step per rendered frame.
            </dd>
          </div>
          <div>
            <dt>One asset manifest</dt>
            <dd>
              lib/asset-manifest.json lists every runtime asset. The header
              mark is the only declared asset.
            </dd>
          </div>
          <div>
            <dt>Wired determinism</dt>
            <dd>
              WDU_DETERMINISTIC=1 freezes the clock, seeds every named random
              stream, applies the requested camera station, and sets
              html[data-wdu-ready="true"] only after the stable frame renders.
            </dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="scene-heading">
        <h2 id="scene-heading">The scene</h2>
        <p>
          The subject is a matte torus knot on a pedestal. Its rotation phase
          comes from the seeded hero-motion stream and its speed reads the
          injected clock, so the same commit, seed, and station capture
          identical frames.
        </p>
        <SceneClient mode={mode} stationId={stationId} />
      </section>

      <section aria-labelledby="run-heading">
        <h2 id="run-heading">Run it</h2>
        <ol className="run-steps">
          <li>
            <code>npm ci</code> — install the exact locked dependency set.
          </li>
          <li>
            <code>npm run dev</code> — live mode with the wall clock.
          </li>
          <li>
            <code>
              npm run build && WDU_DETERMINISTIC=1 WDU_STATION=hero-wide npm
              run start
            </code>{' '}
            — the capture entry point: fixed clock, seeded streams, named
            station.
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
