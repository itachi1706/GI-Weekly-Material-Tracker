
import { getAllTemplates } from '@/actions/templates';

export default async function TestTemplatesPage() {
    const templates = await getAllTemplates();

    return (
        <div className="p-8">
            <h1 className="text-2xl font-bold mb-4">Template Debugger</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="border p-4 rounded bg-zinc-50 dark:bg-zinc-900">
                    <h2 className="font-bold mb-2">Characters ({Object.keys(templates.characters).length})</h2>
                    <pre className="text-xs overflow-auto max-h-96">
                        {JSON.stringify(Object.keys(templates.characters), null, 2)}
                    </pre>
                </div>

                <div className="border p-4 rounded bg-zinc-50 dark:bg-zinc-900">
                    <h2 className="font-bold mb-2">Weapons ({Object.keys(templates.weapons).length})</h2>
                    <pre className="text-xs overflow-auto max-h-96">
                        {JSON.stringify(Object.keys(templates.weapons), null, 2)}
                    </pre>
                </div>

                <div className="border p-4 rounded bg-zinc-50 dark:bg-zinc-900">
                    <h2 className="font-bold mb-2">Materials ({Object.keys(templates.materials).length})</h2>
                    <pre className="text-xs overflow-auto max-h-96">
                        {JSON.stringify(Object.keys(templates.materials), null, 2)}
                    </pre>
                </div>

                <div className="border p-4 rounded bg-zinc-50 dark:bg-zinc-900">
                    <h2 className="font-bold mb-2">Outfits ({Object.keys(templates.outfits).length})</h2>
                    <pre className="text-xs overflow-auto max-h-96">
                        {JSON.stringify(Object.keys(templates.outfits), null, 2)}
                    </pre>
                </div>
            </div>

            <div className="mt-8">
                <h2 className="font-bold mb-2">Sample Character (Anemo_5)</h2>
                <pre className="text-xs bg-zinc-100 dark:bg-zinc-800 p-4 rounded overflow-auto">
                    {JSON.stringify(templates.characters['Anemo_5'], null, 2)}
                </pre>
            </div>
        </div>
    );
}
