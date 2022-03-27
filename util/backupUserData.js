const {initializeFirebaseApp, backup} = require('firestore-export-import');
const serviceAccount = require('./serviceAccountKey.json');
const fs = require('fs');

initializeFirebaseApp(serviceAccount);

backup('userdata').then((data) => {
    fs.writeFileSync('userdata.json', JSON.stringify(data));
});

