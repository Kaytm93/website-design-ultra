#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { compareTargetFrame } from '../../../../website-design-ultra/scripts/target-comparison.mjs'
import { encodePng } from '../../interaction-capture/compare-baselines.mjs'

const ROOT = path.dirname(fileURLToPath(import.meta.url))
const WIDTH = 24
const HEIGHT = 16

function posterPixels() {
  const pixels = Buffer.alloc(WIDTH * HEIGHT * 4)
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const offset = (y * WIDTH + x) * 4
      const subject = x > 8 && x < WIDTH - 9 && y > 4 && y < HEIGHT - 5
      pixels[offset] = subject ? 137 : 16
      pixels[offset + 1] = subject ? 167 : 24
      pixels[offset + 2] = subject ? 177 : 32
      pixels[offset + 3] = 255
    }
  }
  return pixels
}

function shiftedLight(pixels) {
  const shifted = Buffer.from(pixels)
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      if (x < 6 || y < 6) continue
      const offset = (y * WIDTH + x) * 4
      shifted[offset] = Math.min(255, shifted[offset] + 38)
      shifted[offset + 1] = Math.max(0, shifted[offset + 1] - 22)
      shifted[offset + 2] = Math.max(0, shifted[offset + 2] - 14)
    }
  }
  return shifted
}

function writePng(file, pixels) {
  fs.writeFileSync(file, encodePng(WIDTH, HEIGHT, pixels))
}

const targetPixels = posterPixels()
const targetPath = path.join(ROOT, 'poster-target.png')
const shiftedPath = path.join(ROOT, 'live-light-shifted.png')
const correctedPath = path.join(ROOT, 'live-corrected.png')
writePng(targetPath, targetPixels)
writePng(shiftedPath, shiftedLight(targetPixels))
writePng(correctedPath, targetPixels)

const shifted = compareTargetFrame({
  targetPath,
  liveFramePath: shiftedPath,
  out: ROOT,
  iteration: 'light-shift',
})
const corrected = compareTargetFrame({
  targetPath,
  liveFramePath: correctedPath,
  out: path.join(ROOT, 'iteration-02-corrected-light'),
  iteration: 'corrected-light',
})

if (shifted.report.status !== 'FAIL' || corrected.report.status !== 'PASS') {
  throw new Error('look-loop fixture must contain one worse and one corrected iteration')
}
console.log(
  JSON.stringify(
    {
      target: targetPath,
      iterations: [
        {
          id: shifted.report.iteration,
          status: shifted.report.status,
          meanAbsDifference: shifted.report.comparison.meanAbsDifference,
          diffArtifact: shifted.report.diffArtifact,
        },
        {
          id: corrected.report.iteration,
          status: corrected.report.status,
          meanAbsDifference: corrected.report.comparison.meanAbsDifference,
          diffArtifact: path.join('iteration-02-corrected-light', corrected.report.diffArtifact),
        },
      ],
    },
    null,
    2,
  ),
)
