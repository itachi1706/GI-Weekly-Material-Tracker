const {initializeFirebaseApp, backup} = require('firestore-export-import');
const serviceAccount = require('./serviceAccountKey.json');
const fs = require('fs');

initializeFirebaseApp(serviceAccount);

backup('weapons').then((data) => {
    fs.writeFileSync('weapons.json', JSON.stringify(data));
});

backup('characters').then((data) => {
    fs.writeFileSync('characters.json', JSON.stringify(data));
});
