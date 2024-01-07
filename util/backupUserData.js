const {backup} = require('firestore-export-import');
const serviceAccount = require('./serviceAccountKey.json');
const fs = require('fs');
const { initializeApp, cert } = require('firebase-admin/app');
const {getFirestore} = require('firebase-admin/firestore');

initializeApp({
    credential: cert(serviceAccount)
});

const firestoreAdmin = getFirestore();

backup(firestoreAdmin, 'userdata').then((data) => {
    fs.writeFileSync('userdata.json', JSON.stringify(data));
});

