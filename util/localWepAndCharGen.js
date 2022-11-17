let fs = require('fs');

var characters = {characters: {}};
var weapons = {weapons: {}};

var charTmp = [];
var wepTmp = [];

// For each file in local folder, read and write to object
const files = fs.readdirSync("local");
for (const file of files) {
    const fileData = fs.readFileSync(`local/${file}`, "utf8");
    const fD = JSON.parse(fileData);

    if ("characters" in fD) {
        for (var c in fD.characters) {
            charTmp.push([c, fD.characters[c]]);
        }
    }

    if ("weapons" in fD) {
       for (var c in fD.weapons) {
            wepTmp.push([c, fD.weapons[c]]);
        }
    }
}

// Sort chartmp ascending
charTmp.sort(function(a, b) {
    return a[0].localeCompare(b[0]);
});

// Sort weptmp ascending
wepTmp.sort(function(a, b) {
    return a[0].localeCompare(b[0]);
});

// Add sorted arrays to objects
charTmp.forEach((item) => {
    characters.characters[item[0]] = item[1];
});

wepTmp.forEach((item) => {
    weapons.weapons[item[0]] = item[1];
});

// Check if temp folder exists, otherwise create it
if (!fs.existsSync("temp")) {
    fs.mkdirSync("temp");
}

// Auto create process and output folders as well
if (!fs.existsSync("process")) {
    fs.mkdirSync("process");
}

if (!fs.existsSync("output")) {
    fs.mkdirSync("output");
}

// Write to temp/characters.json
fs.writeFileSync("temp/characters.json", JSON.stringify(characters));
// Write to temp/weapons.json
fs.writeFileSync("temp/weapons.json", JSON.stringify(weapons));
