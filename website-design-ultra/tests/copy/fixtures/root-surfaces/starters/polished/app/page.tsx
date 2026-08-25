/**
 * Real starter copy for the root-surface regression fixture. Deliberately
 * small but complete: a headline, a lead, and a contract list, all written
 * to pass the default marketing register of scripts/lint-copy.mjs.
 */
export default function Page() {
  return (
    <main>
      <section aria-labelledby="title">
        <p className="kicker">aurora-cinematic · a website-design-ultra starter</p>
        <h1 id="title">A cinematic hero with a server-rendered page.</h1>
        <p className="lead">
          This starter ships one client-only canvas leaf inside a
          server-rendered page. The copy below is real HTML, the scene is
          procedural geometry, and a fresh checkout installs and builds
          offline with nothing fetched at runtime.
        </p>
      </section>
      <section aria-labelledby="contract-heading">
        <h2 id="contract-heading">What the scaffold owns</h2>
        <dl>
          <div>
            <dt>One camera owner</dt>
            <dd>CameraRig applies the selected station before every render.</dd>
          </div>
          <div>
            <dt>One injected clock</dt>
            <dd>Every animation reads the same SceneClock instance.</dd>
          </div>
          <div>
            <dt>One asset manifest</dt>
            <dd>lib/asset-manifest.json lists every runtime asset.</dd>
          </div>
        </dl>
      </section>
    </main>
  )
}
