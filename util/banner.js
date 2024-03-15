const admin = require('firebase-admin');
const fs = require('fs');

const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://gi-weekly-material-tracker-default-rtdb.firebaseio.com/"
});

const db = admin.database();

const ref = db.ref("banners");

// Get file
let file;
try {
    file = fs.readFileSync('./EventBanners.json');
} catch {
    console.error("Error reading EventBanners.json file");
    process.exit(1);
}

let fileContent = file.toString();

let parsedJson;
try {
    parsedJson = JSON.parse(fileContent);
} catch {
    console.error("Error parsing JSON file");
    process.exit(2);
}

async function updateFiles(list, name, key) {
    console.log(`>>> Updating ${name} Banners`);
    ref.child(key).remove();
    await ref.child(key).set(list);

    console.log(`>>> Updated ${name} Banners!`);
}

async function processJson(jsonParsed) {
    let standard = jsonParsed.banners.standard;
    let eventWeapon = jsonParsed.banners.weapon;
    let eventChars = jsonParsed.banners.character;
    let chronicledWishes = jsonParsed.banners.chronicled;

    await updateFiles(standard, "Standard", "standard");
    await updateFiles(eventWeapon, "Weapon Event", "weapon");
    await updateFiles(eventChars, "Character Event", "character");
    await updateFiles(chronicledWishes, "Chronicled Wish Event", "chronicled");
}

processJson(parsedJson).finally(() => {
    // Finish exit
    process.exit(0);
});
