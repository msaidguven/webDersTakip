export default function HomeLoading() {
  return (
    <div className="min-h-screen bg-default animate-pulse">
      <div className="max-w-6xl mx-auto p-4 sm:p-8">
        {/* Week Selector Skeleton */}
        <div className="mb-8">
          <div className="h-6 w-32 bg-surface-elevated rounded mb-4"></div>
          <div className="flex gap-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-16 w-16 bg-surface-elevated rounded-xl"></div>
            ))}
          </div>
        </div>

        {/* Grades Grid Skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="h-32 bg-surface-elevated rounded-2xl"></div>
          ))}
        </div>
      </div>
    </div>
  );
}
