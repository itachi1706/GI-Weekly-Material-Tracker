const {initializeFirebaseApp, restore} = require('firestore-export-import');
const serviceAccount = require('./serviceAccountKey.json');
const {getFirestore} = require('firebase-admin/firestore');
const fs = require('fs');
const path = require('path');
const {deleteCollection} = require('./firebaseutil');

initializeFirebaseApp(serviceAccount);
const firestoreAdmin = getFirestore();

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
    console.log(">>> Data Update Complete!");
}

console.log(">>> Starting Script");
deleteCollections(firestoreAdmin).then(() => {restoreData().then(() => {console.log(">>> Script Complete");});});
