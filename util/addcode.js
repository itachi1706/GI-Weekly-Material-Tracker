// Firebase
const admin = require("firebase-admin");

const prompt = require('prompt-sync')({sigint: true});

// Fetch the service account key JSON file contents
const serviceAccount = require('./serviceAccountKey.json');

// Initialize the app with a service account, granting admin privileges
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://gi-weekly-material-tracker-default-rtdb.firebaseio.com/"
});

// As an admin, the app has access to read and write all data, regardless of Security Rules
const db = admin.database();

let isCode = null;
while (isCode == null) {
    let isCodeStr = prompt("Is it a Promo Code or a URL? (code/url): ");
    if (isCodeStr.toLowerCase() === 'code') isCode = true;
    else if (isCodeStr.toLowerCase() === 'url') isCode = false;
}

let asiacode, eucode, nacode, codeurl, urlexpiry;
let insertTime = new Date().getTime();

if (isCode) {
    asiacode = prompt("Enter Asia Code: ");
    eucode = prompt("Enter EU Code (Leave empty if same as Asia): ");
    nacode = prompt("Enter NA Code (Leave empty if same as Asia): ");

    if (!eucode) eucode = asiacode;
    if (!nacode) nacode = asiacode;
} else {
    codeurl = prompt("Enter Promo Code URL: ");
    urlexpiry = prompt("Enter URL Expiry if known: ");
    if (!urlexpiry) urlexpiry = 'Unknown';
}

let expiry = null;
while (expiry == null) {
    let expireStr = prompt("Has it expired (y/n)?: ");
    if (expireStr.toLowerCase() === 'n') expiry = false;
    else if (expireStr.toLowerCase() === 'y') expiry = true;
}

let description = prompt("What does the code give? (Write in a single line seperated by commas): ");

let date = 'no';
let dateStr = '';
while (Number.isNaN(date)) {
    dateStr = prompt("Date of code added in UTC (dd MMM yy format, example: 13 Nov 2020): ");
    date = Date.parse(dateStr + ' UTC');
    if (Number.isNaN(date)) console.log("Invalid date. Please follow format");
}

let notify = false;
let notifyStr = prompt("Do we notify users? (y/[n]): ");
if (notifyStr.toLowerCase() === 'y') notify = true;

// Add to DB
let code, key;
if (isCode) {
    console.log('Crafting Code Data');
    code = { dateString: dateStr, reward: description, expired: expiry, eu: eucode, na: nacode, asia: asiacode, date: date, notify: notify, type: 'code'};
    key = code.asia;
} else {
    console.log('Craft URL Data');
    code = { dateString: dateStr, reward: description, expired: expiry, url: codeurl, expiry: urlexpiry, date: date, notify: notify, type: 'url'};
    key = `url_${insertTime}`;
}


console.log(`Adding the following data to DB with key ${key}`);
console.log(code);

async function addCode(code, key) {
    await db.ref(`codes/${key}`).update({...code, source: 'manual'}, (error) => {
        if (error) {
            console.log(`ERROR: Fail to update code on DB (Key: ${key}) [${error}]`);
        } else {
            console.log(`Code key ${key} added to DB`);
        }
    });
}

async function notifyUser(code) {
    console.log('Notifying users. WIP');
    // TODO: Notify users
}

addCode(code, key).then(async () => {
    if (code.notify) await notifyUser(code);
    console.log("Shutting down");
    process.exit();
})


