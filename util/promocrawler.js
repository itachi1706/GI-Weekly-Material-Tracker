const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
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
    // console.log(text);

    const root = parser.parse(text);
    let table = root.querySelectorAll(".promocode-row");
    console.log(`Cell Count: ${table.length}`);
    
    let codes = [];
    console.log(">>> Saving codes crawled to array");
    for (let row of table) {
        let child = row.childNodes;
        let dt = child[0].text.replace(".", "").trim();
        let reward = child[1].text.trim().split('  ').join(', ');
        let eu = child[2].text.trim();
        let na = child[3].text.trim();
        let asia = child[4].text.trim();

        // TODO: Try and get another source. Until we get said source, we would presume all code is expired
        let code = { dateString: dt, reward: reward, expired: true, eu: eu, na: na, asia: asia, type: 'code', notify: false };
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

