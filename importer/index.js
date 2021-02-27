const firestore = require('firestore-export-import');
const serviceAccount = require('./serviceAccountKey.json');
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

firestore.initializeApp(serviceAccount);
admin.initializeApp(serviceAccount);
const firestoreAdmin = admin.firestore();

async function deleteCollection(db, collectionPath, batchSize) {
    const query = db.collection(collectionPath).orderBy('__name__').limit(batchSize);
    return new Promise((resolve, reject) => {deleteQueryBatch(db, query, resolve).catch(reject);});
}

async function deleteQueryBatch(db, query, resolve) {
    const snapshot = await query.get();
    if (snapshot.size === 0) { resolve(); return; } // When there are no documents left, we are done

    // Delete documents in a batch
    const batch = db.batch();
    snapshot.docs.forEach((doc) => {batch.delete(doc.ref);});
    await batch.commit();

    // Recurse on the next process tick, to avoid exploding the stack.
    process.nextTick(() => {deleteQueryBatch(db, query, resolve);});
}

async function deleteCollections(fireStoreAdm) {
    console.log(">>> Deleting Existing public weapon, characters and materials data");
    await deleteCollection(fireStoreAdm, 'weapons', 50);
    await deleteCollection(fireStoreAdm, 'characters', 50);
    await deleteCollection(fireStoreAdm, 'materials', 50);
    console.log(">>> Existing public data deleted successfully!")
}

async function restoreData() {
    let files = fs.readdirSync('./import');

    const EXTENSION = ".json";
    let jsonFiles = files.filter((file) => {return path.extname(file).toLowerCase() === EXTENSION});

    console.log(">>> Updating data...");
    for (const file of jsonFiles) {
        let fn = file.replace(".json", "");
        console.log(fn);

        console.log(`>>> Restoring ${fn}...`);
        await firestore.restore(`import/${file}`);
        console.log(`>>> ${fn} restore completed!`);
    }
    console.log(">>> Data Update Complete!");
}

console.log(">>> Starting Script");
deleteCollections(firestoreAdmin).then(() => {restoreData().then(() => {console.log(">>> Script Complete");});});
