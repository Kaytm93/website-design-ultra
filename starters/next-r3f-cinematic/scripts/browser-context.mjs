// Browser capability failures follow the capture-poster/ADR-010 contract.
export class BrowserUnavailableError extends Error {
  constructor(message, options) {
    super(`BROWSER_UNAVAILABLE: ${message}`, options)
    this.name = 'BrowserUnavailableError'
  }
}

export async function withTimeout(operation, timeoutMs, label) {
  let timer
  try {
    return await Promise.race([
      Promise.resolve().then(operation),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new BrowserUnavailableError(`${label} timed out after ${timeoutMs}ms`)), timeoutMs)
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}

export async function closeContext(context, timeoutMs = 2_000) {
  // A broken transport must not hang cleanup or hide the original assertion.
  try { await withTimeout(() => context.close(), timeoutMs, 'context.close') } catch {}
}

export async function createBrowserContext(browser, options, { attempts = 2, timeoutMs = 5_000, cleanupTimeoutMs = 2_000 } = {}) {
  const failures = []
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    let expired = false
    try {
      return await withTimeout(async () => {
        const context = await browser.newContext(options)
        // Promise.race cannot cancel newContext. Dispose a late context rather
        // than leaking it while the next attempt is already running.
        if (expired) {
          await closeContext(context, cleanupTimeoutMs)
          return
        }
        return context
      }, timeoutMs, `browser.newContext attempt ${attempt}/${attempts}`)
    } catch (error) {
      expired = true
      failures.push(error.message)
    }
  }
  throw new BrowserUnavailableError(failures.join(' | '))
}
