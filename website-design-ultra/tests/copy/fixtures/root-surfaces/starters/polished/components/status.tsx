/**
 * A label-bearing control for the root-surface fixture: the visible label is
 * real copy and must be linted like any shipped UI string.
 */
export function StatusControl() {
  return (
    <div>
      <span>Capture state</span>
      <output>ready</output>
    </div>
  )
}
