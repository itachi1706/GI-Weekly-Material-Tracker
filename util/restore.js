const {restore} = require('firestore-export-import');
const serviceAccount = require('./serviceAccountKey.json');
const {getFirestore} = require('firebase-admin/firestore');
const fs = require('fs');
const path = require('path');
const {deleteCollection} = require('./firebaseutil');
const { initializeApp, cert } = require('firebase-admin/app');

initializeApp({
    credential: cert(serviceAccount)
});
const firestoreAdmin = getFirestore();

async function deleteCollections(fireStoreAdm) {
    console.log(">>> Deleting Existing public weapon, characters and materials data");
    await deleteCollection(fireStoreAdm, 'weapons', 50);
    await deleteCollection(fireStoreAdm, 'characters', 50);
    await deleteCollection(fireStoreAdm, 'materials', 50);
    await deleteCollection(fireStoreAdm, 'outfits', 50);
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
        try {
            await restore(firestoreAdmin, `import/${file}`);
            console.log(`>>> ${fn} restore completed!`);
        } catch (err) {
            console.log(err);
            console.log(`>>> ${fn} restore failed!`);
        }
    }
    console.log(">>> Data Update Complete!");
}

console.log(">>> Starting Script");
deleteCollections(firestoreAdmin).then(() => {restoreData().then(() => {console.log(">>> Script Complete");});});
