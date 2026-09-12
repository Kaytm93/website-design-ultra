import fs from 'node:fs'

export default class StatusReporter {
  onEnd(result) {
    if (process.env.WDU_BROWSER_STATUS_FILE) {
      fs.writeFileSync(process.env.WDU_BROWSER_STATUS_FILE, JSON.stringify({ status: result.status }))
    }
  }
  onTestEnd(test, result) {
    if (result.status === test.expectedStatus || result.status === 'skipped') return
    this.record(result.errors)
  }
  onError(error) { this.record([error]) }
  record(errors) {
    if (!process.env.WDU_BROWSER_ERRORS_FILE) return
    fs.appendFileSync(process.env.WDU_BROWSER_ERRORS_FILE, JSON.stringify({
      unavailable: errors.length > 0 && errors.every(error =>
        /BROWSER_UNAVAILABLE:/.test(error.message ?? '')),
    }) + '\n')
  }
}
