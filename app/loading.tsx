export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className="mb-6 h-8 w-48 animate-pulse rounded bg-muted" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <div className="h-96 animate-pulse rounded-lg bg-muted xl:col-span-2" />
        <div className="h-96 animate-pulse rounded-lg bg-muted" />
      </div>
    </div>
  );
}
