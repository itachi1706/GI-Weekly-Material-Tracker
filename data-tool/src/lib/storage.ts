
import { getStorage } from '@/lib/firebase-admin';

export async function getImageUrl(path: string): Promise<string | null> {
    if (!path) return null;

    try {
        const bucket = getStorage().bucket();
        const file = bucket.file(path);

        // Generate a signed URL that expires in 1 hour
        const [url] = await file.getSignedUrl({
            action: 'read',
            expires: Date.now() + 60 * 60 * 1000,
        });

        console.log(`[DEBUG] Generated URL for ${path}: ${url?.substring(0, 50)}...`);
        return url;
    } catch (error) {
        console.error(`Error generating signed URL for ${path}:`, error);
        return null;
    }
}
