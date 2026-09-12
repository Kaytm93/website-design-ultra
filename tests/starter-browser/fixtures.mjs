import { test as base, expect } from '@playwright/test'
import { BrowserUnavailableError, createBrowserContext, closeContext, withTimeout } from '../../starters/next-r3f-cinematic/scripts/browser-context.mjs'

// Chromium's software-GPU transport can stop responding after a rendered
// context closes. Give each capture its own process, as capture-poster does.
// Do not request the built-in page/context/browser fixtures: context creation
// there happens before our retry and unavailable-status handling can run.
export const test = base.extend({
  page: [async ({ playwright, launchOptions, baseURL, viewport }, use) => {
    const browser = await playwright.chromium.launch({ ...launchOptions, timeout: 10_000 }).catch(error => {
      throw new BrowserUnavailableError(`Chromium launch: ${error.message}`)
    })
    let context
    try {
      context = await createBrowserContext(browser, { baseURL, viewport })
      const page = await withTimeout(() => context.newPage(), 5_000, 'context.newPage')
      await use(page)
    } finally {
      if (context) await closeContext(context)
      try { await withTimeout(() => browser.close(), 2_000, 'browser.close') } catch {}
    }
  }, { timeout: 30_000 }],
})
export { expect }
