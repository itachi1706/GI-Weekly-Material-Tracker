const firestore = require('firestore-export-import');
const serviceAccount = require('./serviceAccountKey.json');

firestore.initializeApp(serviceAccount);

console.log("Beginning Restore of Materials, Characters and Weapons");
firestore.restore('characters.json', {
    refs: ['refKey', 'arrayRef'],
}).then(() => {console.log("Character restore Complete!")});

firestore.restore('materials.json', {
    refs: ['refKey', 'arrayRef'],
}).then(() => {console.log("Materials restore Complete!")});

firestore.restore('weapons.json', {
    refs: ['refKey', 'arrayRef'],
}).then(() => {console.log("Weapons restore Complete!")});