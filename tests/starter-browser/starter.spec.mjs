import { test, expect } from '@playwright/test'
import { createBrowserContext, closeContext, withTimeout } from '../../starters/next-r3f-cinematic/scripts/browser-context.mjs'
const vanilla = (process.env.WDU_TEST_STARTER ?? 'vanilla') === 'vanilla'
const canvasSelector = vanilla ? '[data-scene-canvas]' : '.scene-canvas canvas'
const ready = async page => expect(page.locator('html')).toHaveAttribute('data-wdu-ready', 'true', { timeout: 30_000 })

test('production page renders a real GPU frame with usable DOM and no browser errors', async ({ page }, testInfo) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`) })
  await page.goto('/')
  await ready(page)
  await expect(page.locator('h1')).toBeVisible()
  const gpu = await page.locator(canvasSelector).evaluate(canvas => {
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')
    return gl && !gl.isContextLost() && canvas.width > 0 && canvas.height > 0
  })
  expect(gpu, 'A missing GPU cannot pass this browser gate').toBe(true)
  await page.screenshot({ path: testInfo.outputPath('desktop.png') })
  expect(errors).toEqual([])
})

test('portrait composition, keyboard focus and motion controls work', async ({ browser, baseURL }, testInfo) => {
  test.setTimeout(60_000) // context retries + page startup + the unchanged 30s readiness gate
  // Bypass the implicit page/context fixture: PR #47 hung before the test body.
  const context = await createBrowserContext(browser, { baseURL, viewport: { width: 390, height: 844 } })
  try {
    const page = await withTimeout(() => context.newPage(), 5_000, 'context.newPage')
    await page.goto('/')
    await ready(page)
    await expect(page.locator('html')).toHaveAttribute('data-wdu-station', 'hero-portrait')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.keyboard.press('Tab')
    expect(await page.evaluate(() => document.activeElement?.matches(':focus-visible'))).toBe(true)
    await page.screenshot({ path: testInfo.outputPath('portrait.png') })
  } finally {
    await closeContext(context)
  }
})

test('blocked browser storage does not break scene startup', async ({ page }) => {
  await page.addInitScript(() => {
    for (const key of ['localStorage', 'sessionStorage']) Object.defineProperty(window, key, {
      configurable: true, get() { throw new DOMException('Blocked', 'SecurityError') },
    })
  })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  await ready(page)
  expect(errors).toEqual([])
})

test('no WebGL retains the poster and the primary heading', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(kind, ...args) {
      if (['webgl', 'webgl2', 'experimental-webgl'].includes(kind)) return null
      return original.call(this, kind, ...args)
    }
  })
  await page.goto('/')
  await expect(page.locator('h1')).toBeVisible()
  const poster = page.locator(vanilla ? '[data-scene-poster] img' : '.scene-poster').first()
  await expect(poster).toBeVisible()
  expect(await poster.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true)
})

test('reduced motion uses the declared static mode', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await ready(page)
  await expect(page.locator('html')).toHaveAttribute('data-wdu-motion', 'reduced')
})

if (vanilla) {
  test('deterministic capture freezes pixels, survives resize and ignores stored preferences', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('wdu.vite-three-canvas.motion', 'reduced')
      sessionStorage.setItem('wdu.vite-three-canvas.quality', JSON.stringify({ tier: 'low', source: 'user', at: 0 }))
    })
    await page.goto('/?wdu=deterministic&station=hero-wide')
    await ready(page)
    await expect(page.locator('html')).toHaveAttribute('data-wdu-motion', 'full')
    const canvas = page.locator(canvasSelector)
    const first = await canvas.screenshot()
    await page.waitForTimeout(200)
    expect(await canvas.screenshot()).toEqual(first)
    await expect(page.locator('[data-motion-toggle]')).toBeDisabled()
    await page.setViewportSize({ width: 1000, height: 700 })
    await ready(page)
    const second = await canvas.screenshot()
    await page.waitForTimeout(200)
    expect(await canvas.screenshot()).toEqual(second)
  })
  test('a lost WebGL context reveals its fallback and restoration draws again', async ({ page }) => {
    await page.goto('/')
    await ready(page)
    const supported = await page.locator(canvasSelector).evaluate(canvas => {
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')
      window.__contextLoss = gl.getExtension('WEBGL_lose_context')
      window.__contextLoss?.loseContext()
      return Boolean(window.__contextLoss)
    })
    expect(supported, 'Context-loss capability is required for this test').toBe(true)
    await expect(page.locator('[data-scene-root]')).toHaveAttribute('data-scene-state', 'poster')
    await expect(page.locator('[data-scene-poster]')).toBeVisible()
    await page.evaluate(() => window.__contextLoss.restoreContext())
    await ready(page)
    await expect(page.locator('[data-scene-poster]')).toBeHidden()
  })
  test('a cached page pauses and resumes without discarding its scene', async ({ page }) => {
    await page.goto('/'); await ready(page)
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })))
    await expect(page.locator('[data-scene-root]')).toHaveAttribute('data-run-state', 'paused')
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })))
    await ready(page)
    await expect(page.locator('[data-scene-root]')).toHaveAttribute('data-run-state', 'running')
  })
}
