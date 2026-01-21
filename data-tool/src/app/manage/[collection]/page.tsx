
import { getCollectionData } from '@/actions/firestore';
import { getImageUrl } from '@/lib/storage';
import Link from 'next/link';

export default async function CollectionPage({ params }: { params: Promise<{ collection: string }> }) {
    const paramsValue = await params;
    const collection = paramsValue.collection;

    let data: any[] = [];
    let error = null;

    try {
        const rawData = await getCollectionData(collection);

        // Enrich data with image URLs
        data = await Promise.all(rawData.map(async (item) => {
            let imageUrl = null;
            if (item.image) {
                // If it's a relative path, assume bucket root.
                // Assuming item.image is like "Characters/Cryo/Aloy.png"
                imageUrl = await getImageUrl(item.image);
            }
            return { ...item, imageUrl };
        }));

    } catch (e: any) {
        error = e.message;
    }

    return (
        <div className="py-8">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <Link href="/" className="text-sm text-zinc-500 hover:underline mb-2 block">← Back to Dashboard</Link>
                    <h1 className="text-3xl font-bold capitalize">{collection}</h1>
                </div>
                <Link
                    href={`/add?type=${collection}`}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                    Add {collection.slice(0, -1)}
                </Link>
            </div>

            {error ? (
                <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded">
                    Error loading data: {error}
                </div>
            ) : (
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
                    {data.length === 0 ? (
                        <div className="p-8 text-center text-zinc-500">
                            No entries found in this collection.
                        </div>
                    ) : (
                        <table className="w-full text-left text-sm">
                            <thead className="bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800">
                                <tr>
                                    <th className="p-4 font-medium w-16">Image</th>
                                    <th className="p-4 font-medium">Name</th>
                                    <th className="p-4 font-medium w-24">Rarity</th>
                                    <th className="p-4 font-medium text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                                {data.map((item) => (
                                    <tr key={item.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                                        <td className="p-4">
                                            {item.imageUrl ? (
                                                <img
                                                    src={item.imageUrl}
                                                    alt={item.name}
                                                    className="w-10 h-10 object-cover rounded bg-zinc-100 dark:bg-zinc-800"
                                                />
                                            ) : (
                                                <div className="w-10 h-10 rounded bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xs text-zinc-400">
                                                    N/A
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4 font-medium">
                                            <div>{item.name || <em className="text-zinc-400">No Name</em>}</div>
                                            <div className="text-xs text-zinc-400 font-mono mt-0.5">{item.id}</div>
                                        </td>
                                        <td className="p-4 text-yellow-500 tracking-widest text-xs">
                                            {'⭐'.repeat(item.rarity || 0)}
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex items-center justify-end gap-3">
                                                {item.wiki && (
                                                    <a
                                                        href={item.wiki}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                                                        title="Open Wiki"
                                                    >
                                                        Wiki ↗
                                                    </a>
                                                )}
                                                <Link
                                                    href={`/add?type=${collection}&sourceId=${item.id}`}
                                                    className="text-blue-600 hover:underline"
                                                >
                                                    Duplicate
                                                </Link>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}
        </div>
    );
}
