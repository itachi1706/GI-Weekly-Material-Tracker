
'use client';

import { useState } from 'react';
import { CollectionType } from '@/types/schema';
import { addDocument } from '@/actions/firestore';
import DynamicForm from './form/DynamicForm';

interface AddEntryFormProps {
    templates: {
        characters: Record<string, any>;
        weapons: Record<string, any>;
        materials: Record<string, any>;
        outfits: Record<string, any>;
    };
    initialCollection?: CollectionType;
    initialData?: any;
    initialId?: string;
}

export default function AddEntryForm({ templates, initialCollection, initialData, initialId }: AddEntryFormProps) {
    const [collection, setCollection] = useState<CollectionType>(initialCollection || 'characters');
    const [selectedTemplate, setSelectedTemplate] = useState<string>('');
    const [formData, setFormData] = useState<string>(initialData ? JSON.stringify(initialData, null, 2) : '');
    const [id, setId] = useState<string>(initialId || '');
    const [status, setStatus] = useState<string>('');
    const [showJson, setShowJson] = useState<boolean>(false);

    const currentTemplates = templates[collection] || {};

    const handleTemplateChange = (templateKey: string) => {
        setSelectedTemplate(templateKey);
        if (templateKey && currentTemplates[templateKey]) {
            setFormData(JSON.stringify(currentTemplates[templateKey], null, 2));
        } else {
            setFormData('');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id || !formData) return;

        setStatus('Saving...');
        try {
            const data = JSON.parse(formData);
            const result = await addDocument(collection, id, data);

            if (result.success) {
                setStatus('Success! Document added.');
                // clear form?
            } else {
                setStatus(`Error: ${result.error}`);
            }
        } catch (err: any) {
            setStatus(`Invalid JSON: ${err.message}`);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="block text-sm font-medium mb-2">Collection Type</label>
                    <select
                        value={collection}
                        onChange={(e) => {
                            setCollection(e.target.value as CollectionType);
                            setSelectedTemplate('');
                            setFormData('');
                        }}
                        className="w-full p-2 rounded border bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                    >
                        <option value="characters">Characters</option>
                        <option value="weapons">Weapons</option>
                        <option value="materials">Materials</option>
                        <option value="outfits">Outfits</option>
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium mb-2">Select Template</label>
                    <select
                        value={selectedTemplate}
                        onChange={(e) => handleTemplateChange(e.target.value)}
                        className="w-full p-2 rounded border bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                    >
                        <option value="">-- Choose a Template --</option>
                        {Object.keys(currentTemplates).map((key) => (
                            <option key={key} value={key}>
                                {key}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium mb-2">Document ID (Entry Key)</label>
                <input
                    type="text"
                    value={id}
                    onChange={(e) => setId(e.target.value)}
                    placeholder="e.g. MyNewCharacter"
                    className="w-full p-2 rounded border bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                    required
                />
                <p className="text-xs text-zinc-500 mt-1">This will be the document ID in Firestore.</p>
            </div>

            <div>
                <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium">Entry Data</label>
                    <button
                        type="button"
                        onClick={() => setShowJson(!showJson)}
                        className="text-xs text-blue-600 hover:underline"
                    >
                        {showJson ? 'Switch to Form View' : 'View Raw JSON'}
                    </button>
                </div>

                {showJson ? (
                    <textarea
                        value={formData}
                        onChange={(e) => setFormData(e.target.value)}
                        rows={20}
                        className="w-full p-2 rounded border bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 font-mono text-sm"
                    />
                ) : (
                    <div className="p-4 border rounded bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800">
                        <DynamicForm
                            data={formData ? JSON.parse(formData) : {}}
                            onChange={(newData) => setFormData(JSON.stringify(newData, null, 2))}
                        />
                    </div>
                )}
            </div>

            <div className="flex items-center justify-between">
                <button
                    type="submit"
                    disabled={status === 'Saving...'}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                    Save Entry
                </button>
                {status && <span className="text-sm font-medium">{status}</span>}
            </div>
        </form>
    );
}
