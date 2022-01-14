const admin = require('firebase-admin');
const fs = require('fs');

const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://gi-weekly-material-tracker-default-rtdb.firebaseio.com/"
});

const db = admin.database();

var ref = db.ref("banners");

// Get file
let file;
try {
    file = fs.readFileSync('./EventBanners.json');
} catch {
    console.error("Error reading EventBanners.json file");
    process.exit(1);
}

let fileContent = file.toString();
//console.log(fileContent);

let parsedJson;
try {
    parsedJson = JSON.parse(fileContent);
} catch {
    console.error("Error parsing JSON file");
    process.exit(2);
}
// console.log(parsedJson);

async function updateFiles(list, name, key) {
    console.log(`>>> Updating ${name} Banners`);
    ref.child(key).remove();
    await ref.child(key).set(list);
    // for (let banner of list) {
    //     console.log(`>> Updating ${banner.name}`);
    //     await ref.child(key).push(banner);
    // }

    console.log(`>>> Updated ${name} Banners!`);
}

async function processJson(parsedJson) {
    let standard = parsedJson.banners.standard;
    let eventWeapon = parsedJson.banners.weapon;
    let eventChars = parsedJson.banners.character;

    await updateFiles(standard, "Standard", "standard");
    await updateFiles(eventWeapon, "Weapon Event", "weapon");
    await updateFiles(eventChars, "Character Event", "character");
}

processJson(parsedJson).finally(() => {
    // Finish exit
    process.exit(0);
});