import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'build-fail — deliberate failing fixture',
  description:
    'A minimal Next app whose page imports a module that does not exist, so the build gate must fail.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
