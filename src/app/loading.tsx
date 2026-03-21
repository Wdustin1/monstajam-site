export default function Loading() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Navbar skeleton */}
      <div className="w-full h-[73px] bg-[#050505]/90 border-b border-white/5 fixed top-0 z-50" />

      <main className="flex-grow pt-24 max-w-7xl mx-auto px-8 w-full">
        {/* Hero skeleton */}
        <div className="flex flex-col lg:flex-row items-center justify-between gap-12 py-16 min-h-[calc(100vh-96px)]">
          <div className="w-full lg:w-1/2 flex flex-col gap-6">
            <div className="h-3 w-24 rounded-full bg-white/5 animate-pulse" />
            <div className="flex flex-col gap-3">
              <div className="h-14 w-3/4 rounded-xl bg-white/5 animate-pulse" />
              <div className="h-14 w-2/3 rounded-xl bg-white/5 animate-pulse" />
              <div className="h-14 w-1/2 rounded-xl bg-white/5 animate-pulse" />
            </div>
            <div className="h-4 w-full max-w-md rounded-full bg-white/5 animate-pulse" />
            <div className="flex gap-4">
              <div className="h-12 w-40 rounded-full bg-white/5 animate-pulse" />
              <div className="h-12 w-36 rounded-full bg-white/5 animate-pulse" />
            </div>
          </div>
          <div className="w-full lg:w-1/2 flex justify-center">
            <div className="w-72 h-72 rounded-full bg-white/5 animate-pulse" />
          </div>
        </div>

        {/* Library skeleton */}
        <div className="pb-40">
          <div className="h-8 w-48 rounded-xl bg-white/5 animate-pulse mb-8" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="rounded-2xl overflow-hidden bg-white/3 animate-pulse">
                <div className="aspect-square bg-white/5" />
                <div className="p-4 flex flex-col gap-2">
                  <div className="h-4 rounded-full bg-white/5 w-3/4" />
                  <div className="h-3 rounded-full bg-white/5 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
