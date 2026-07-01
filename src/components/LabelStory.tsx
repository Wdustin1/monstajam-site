export default function LabelStory() {
  return (
    <section className="relative z-10 mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12" aria-labelledby="label-story-heading">
      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="border border-white/10 bg-[#0d0d0d] p-5 shadow-[0_18px_48px_rgba(0,0,0,0.35)] md:p-7">
          <div className="mb-5 flex items-center gap-3">
            <span className="h-px w-10 bg-cyan-200/40" />
            <span className="text-[11px] font-black uppercase tracking-[0.24em] text-zinc-500">Label note</span>
          </div>
          <h2 id="label-story-heading" className="max-w-3xl text-3xl font-black uppercase leading-none tracking-[-0.045em] text-white md:text-5xl">
            Producer hub first. Artist pages second.
          </h2>
          <p className="mt-5 max-w-3xl text-base leading-7 text-zinc-400">
            Monsta Jam Productions is the umbrella. The site should feel like a vault for the roster:
            official drops, unreleased cuts, production notes, and links back to the records. Tyler J is the
            current run, not the whole world.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
          <div className="border border-white/10 bg-black/25 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-600">01 / Roster</p>
            <p className="mt-2 text-sm leading-6 text-zinc-300">Make room for more artists under the label without rebuilding the homepage every time.</p>
          </div>
          <div className="border border-white/10 bg-black/25 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-600">02 / Releases</p>
            <p className="mt-2 text-sm leading-6 text-zinc-300">Treat every track like a file: catalog number, cover, artist, credits, mood, and a short note.</p>
          </div>
          <div className="border border-white/10 bg-black/25 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-600">03 / Proof</p>
            <p className="mt-2 text-sm leading-6 text-zinc-300">No fake stats or dead socials. If the content is not real yet, it stays out of the spotlight.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
