
'use server';

import { getTemplates as getTemplatesLib, getAllTemplates as getAllTemplatesLib } from '@/lib/templates';
import { CollectionType } from '@/types/schema';

export async function getTemplates(type: CollectionType) {
    return await getTemplatesLib(type);
}

export async function getAllTemplates() {
    return await getAllTemplatesLib();
}
