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

let asiacode = prompt("Enter Asia Code: ");
let eucode = prompt("Enter EU Code (Leave empty if same as Asia): ");
let nacode = prompt("Enter NA Code (Leave empty if same as Asia): ");

if (!eucode) eucode = asiacode;
if (!nacode) nacode = asiacode;

let expiry = null;
while (!expiry) {
    let expireStr = prompt("Has it expired (y/n)?: ");
    if (expireStr.toLowerCase() === 'n') expiry = false;
    else if (expireStr.toLowerCase() === 'y') expiry = true;
}

let description = prompt("What does the code give? (Write in a single line seperated by commas): ");

let date = 'no';
let dateStr = '';
while (isNaN(date)) {
    dateStr = prompt("Date of code added in UTC (dd MMM yy format, example: 13 Nov 2020): ");
    date = Date.parse(dateStr + ' UTC');
    if (isNaN(date)) console.log("Invalid date. Please follow format");
}

let notify = false;
let notifyStr = prompt("Do we notify users? (y/[n]): ");
if (notifyStr.toLowerCase() === 'y') notify = true;

// Add to DB
let code = { dateString: dateStr, reward: description, expired: expiry, eu: eucode, na: nacode, asia: asiacode, date: date, notify: notify};

console.log('Adding the following data to DB');
console.log(code);

async function addCode(code) {
    await db.ref(`codes/${code.asia}`).update({...code, source: 'manual'}, (error) => {
        if (error) {
            console.log(`ERROR: Fail to update code on DB (Key: ${code.asia}) [${error}]`);
        } else {
            console.log(`Code key ${code.asia} added to DB`);
        }
    });
}

async function notifyUser(code) {
    console.log('Notifying users. WIP');
    // TODO: Notify users
}

addCode(code).then(async () => {
    if (code.notify) await notifyUser(code);
    console.log("Shutting down");
})


