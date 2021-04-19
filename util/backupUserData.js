const firestore = require('firestore-export-import');
const serviceAccount = require('./serviceAccountKey.json');
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

firestore.initializeApp(serviceAccount);
const firestoreAdmin = admin.firestore();

firestore.backup('userdata').then((data) => {
    fs.writeFileSync('userdata.json', JSON.stringify(data));
});

