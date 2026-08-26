import './broken-module'

export default function Page() {
  return (
    <main>
      <h1>build-fail — deliberate failing fixture</h1>
      <p>
        This page imports ./broken-module, which does not exist in the
        fixture. The production build must fail on the missing module, and
        the evaluation runner's build gate must report FAIL.
      </p>
    </main>
  )
}
