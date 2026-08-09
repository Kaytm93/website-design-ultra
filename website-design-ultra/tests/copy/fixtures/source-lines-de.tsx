import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'

// Der Gedankenstrich in diesem Kommentar — er steht in keiner Zeile Copy und
// darf deshalb nichts auslösen. Er steht hier, damit ein Report, der einfach
// das erste Vorkommen im Quelltext sucht, auf diese Zeile zeigt statt auf 16.

type Props = {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'meta' })
  const siteName = t('siteName')
  const title = `${siteName} — ${t('siteTagline')}`
  return { title, description: t('siteDescription') }
}

export default function Layout() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <span className="badge">✨ Jetzt in der Beta</span>
      <h1 className="text-5xl">Nahtlos vom Termin zur Aufgabenliste</h1>
      <p className="text-lg">
        Das Protokoll ist mehr als nur eine Mitschrift.
      </p>
    </main>
  )
}
