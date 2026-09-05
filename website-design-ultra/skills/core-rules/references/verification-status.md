# Verification status

Four values, defined once. Every skill and command that reports a verification
result uses these and adds nothing to them.

| Status | When |
|---|---|
| `PASS` | A runnable target was exercised and the evidence inspected: images looked at, telemetry read. |
| `FAIL` | The target was exercised and the evidence shows a defect. |
| `UNAVAILABLE` | The target is runnable but the required capability is not: no browser, no GPU, no telemetry surface, or the target is unreachable. |
| `NOT_APPLICABLE (plan-only)` | There is no runnable target, because the deliverable is a plan or a contract. |

`PASS` requires artifacts. A green build, a clean typecheck, a passing unit
suite, and a code review are none of them.

`UNAVAILABLE` is not a lighter `FAIL` and not a quiet `PASS`. It obliges three
things: run the substitutes that exist (build, typecheck, static poster, DOM
and reduced-motion checks), hand the work over explicitly as **unverified**,
and leave the launch gate open. Name the missing capability, because that names
what would close the gate.

`NOT_APPLICABLE (plan-only)` obliges the planned capture matrix: what would be
photographed, in which states, once something runs. The first runnable build
makes the browser check mandatory.

A missing slash command, a missing Codex path, an unavailable adapter, and a
successful build are all reasons a check did not happen. None is evidence that
the thing works.
