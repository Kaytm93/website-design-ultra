import './globals.css'

/**
 * Server-rendered document shell. The runtime mode is resolved per request by
 * app/page.tsx; the shell itself stays environment-independent.
 */
export const metadata = {
  title: 'Procedural Crystal — wdu-procedural-crystal',
  description: 'IP-10C: a procedurally generated Draco-compressed GLB evaluated by the shared immersive contracts.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}