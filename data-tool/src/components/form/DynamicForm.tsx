
import { FieldRenderer } from './FieldRenderer';

interface DynamicFormProps {
    data: Record<string, any>;
    onChange: (newData: any) => void;
}

export default function DynamicForm({ data, onChange }: DynamicFormProps) {
    // If no data, return empty
    if (!data || Object.keys(data).length === 0) {
        return <div className="text-zinc-500 text-center py-8">Select a template to begin form editing</div>;
    }

    const handleChange = (key: string, value: any) => {
        onChange({
            ...data,
            [key]: value
        });
    };

    return (
        <div className="space-y-4">
            {Object.entries(data).map(([key, value]) => (
                <FieldRenderer
                    key={key}
                    fieldName={key}
                    value={value}
                    onChange={(newValue) => handleChange(key, newValue)}
                />
            ))}
        </div>
    );
}
