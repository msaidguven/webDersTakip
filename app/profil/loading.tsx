export default function ProfilLoading() {
  return (
    <div className="min-h-screen bg-default animate-pulse">
      <div className="max-w-5xl mx-auto p-4 sm:p-8 space-y-6">
        {/* Stats Skeleton */}
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-surface-elevated rounded-2xl"></div>
          ))}
        </div>

        {/* Profile Card Skeleton */}
        <div className="h-40 bg-surface-elevated rounded-2xl"></div>

        {/* Progress Skeleton */}
        <div className="h-64 bg-surface-elevated rounded-2xl"></div>
      </div>
    </div>
  );
}
