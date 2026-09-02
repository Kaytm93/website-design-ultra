# Maintenance

How this plugin is validated, what its committed evidence covers, and what a
release requires.

## Maintenance

- Keep manifest version as the plugin version; individual skills do not duplicate it.
- Keep references one level below `SKILL.md`.
- Put information in either `SKILL.md` or a reference, never both.
- Recalculate color contrast after changing a token.
- Verify framework/library APIs against installed versions.
- Test all code examples and internal links before release.

Run the deterministic content check. It validates structure and contrast, binds
the linter's rules to their references, replays the copy fixtures, and lints
the plugin's own prose plus the executable root surfaces that ADR-011 keeps
outside the installed tree: every starter's discovered copy surfaces
(`app/`, `components/`, `README.md`, and the other conventional locations)
must lint clean with real copy, placeholder copy fails, generated and vendor
output stays excluded, and a `lab/` surface is declared copy-free by design
rather than reported as `NO-COPY` with exit code 2:

```bash
node scripts/validate-content.mjs
```

Lint a project's copy, or this plugin's own documents:

```bash
node scripts/lint-copy.mjs --path src
node scripts/lint-copy.mjs --path .                                      # whole repo, register per file
node scripts/lint-copy.mjs --path content --profile editorial            # one register for all
node scripts/lint-copy.mjs --path content --locale de --profile editorial
node scripts/lint-copy.mjs --path src --protect .anti-slop-protect.json --strict
node scripts/lint-copy.mjs --self
```

Exit code 1 marks a Tier-1 hit or an exceeded Tier-3 budget; `--strict` adds
Tier-2 clusters. A `PASS` reports the absence of catalogued patterns and is never
a content approval.

Aimed at a repository root, the walk skips dot directories and build output and
prints every skip: agent scratch space such as `.claude/worktrees` holds whole
copies of the repository, and entering it reports the same sentence once per copy.
Repo prose — `README`, `CHANGELOG`, `AGENTS.md`, `CLAUDE.md`, Markdown outside a
shipped-copy path — is judged in the `docs` register, where em dashes, tick-box
headings, and one heading per paragraph are normal. Construction tells stay on in
every register; only `em-dash-in-heading`, `emoji-in-heading`, and
`de:english-em-dash` relax, because those three judge published typography.
`--profile` sets one register for every file. Read the printed `profile auto →`
split before quoting a count.

Exit code 2 marks `NO-COPY`: no file matched the path, or no visible text could
be extracted from any input. That is not a pass. It reads Markdown, JSX/TSX,
HTML, Vue, Svelte, Astro, and the string values of JSON message catalogues —
message ids are not copy. Copy assembled at runtime in plain `.js`, or held in a
format the extractor does not read, is reported as unchecked, and a partial miss
prints a `NO-COPY WARNING` naming the skipped files.

`sentence-variation` is advisory: measured and printed, never fail-gating. Short
factual copy is legitimately uniform, and gating on it rejected the specific,
evidence-led writing the skill asks for.

Validate the seven forward-test contracts and replay the committed trace fixtures
without model usage:

```bash
node scripts/run-forward-tests.mjs --dry-run
```

This command intentionally says that no model behavior was tested. It is not a
Progressive Disclosure proof.

### Committed evidence scope

The repository commits two historical Claude traces: `dashboard`, recorded
against version 1.5.1, and `slop`, recorded against a dirty 1.6.1 candidate whose
manifest still read 1.6.0. Each fixture is bound to its recorded tree digest and
replays its exact accessed and forbidden files.

Those snapshots exercise the Claude trace parser and document those two attempts
only. They do not establish current 1.7.0 routing, the other five cases, routing
stability, or Codex behavior. `--dry-run` prints this historical inventory before
the current case contracts so the local evidence boundary stays visible.

Run isolated live forward tests through an authenticated Codex CLI (default) or Claude Code:

```bash
node scripts/run-forward-tests.mjs \
  --provider claude \
  --case dashboard \
  --model sonnet \
  --max-budget-usd 0.75 \
  --report /absolute/path/forward-report.json \
  --trace-dir /absolute/path/traces
```

If the selected CLI is installed outside `PATH`, pass its executable explicitly.
The same binary is then used for version, authentication, and the live run:

```bash
node scripts/run-forward-tests.mjs \
  --provider codex \
  --provider-cli /absolute/path/to/codex \
  --case dashboard
```

Use `--provider claude` to test Claude plugin loading and `--case saas` (or another case ID) during iteration. Live tests load this plugin source read-only, request schema-constrained output, and fail on missing skill routes, missing read evidence, unexpected references, broad reads, off-root reads, or per-case Plugin-token budgets. Reports include accessed files, observed bytes, a deterministic `ceil(bytes / 4)` Plugin-token estimate, provider-reported total usage, the git provenance of the tree, and its content digest. `--max-budget-usd` applies to Claude; Codex uses its configured account limits.

### One attempt is one sample, not a verdict

Skill routing is not deterministic. The same tree and the same case produce
different reference sets across attempts, so a single green run is not evidence
that a case is stable, and a single red run is not evidence of a regression.
Measured over three full runs of this suite, the set of passing cases changed
every time while the count stayed roughly flat.

Score by pass rate instead:

```bash
node scripts/run-forward-tests.mjs \
  --provider claude \
  --repeat 5 \
  --min-pass-rate 0.8 \
  --max-budget-usd 0.60 \
  --report /absolute/path/forward-report.json
```

Each case runs `--repeat` times and is scored against `--min-pass-rate`. The
summary marks any case under threshold and lists the failures that occurred in
more than one attempt — those are the reproducible ones and the only ones worth
acting on. Failures appearing in a single attempt are usually noise, and editing
rule prose to chase them tends to displace a different requirement rather than
fix anything.

Cost is cases × repeats × `--max-budget-usd`. Seven cases at `--repeat 5` and
`0.60` is up to 21 USD, so iterate with `--case` and raise `--repeat` only when
a change is ready to be judged.

The defaults (`--repeat 1 --min-pass-rate 1`) reproduce the older
all-or-nothing behaviour. Treat that mode as a smoke test.

The Claude runner isolates the session with `--setting-sources ""` and
`--strict-mcp-config`. Without that isolation the run inherits the operator's own
skills and an installed copy of this same plugin, and the trace then measures the
wrong tree. Paths outside the tested plugin root are reported as `offRootReads`
and fail the case instead of counting as evidence.

`--trace-dir` writes the raw provider event stream per case. Those files are
archivable evidence for that attempt's routing result. A recorded stream can be replayed
against the parser without any CLI: fixtures in `tests/forward/traces/` run on
every `--dry-run`, so the Claude trace-parser path stays covered on machines
where Claude Code is not authenticated.

If the selected CLI is missing or unauthenticated, the run reports `UNAVAILABLE`
with a reason, leaves the launch gate open, and exits 0 — the same contract as
browser verification (ADR-010). It is never reported as a pass. Use
`--require-live` in CI to turn `UNAVAILABLE` into a non-zero exit.

Live cases time out after five minutes by default; adjust with `--timeout-ms` for CI. Both providers pin medium reasoning so the suite remains practical and independent of a developer’s local default.

### Release provenance

```bash
node scripts/release.mjs --strict
```

Every changelog section anchors on a `Release-Tag` that must resolve to a real
tag in this repository; the gate prints the resolved commit for each version. A
changelog cannot contain the SHA of the commit that introduces it, so the tag
name — known before the commit — is the anchor, and the SHA is resolved at
verification time. The old `Commit-SHA` placeholder that declared the SHA
unavailable is now a hard validation failure: a ruleset that requires evidence
for every claim does not ship an unverifiable provenance claim of its own.
