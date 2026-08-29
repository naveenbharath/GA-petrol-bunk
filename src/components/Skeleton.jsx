export function SkeletonBlock({ className = '' }) {
  return <div className={`skeleton animate-shimmer rounded-md ${className}`} />
}

export function SkeletonStatCards({ count = 5 }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-slate-200 bg-white p-5">
          <SkeletonBlock className="h-3.5 w-24" />
          <SkeletonBlock className="mt-3 h-7 w-20" />
        </div>
      ))}
    </div>
  )
}

export function SkeletonTable({ rows = 5, cols = 5 }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 p-4">
        <SkeletonBlock className="h-4 w-40" />
      </div>
      <div className="divide-y divide-slate-100">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex items-center gap-6 px-4 py-3.5">
            {Array.from({ length: cols }).map((_, c) => (
              <SkeletonBlock key={c} className="h-3.5 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export function SkeletonCardGrid({ count = 4 }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-slate-200 bg-white p-5">
          <SkeletonBlock className="h-4 w-2/3" />
          <SkeletonBlock className="mt-3 h-3 w-1/2" />
          <SkeletonBlock className="mt-4 h-8 w-full" />
        </div>
      ))}
    </div>
  )
}
