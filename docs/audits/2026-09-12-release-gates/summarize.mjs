import fs from 'node:fs'
import assert from 'node:assert/strict'
const root = new URL('./', import.meta.url)
const read = name => JSON.parse(fs.readFileSync(new URL(name, root), 'utf8'))
const sources = ['codex-initial/report.json', 'codex-coverage/report.json']
const reports = sources.map(read)
for (const report of reports) {
  assert.equal(report.provider, 'codex')
  assert.equal(report.model, 'gpt-5.5')
  assert.equal(report.effort, 'medium')
  assert.equal(report.provenance.clean, true)
  assert.deepEqual(report.provenance, reports[0].provenance)
}
const cases = read('cases.json').map(({ id }) => id)
assert.equal(cases.length, 7)
const attempts = reports.flatMap((report, i) => report.results.map(result => ({ ...result, source: sources[i] })))
const summary = cases.map(id => {
  const all = attempts.filter(item => item.id === id)
  const scored = all.filter(item => ['passed', 'failed'].includes(item.status))
  const passed = scored.filter(item => item.status === 'passed').length
  const passRate = scored.length ? passed / scored.length : null
  return { id, attempts: all.length, scored: scored.length, passed,
    providerErrors: all.filter(item => item.status === 'provider-error').length,
    passRate, fullRepeatCompleted: scored.length >= 5,
    meetsRepeatedAcceptance: scored.length >= 5 && passRate >= 0.6,
    failures: [...new Set(scored.flatMap(item => item.failures))],
    evidence: scored.map(item => ({ source: item.source, attempt: item.attempt, status: item.status, tracePath: item.tracePath })),
  }
})
const payload = {
  status: 'FAIL', releaseEligible: false,
  provider: 'codex', model: 'gpt-5.5', effort: 'medium', provenance: reports[0].provenance,
  sources, fullCaseCoverage: summary.every(item => item.scored > 0),
  scoredAttempts: summary.reduce((sum, item) => sum + item.scored, 0),
  plannedRepeatedAcceptance: { scoredAttemptsPerCase: 5, minPassRate: 0.6, status: 'INCOMPLETE' },
  summary,
}
assert.equal(payload.fullCaseCoverage, true)
assert.equal(summary.filter(item => item.failures.length > 0).length, 4)
fs.writeFileSync(new URL('live-summary.json', root), JSON.stringify(payload, null, 2) + '\n')
console.log(`${summary.length}/7 cases have live model responses; 4 cases have contract failures; release blocked.`)
