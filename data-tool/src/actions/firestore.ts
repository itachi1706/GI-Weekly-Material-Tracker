
'use server';

import { getFirestore } from '@/lib/firebase-admin';
import { revalidatePath } from 'next/cache';

export async function getCollectionData(collectionName: string): Promise<any[]> {
    try {
        const db = getFirestore();
        const snapshot = await db.collection(collectionName).get();

        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        console.error(`Error fetching collection ${collectionName}:`, error);
        throw new Error(`Failed to fetch ${collectionName}`);
    }
}

export async function getDocument(collectionName: string, id: string) {
    try {
        const db = getFirestore();
        const doc = await db.collection(collectionName).doc(id).get();
        if (!doc.exists) return null;
        return { id: doc.id, ...doc.data() };
    } catch (error: any) {
        console.error(`Error fetching document ${id} from ${collectionName}:`, error);
        throw new Error(`Failed to fetch document ${id}`);
    }
}

export async function addDocument(collectionName: string, id: string, data: any) {
    try {
        const db = getFirestore();
        const docRef = db.collection(collectionName).doc(id);

        // Check if exists
        const doc = await docRef.get();
        if (doc.exists) {
            throw new Error(`Document with ID ${id} already exists`);
        }

        await docRef.set(data);
        revalidatePath('/'); // Revalidate globally or smarter path later
        return { success: true, id };
    } catch (error: any) {
        console.error(`Error adding document to ${collectionName}:`, error);
        return { success: false, error: error.message };
    }
}

export async function updateDocument(collectionName: string, id: string, data: any) {
    try {
        const db = getFirestore();
        await db.collection(collectionName).doc(id).update(data);
        revalidatePath('/');
        return { success: true };
    } catch (error: any) {
        console.error(`Error updating document ${id} in ${collectionName}:`, error);
        return { success: false, error: error.message };
    }
}
