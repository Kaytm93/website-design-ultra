/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  // The fixture is offline: every runtime asset is committed under public/.
  // No image domains or remote URLs are configured.
}

export default nextConfig