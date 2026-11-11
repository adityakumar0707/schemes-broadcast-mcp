// Shown instantly while a dashboard page loads, so clicks feel immediate.
export default function Loading() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Loading">
      <div className="h-6 w-48 rounded bg-gray-200" />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="h-28 rounded-lg bg-gray-200" />
        <div className="h-28 rounded-lg bg-gray-200" />
        <div className="h-28 rounded-lg bg-gray-200" />
        <div className="h-28 rounded-lg bg-gray-200" />
      </div>
    </div>
  );
}
