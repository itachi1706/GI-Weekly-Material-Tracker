const firestore = require('firestore-export-import');
const serviceAccount = require('./serviceAccountKey.json');
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

firestore.initializeApp(serviceAccount);
const firestoreAdmin = admin.firestore();

firestore.backup('tracking').then((data) => {
    fs.writeFileSync('tracking.json', JSON.stringify(data));
});

