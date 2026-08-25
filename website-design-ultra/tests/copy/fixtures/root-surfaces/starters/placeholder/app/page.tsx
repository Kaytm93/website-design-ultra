/**
 * Deliberately placeholder copy for the root-surface regression fixture. The
 * anti-slop linter alone passes this text; the root-surface placeholder gate
 * in validate-content.mjs is the mechanism that must fail it.
 */
export default function Page() {
  return (
    <main>
      <section aria-labelledby="title">
        <h1 id="title">Your headline here</h1>
        <p className="lead">
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Insert your
          text here and replace this placeholder copy before shipping.
        </p>
      </section>
    </main>
  )
}
