export default function Home() {
  return (
    <div className="flex flex-col gap-8 py-10">
      <header>
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">Dashboard</h1>
        <p className="text-zinc-600 dark:text-zinc-400 mt-2">
          Select an action to manage your data.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Placeholder for Data Collections */}
        <div className="p-6 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm opacity-50">
          <h2 className="text-xl font-semibold mb-2">Firestore Collections</h2>
          <p className="text-sm text-zinc-500 mb-4">Coming soon...</p>
        </div>

        <div className="p-6 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm opacity-50">
          <h2 className="text-xl font-semibold mb-2">Realtime DB Paths</h2>
          <p className="text-sm text-zinc-500 mb-4">Coming soon...</p>
        </div>
      </div>
    </div>
  );
}
