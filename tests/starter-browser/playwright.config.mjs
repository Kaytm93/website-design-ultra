import { defineConfig } from '@playwright/test'
import path from 'node:path'
const starter = process.env.WDU_TEST_STARTER ?? 'vanilla'
if (!['vanilla', 'next'].includes(starter)) throw Error('WDU_TEST_STARTER must be vanilla or next')
const project = path.resolve(process.env.WDU_TEST_PROJECT ?? `starters/${starter === 'next' ? 'next-r3f-cinematic' : 'vite-three-canvas'}`)
const port = starter === 'next' ? 4320 : 4321
export default defineConfig({
  testDir: '.', testMatch: 'starter.spec.mjs', workers: 1, retries: 0, timeout: 45_000,
  outputDir: '../../output/starter-browser',
  reporter: [['list'], ['json', { outputFile: 'output/starter-browser/results.json' }], ['./status-reporter.mjs']],
  use: { baseURL: `http://127.0.0.1:${port}`, viewport: { width: 1280, height: 720 },
    trace: 'retain-on-failure', screenshot: 'only-on-failure',
    launchOptions: { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
  },
  webServer: { command: starter === 'next' ? `npm run start -- --hostname 127.0.0.1 --port ${port}` : `npm run preview -- --host 127.0.0.1 --port ${port} --strictPort`,
    cwd: project, url: `http://127.0.0.1:${port}`, reuseExistingServer: false, timeout: 60_000 },
})
