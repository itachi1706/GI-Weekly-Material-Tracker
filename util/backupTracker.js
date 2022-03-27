const {initializeFirebaseApp, backup} = require('firestore-export-import');
const serviceAccount = require('./serviceAccountKey.json');
const fs = require('fs');

initializeFirebaseApp(serviceAccount);

backup('tracking').then((data) => {
    fs.writeFileSync('tracking.json', JSON.stringify(data));
});

