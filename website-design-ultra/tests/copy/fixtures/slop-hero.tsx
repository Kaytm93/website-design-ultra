import { Button } from '@/components/ui/button'

export function Hero() {
  return (
    <section className="flex min-h-dvh items-center justify-center rounded-2xl shadow-lg p-6">
      <span className="uppercase tracking-widest text-xs">✨ Now in beta</span>
      <h1 className="text-6xl font-bold">It's not a note-taker. It's your second brain.</h1>
      <p className="text-lg text-slate-400">
        Seamlessly unlock the full potential of every meeting with cutting-edge AI.
      </p>
      <Button aria-label="Get started for free">Get started</Button>
      <img alt="A robust, innovative dashboard showcasing the intricate landscape" src="/x.png" />
    </section>
  )
}
