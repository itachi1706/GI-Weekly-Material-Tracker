
import Link from 'next/link';

export default function Home() {
  const collections = [
    { name: 'Characters', key: 'characters', description: 'Manage playable characters' },
    { name: 'Weapons', key: 'weapons', description: 'Manage weapons catalog' },
    { name: 'Materials', key: 'materials', description: 'Manage materials and items' },
    { name: 'Outfits', key: 'outfits', description: 'Manage character outfits' },
  ];

  return (
    <div className="flex flex-col gap-8 py-10">
      <header>
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">Dashboard</h1>
        <p className="text-zinc-600 dark:text-zinc-400 mt-2">
          Select a collection to manage your data.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {collections.map((col) => (
          <Link
            key={col.key}
            href={`/manage/${col.key}`}
            className="group block p-6 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm hover:border-blue-500 transition-colors"
          >
            <h2 className="text-xl font-semibold mb-2 group-hover:text-blue-600">{col.name}</h2>
            <p className="text-sm text-zinc-500">{col.description}</p>
          </Link>
        ))}
      </div>

      <div className="mt-8 border-t pt-8 border-zinc-200 dark:border-zinc-800">
        <h2 className="text-xl font-bold mb-4">Quick Actions</h2>
        <div className="flex gap-4">
          <Link href="/add" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            Add New Entry
          </Link>
        </div>
      </div>
    </div>
  );
}
