
import 'server-only';
import * as admin from 'firebase-admin';

interface FirebaseAdminConfig {
    projectId: string;
    clientEmail: string;
    privateKey: string;
}

function formatPrivateKey(privateKey: string) {
    return privateKey.replace(/\\n/g, '\n');
}

export function createFirebaseAdminApp() {
    if (admin.apps.length > 0) {
        return admin.apps[0]!;
    }

    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;

    if (!serviceAccount) {
        throw new Error('FIREBASE_SERVICE_ACCOUNT environment variable is not set');
    }

    let config: any;

    try {
        // Try parsing as JSON string (e.g. from Vercel env var)
        config = JSON.parse(serviceAccount);
    } catch (e) {
        console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT as JSON', e);
        throw new Error('Invalid FIREBASE_SERVICE_ACCOUNT format');
    }

    // Handle standard Service Account JSON format (snake_case)
    const projectId = config.projectId || config.project_id;
    const clientEmail = config.clientEmail || config.client_email;
    const privateKey = config.privateKey || config.private_key;

    if (!projectId || !clientEmail || !privateKey) {
        console.error('Missing required Firebase config values. Keys found:', Object.keys(config));
        throw new Error('Invalid Firebase Service Account Config: Missing projectId, clientEmail, or privateKey');
    }

    return admin.initializeApp({
        credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey: formatPrivateKey(privateKey),
        }),
        databaseURL: `https://${projectId}-default-rtdb.firebaseio.com`,
        storageBucket: `${projectId}.appspot.com`,
    });
}

export function getFirestore() {
    const app = createFirebaseAdminApp();
    return app.firestore();
}

export function getDatabase() {
    const app = createFirebaseAdminApp();
    return app.database();
}

export function getStorage() {
    const app = createFirebaseAdminApp();
    return app.storage();
}
