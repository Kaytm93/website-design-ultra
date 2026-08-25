import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The starter is an independent root-only project (ADR-011). Pin the
  // tracing root so a stray lockfile in a parent directory (for example the
  // home directory) can never become the inferred workspace root.
  outputFileTracingRoot: projectRoot,
}

export default nextConfig
