const firestore = require('firestore-export-import');
const serviceAccount = require('./serviceAccountKey.json');
const fs = require('fs');
const path = require('path');

firestore.initializeApp(serviceAccount);

let files = fs.readdirSync('./import');

const EXTENSION = ".json";
let jsonFiles = files.filter((file) => {return path.extname(file).toLowerCase() === EXTENSION});

console.log(">>> Updating data...");
jsonFiles.forEach(async (file) => {
    let fn = file.replace(".json", "");
    console.log(fn);

    console.log(`>>> Restoring ${fn}...`);
    await firestore.restore(`import/${file}`);
    console.log(`>>> ${fn} restore completed!`);
})
console.log(">>> Data Update Complete!");