/**
 * PRE REQUISITE
 * npm run preProcessUsage
 * Move weapon/character json to a folder called temp
 * Create a folder called process and move the Materials.json files into it
 * Create a folder called output
 * npm run processUsage
 *
 * CI
 * Create folder local
 * Copy Weapons-*.json and Characters-*.json into local
 * npm run preProcessUsageLocal
 * Move Materials.json files into process folder
 * npm run processUsage
 * Copy output files back into import folder
 */

const fs = require('fs')

// Read temp/characters.json
const characters = JSON.parse(fs.readFileSync("temp/characters.json", "utf8"));

// Read temp/weapons.json
const weapons = JSON.parse(fs.readFileSync("temp/weapons.json", "utf8"));

// For each file in process folder, read and write to file
const files = fs.readdirSync("process");
for (const file of files) {
    const data = fs.readFileSync(`process/${file}`, "utf8");
    const mats = JSON.parse(data);

    // For each material, add to usage/characters if found in character
    for (const matKey in mats.materials) {
        console.log("Processing", matKey)
        let mat = mats.materials[matKey];

        // If material usage json exists, reset it
        mat.usage = {
            characters: [],
            weapons: []
        };

        // Checking character
        for (const characterKey in characters.characters) {
            console.log("Checking Character", characterKey)
            let char = characters.characters[characterKey];
            console.log("Check Ascension Materials");
            let found =false;
            for (const ascensionKey in char.ascension) {
                let ascend = char.ascension[ascensionKey];
                if (ascend.material1 == matKey || ascend.material2 == matKey || ascend.material3 == matKey || ascend.material4 == matKey) {
                    // Add to material's usage
                    mat.usage.characters.push(characterKey);
                    found = true
                    break; // We don't need process further once we found a match
                }
            }

            if (found) {
                break;
            }

            // Check Talent Ascension
            console.log("Check Talent Ascension Materials");
            for (const talentKey in char.talents.ascension) {
                let ascend = char.talents.ascension[talentKey];
                if (ascend.material1 == matKey || ascend.material2 == matKey || ascend.material3 == matKey || ascend.material4 == matKey) {
                    // Add to material's usage
                    mat.usage.characters.push(characterKey);
                    break; // We don't need process further once we found a match
                }
            }
        }

        // Checking weapons
        for (const weaponKey in weapons.weapons) {
            console.log("Checking Weapon", weaponKey)
            let wep = weapons.weapons[weaponKey];
            console.log("Check Ascension Materials");
            for (const ascensionKey in wep.ascension) {
                let ascend = wep.ascension[ascensionKey];
                if (ascend.material1 == matKey || ascend.material2 == matKey || ascend.material3 == matKey) {
                    // Add to material's usage
                    mat.usage.weapons.push(weaponKey);
                    break; // We don't need process further once we found a match
                }
            }
        }

    }

    const newData = JSON.stringify(mats);


    fs.writeFileSync(`output/${file}`, newData);
}
