
import { useState } from 'react';

interface FieldRendererProps {
    fieldName: string;
    value: any;
    onChange: (newValue: any) => void;
    level?: number;
}

export function FieldRenderer({ fieldName, value, onChange, level = 0 }: FieldRendererProps) {
    // 1. Array Handling
    if (Array.isArray(value)) {
        return (
            <div className={`mb-4 border-l-2 border-zinc-200 dark:border-zinc-700 pl-4 py-2 ${level > 0 ? 'ml-2' : ''}`}>
                <div className="flex justify-between items-center mb-2">
                    <label className="font-semibold text-sm capitalize">{formatLabel(fieldName)}</label>
                    <button
                        type="button"
                        onClick={() => onChange([...value, ''])} // Default to empty string for now
                        className="text-xs px-2 py-1 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded"
                    >
                        + Add Item
                    </button>
                </div>
                {value.map((item, index) => (
                    <div key={index} className="flex gap-2 mb-2">
                        <input
                            type="text"
                            value={item} // Assuming array of strings for now
                            onChange={(e) => {
                                const newArray = [...value];
                                newArray[index] = e.target.value;
                                onChange(newArray);
                            }}
                            className="flex-1 p-2 text-sm border rounded dark:bg-zinc-800 dark:border-zinc-700"
                        />
                        <button
                            type="button"
                            onClick={() => {
                                const newArray = value.filter((_, i) => i !== index);
                                onChange(newArray);
                            }}
                            className="text-red-500 hover:text-red-700 px-2"
                        >
                            ×
                        </button>
                    </div>
                ))}
            </div>
        );
    }

    // 2. Object Handling (Recursive)
    if (typeof value === 'object' && value !== null) {
        return (
            <div className={`mb-4 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden ${level > 0 ? 'mt-4' : ''}`}>
                <div className="bg-zinc-50 dark:bg-zinc-900 px-4 py-2 border-b border-zinc-200 dark:border-zinc-800">
                    <span className="font-semibold text-sm capitalize">{formatLabel(fieldName)}</span>
                </div>
                <div className="p-4">
                    {Object.entries(value).map(([key, subValue]) => (
                        <FieldRenderer
                            key={key}
                            fieldName={key}
                            value={subValue}
                            onChange={(newValue) => {
                                onChange({ ...value, [key]: newValue });
                            }}
                            level={level + 1}
                        />
                    ))}
                </div>
            </div>
        );
    }

    // 3. Primitive Handling
    const label = formatLabel(fieldName);

    // Boolean
    if (typeof value === 'boolean') {
        return (
            <div className="mb-4 flex items-center justify-between p-2 border rounded dark:border-zinc-700">
                <label className="text-sm font-medium">{label}</label>
                <input
                    type="checkbox"
                    checked={value}
                    onChange={(e) => onChange(e.target.checked)}
                    className="w-5 h-5 accent-blue-600"
                />
            </div>
        );
    }

    // Number
    if (typeof value === 'number') {
        return (
            <div className="mb-4">
                <label className="block text-xs font-medium text-zinc-500 mb-1">{label}</label>
                <input
                    type="number"
                    value={value}
                    onChange={(e) => onChange(Number(e.target.value))}
                    className="w-full p-2 text-sm border rounded dark:bg-zinc-800 dark:border-zinc-700"
                />
            </div>
        );
    }

    // String (Text Area vs Input)
    const isLongText = fieldName.toLowerCase().includes('description') || fieldName.toLowerCase().includes('intro') || fieldName.toLowerCase().includes('effect');

    return (
        <div className="mb-4">
            <label className="block text-xs font-medium text-zinc-500 mb-1">{label}</label>
            {isLongText ? (
                <textarea
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    rows={3}
                    className="w-full p-2 text-sm border rounded dark:bg-zinc-800 dark:border-zinc-700 font-sans"
                />
            ) : (
                <input
                    type="text"
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full p-2 text-sm border rounded dark:bg-zinc-800 dark:border-zinc-700"
                />
            )}
        </div>
    );
}

function formatLabel(key: string) {
    // Convert camelCase or snake_case to Title Case
    return key
        .replace(/([A-Z])/g, ' $1')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase())
        .trim();
}
