const {initializeFirebaseApp, restore} = require('firestore-export-import');
const serviceAccount = require('./serviceAccountKey.json');
const {getFirestore} = require('firebase-admin/firestore');
const fs = require('fs');
const path = require('path');

initializeFirebaseApp(serviceAccount);
const firestoreAdmin = getFirestore();

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
    console.log(">>> Deleting Existing templates");
    await deleteCollection(fireStoreAdm, 'templates', 50);
    console.log(">>> Existing template data deleted successfully!")
}

async function restoreData() {
    let files = fs.readdirSync('./templates');

    const EXTENSION = ".json";
    let jsonFiles = files.filter((file) => {return path.extname(file).toLowerCase() === EXTENSION});

    let finalData = {templates: {}};

    console.log(">>> Retrieving Files and adding to data");
    for (const file of jsonFiles) {
        let content = fs.readFileSync(`./templates/${file}`, 'utf8');
        let json = JSON.parse(content);
        // console.log(json);
        for (let prop in json) {
            console.log(`>>> Adding ${prop} to list`);
            finalData.templates[prop] = json[prop];
        }
    }

    console.log(">>> Updating data...");
    try {
        await restore(finalData);
        console.log("Template restore completed!");
    } catch (err) {
        console.log(err);
        console.log('Template restore failed!');
    }
    // for (const file of jsonFiles) {
    //     let fn = file.replace(".json", "");
    //     console.log(fn);

    //     console.log(`>>> Restoring ${fn}...`);
    //     try {
    //         await restore(`import/${file}`);
    //         console.log(`>>> ${fn} restore completed!`);
    //     } catch (err) {
    //         console.log(err);
    //         console.log(`>>> ${fn} restore failed!`);
    //     }
    // }
    console.log(">>> Data Update Complete!");
}

console.log(">>> Starting Script");
deleteCollections(firestoreAdmin).then(() => {restoreData().then(() => {console.log(">>> Script Complete");});});
