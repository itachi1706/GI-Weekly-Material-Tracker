const fetch = require('node-fetch');
const parser = require('node-html-parser');

// Firebase
const admin = require("firebase-admin");

// Fetch the service account key JSON file contents
const serviceAccount = require('./serviceAccountKey.json');

// Initialize the app with a service account, granting admin privileges
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://gi-weekly-material-tracker-default-rtdb.firebaseio.com/"
});

// As an admin, the app has access to read and write all data, regardless of Security Rules
const db = admin.database();

console.log(">>> Crawling for Promo Codes");
fetch('https://www.gensh.in/events/promotion-codes')
.then(res => res.text())
.then(async text => {
    // Debug
    //console.log(text);

    const root = parser.parse(text);
    let table = root.querySelector(".ce-table-bordered");
    let tableBody = table.querySelector("tbody");
    let td = tableBody.querySelectorAll("td");
    console.log(`Cell Count: ${td.length}`);

    console.log(">>> Cleaning crawled codes");
    td = td.map(s => s.removeWhitespace());

    console.log(">>> Saving codes crawled to array");
    let codes = [];
    for (let i = 0; i < td.length; i+=6) {
        let code = { dateString: td[i].text.trim(), reward: td[i+1].text.trim(), expired: td[i+2].text.trim(), eu: td[i+3].text.trim(), na: td[i+4].text.trim(), asia: td[i+5].text.trim() };
        if (code.expired.toLowerCase().startsWith('yes')) {
            code.expired = true;
            code.notify = false;
        } else {
            code.expired = false;
            code.notify = true;
        }
        codes.push(code);
    }

    console.log(">>> Adding UTC date to code array");
    codes.forEach(c => c.date=Date.parse(c.dateString + ' UTC'));

    console.log(">>> Codes Crawled:");
    console.log(JSON.stringify(codes));

    console.log(">>> Update Firebase DB");

    for (let code of codes) {
        console.log(`>> Adding ${code.dateString}'s code for ${code.reward} (Asia Code as Key: ${code.asia})`);
        await db.ref(`codes/${code.asia}`).update({...code, source: 'crawler'}, (error) => {
            if (error) {
                console.log(`>> ERROR: Fail to update code on DB (Key: ${code.asia}) [${error}]`);
            } else {
                console.log(`>> Code key ${code.asia} updated on DB`);
            }
        });
    }

    console.log(">>> Update complete")

    // TODO: Process any promo codes to notify users on
    process.exit(0);
});

