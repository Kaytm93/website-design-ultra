#!/usr/bin/env node

/**
 * Copyable, license-first MSDF atlas runner.
 *
 * The plugin does not install or bundle msdf-atlas-gen. `--check` is fully
 * dependency-free; generation invokes an explicitly selected executable with
 * argv (never a shell string) and writes a provenance manifest beside output.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const ALLOWED_LICENSES = new Set(['MIT', 'OFL-1.1', 'Apache-2.0', 'CC0-1.0']);
const SCRIPT_VERSION = 'wdu-shader-text-atlas-v1';

function usage() {
  return `Usage:
  node msdf-atlas.mjs --check license-manifest.json
  node msdf-atlas.mjs --manifest license-manifest.json --font ./NotoSans.ttf --out ./public/type

Options:
  --check <manifest>       validate the manifest without a generator
  --manifest <manifest>    license manifest (required for generation)
  --font <file>            font input; never fetched by this script
  --out <directory>        output directory for atlas.png and atlas.json
  --generator <executable> explicit msdf-atlas-gen executable (default: msdf-atlas-gen)
  --dry-run                validate and print argv without invoking the generator
  --help                   show this message`;
}

function parseArgs(argv) {
  const args = { check: '', manifest: '', font: '', out: '', generator: 'msdf-atlas-gen', dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--help' || token === '-h') {
      console.log(usage());
      process.exit(0);
    }
    if (token === '--dry-run') {
      args.dryRun = true;
      continue;
    }
    if (token === '--check') {
      args.check = argv[++i] ?? '';
      continue;
    }
    if (token === '--manifest') {
      args.manifest = argv[++i] ?? '';
      continue;
    }
    if (token === '--font') {
      args.font = argv[++i] ?? '';
      continue;
    }
    if (token === '--out') {
      args.out = argv[++i] ?? '';
      continue;
    }
    if (token === '--generator') {
      args.generator = argv[++i] ?? '';
      continue;
    }
    throw new Error(`unknown option ${token}`);
  }
  return args;
}

function readManifest(manifestPath) {
  if (!manifestPath) throw new Error('license manifest path is required');
  const absolute = resolve(manifestPath);
  if (!existsSync(absolute)) throw new Error(`license manifest not found: ${absolute}`);
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(absolute, 'utf8'));
  } catch (error) {
    throw new Error(`license manifest is not valid JSON: ${error.message}`);
  }
  validateManifest(manifest, absolute);
  return { manifest, absolute };
}

function requireString(object, path, value) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`license manifest field ${path} must be a non-empty string`);
  }
}

function allowedLicense(value, path) {
  requireString({}, path, value);
  if (!ALLOWED_LICENSES.has(value)) {
    throw new Error(`${path}=${value} is not an allowed permissive license`);
  }
}

function validateManifest(manifest, manifestPath) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw new Error('license manifest must be a JSON object');
  }
  requireString(manifest, 'module', manifest.module);
  if (manifest.module !== 'shader-text') throw new Error('license manifest module must be shader-text');
  requireString(manifest, 'version', manifest.version);
  if (!manifest.version.startsWith('wdu-shader-text-license-v')) throw new Error('unsupported license manifest version');
  requireString(manifest, 'license', manifest.license);
  allowedLicense(manifest.license, 'license');
  if (manifest.noPaidFonts !== true) throw new Error('noPaidFonts must be true');
  if (manifest.noCommittedCredentials !== true) throw new Error('noCommittedCredentials must be true');

  const generator = manifest.generator;
  if (!generator || typeof generator !== 'object') throw new Error('generator metadata is required');
  requireString(generator, 'generator.name', generator.name);
  if (generator.name !== 'msdf-atlas-gen') throw new Error('generator.name must be msdf-atlas-gen');
  requireString(generator, 'generator.version', generator.version);
  allowedLicense(generator.license, 'generator.license');
  requireString(generator, 'generator.attribution', generator.attribution);

  if (!Array.isArray(manifest.fonts) || manifest.fonts.length === 0) throw new Error('fonts must contain at least one option');
  for (const [index, font] of manifest.fonts.entries()) {
    const prefix = `fonts[${index}]`;
    requireString(font, `${prefix}.family`, font?.family);
    allowedLicense(font?.license, `${prefix}.license`);
    requireString(font, `${prefix}.source`, font?.source);
    requireString(font, `${prefix}.attribution`, font?.attribution);
  }

  const atlas = manifest.atlas;
  if (!atlas || typeof atlas !== 'object') throw new Error('atlas metadata is required');
  if (atlas.format !== 'MSDF') throw new Error('atlas.format must be MSDF');
  if (atlas.channels !== 3) throw new Error('atlas.channels must be 3');
  if (atlas.colorSpace !== 'LINEAR_UNENCODED') throw new Error('atlas.colorSpace must be LINEAR_UNENCODED');
  if (!Number.isFinite(atlas.distanceRange) || atlas.distanceRange <= 0) throw new Error('atlas.distanceRange must be positive');
  requireString(atlas, 'atlas.glyphSet', atlas.glyphSet);
  requireString(atlas, 'atlas.attribution', atlas.attribution);
  if (manifestPath.includes('node_modules')) throw new Error('license manifest must not be read from node_modules');
}

function generatorArgv(font, out) {
  return [
    '-font', font,
    '-type', 'msdf',
    '-format', 'png',
    '-imageout', resolve(out, 'atlas.png'),
    '-json', resolve(out, 'atlas.json'),
    '-potr',
    '-pxrange', '4',
  ];
}

function run() {
  const args = parseArgs(process.argv.slice(2));
  if (args.check) {
    const { manifest, absolute } = readManifest(args.check);
    console.log(`license manifest validated: ${absolute} (${manifest.module})`);
    return;
  }

  const { manifest, absolute: manifestPath } = readManifest(args.manifest);
  if (!args.font) throw new Error('--font is required for atlas generation');
  if (!existsSync(resolve(args.font))) throw new Error(`font input not found: ${resolve(args.font)}`);
  if (!args.out) throw new Error('--out is required for atlas generation');
  if (!args.generator) throw new Error('--generator cannot be empty');
  mkdirSync(resolve(args.out), { recursive: true });
  const argv = generatorArgv(args.font, args.out);
  if (args.dryRun) {
    console.log(JSON.stringify({ generator: args.generator, argv, manifest: manifestPath }, null, 2));
    return;
  }

  const result = spawnSync(args.generator, argv, { stdio: 'inherit' });
  if (result.error) throw new Error(`could not execute ${args.generator}: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`${args.generator} exited with status ${result.status}`);
  const provenance = {
    schema: SCRIPT_VERSION,
    module: manifest.module,
    licenseManifest: manifestPath,
    generator: manifest.generator,
    font: resolve(args.font),
    outputDirectory: resolve(args.out),
    argv,
  };
  writeFileSync(resolve(args.out, 'atlas.provenance.json'), `${JSON.stringify(provenance, null, 2)}\n`);
  console.log(`MSDF atlas generated and provenance written to ${resolve(args.out)}`);
}

try {
  run();
} catch (error) {
  console.error(`shader-text atlas: ${error.message}`);
  process.exitCode = 1;
}
