
import path from 'path';
import fs from 'fs/promises';
import { CollectionType } from '@/types/schema';

const TEMPLATES_DIR = path.join(process.cwd(), 'src/data/templates');

export async function readTemplateFile(filename: string) {
    const filePath = path.join(TEMPLATES_DIR, filename);
    try {
        const data = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Error reading template file ${filename}:`, error);
        return {};
    }
}

export async function getTemplates(type: CollectionType) {
    const filename = `${type}.json`;
    return await readTemplateFile(filename);
}

export async function getAllTemplates() {
    const [characters, weapons, materials, outfits] = await Promise.all([
        getTemplates('characters'),
        getTemplates('weapons'),
        getTemplates('materials'),
        getTemplates('outfits'),
    ]);

    return {
        characters,
        weapons,
        materials,
        outfits,
    };
}
