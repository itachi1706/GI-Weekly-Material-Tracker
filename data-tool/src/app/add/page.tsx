
import { getAllTemplates } from '@/actions/templates';
import { getDocument } from '@/actions/firestore';
import AddEntryForm from '@/components/AddEntryForm';
import { CollectionType } from '@/types/schema';

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function AddEntryPage({ searchParams }: { searchParams: SearchParams }) {
    const templates = await getAllTemplates();
    const sp = await searchParams;

    const collection = sp.type as CollectionType | undefined;
    const sourceId = sp.sourceId as string | undefined;

    let initialData = null;
    let initialId = '';

    if (collection && sourceId) {
        try {
            const doc = await getDocument(collection, sourceId);
            if (doc) {
                // Remove ID from data if present in body, as we want to create new
                const { id: _, ...rest } = doc;
                initialData = rest;
                initialId = `${sourceId}_copy`;
            }
        } catch (e) {
            console.error('Error fetching source document for duplication:', e);
        }
    }

    return (
        <div className="max-w-4xl mx-auto py-8">
            <h1 className="text-3xl font-bold mb-6 text-zinc-900 dark:text-zinc-50">
                {sourceId ? 'Duplicate Entry' : 'Add New Entry'}
            </h1>
            <AddEntryForm
                templates={templates}
                initialCollection={collection}
                initialData={initialData}
                initialId={initialId}
            />
        </div>
    );
}
