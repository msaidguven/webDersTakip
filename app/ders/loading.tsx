export default function DersLoading() {
  return (
    <div className="min-h-screen bg-default animate-pulse">
      <div className="max-w-7xl mx-auto p-4 sm:p-8">
        {/* Header Skeleton */}
        <div className="h-40 bg-surface-elevated rounded-2xl mb-6"></div>

        {/* Tabs Skeleton */}
        <div className="flex gap-2 mb-8">
          <div className="h-12 w-32 bg-surface-elevated rounded-xl"></div>
          <div className="h-12 w-32 bg-surface-elevated rounded-xl"></div>
        </div>

        {/* Content Skeleton */}
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-surface-elevated rounded-xl"></div>
          ))}
        </div>
      </div>
    </div>
  );
}
