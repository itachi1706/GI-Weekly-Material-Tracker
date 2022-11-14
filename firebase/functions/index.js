const functions = require('firebase-functions');
const firestore = require('@google-cloud/firestore');
const client = new firestore.v1.FirestoreAdminClient();

const {initializeApp} = require('firebase-admin/app');
const {getFirestore} = require('firebase-admin/firestore');
const {getDatabase} = require('firebase-admin/database');

const bucket = 'gs://gi-weekly-material-tracker-firestore-prod-backups';
initializeApp();

exports.scheduledFirestoreExport = functions.pubsub.schedule('every 24 hours').onRun((context) => {
  const projectId = process.env.GCP_PROJECT || process.env.GCLOUD_PROJECT;
  const databaseName = 
    client.databasePath(projectId, '(default)');

  return client.exportDocuments({
    name: databaseName,
    outputUriPrefix: bucket,
    // Leave collectionIds empty to export all collections
    // or set to a list of collection IDs to export,
    // collectionIds: ['users', 'posts']
    collectionIds: []
    })
  .then(responses => {
    const response = responses[0];
    console.log(`Operation Name: ${response['name']}`);
    return;
  })
  .catch(err => {
    console.error(err);
    throw new Error('Export operation failed');
  });
});

exports.updateWeaponsLastSeen = functions.database.ref('/banners/weapon').onWrite(
  async (snapshot, context) => {
    // Don't run if its deleted
    if (!snapshot.after.exists()) {
      console.log("List deleted. Not doing anything to it");
      return null;
    }

    const bannerData = snapshot.after.val();
    // Get firestore data
    const firestoreDb = getFirestore();

    var finalUpdates = {};

    const weapons = await firestoreDb.collection('weapons').get();
    weapons.forEach((doc) => {
      console.log('Determining Last Seen for', doc.id);
      let weaponData = doc.data();
      let since = 0;
      let time = null;
      let bannerName = null;
      // Get rateupweapon array from each banner data ite,
      for (var item of bannerData) {
        // console.log('[DBG] Checking Banner:', item.name);
        let special = item.rateupweapon;
        if (special.includes(doc.id)) {
          // Its this one
          time = item.end;
          bannerName = item.name;
          console.log('Found', doc.id, 'in', item.name, '#', since, 'ended at', item.end);
          break;
        }
        since++;
      }

      if (time === null) {
        console.log('Unable to find a rate up appearance for', doc.id);
        // Cannot find weapon, unset banners_since_last_appearance and date_since_last_appearance
        if (!("banners_since_last_appearance" in weaponData)) {
          delete weaponData.banners_since_last_appearance;
        }
        if (!("date_since_last_appearance" in weaponData)) {
          delete weaponData.date_since_last_appearance;
        }
        if (!("banners_since_last_appearance_name" in weaponData)) {
          delete weaponData.banners_since_last_appearance_name;
        }
      } else {
        weaponData.banners_since_last_appearance = since;
        weaponData.date_since_last_appearance = time;
        weaponData.banners_since_last_appearance_name = bannerName;
      }
      weaponData.bsla = Date.now();
      finalUpdates[doc.id] = weaponData;
    });

    // Update all data in finalUpdates
    console.log("Has", Object.keys(finalUpdates).length, "items to update");
    var batch = firestoreDb.batch();
    for (var dt in finalUpdates) {
      console.log("Updating Weapon", dt);
      batch.set(firestoreDb.collection('weapons').doc(dt), finalUpdates[dt])
    }
    await batch.commit();
    console.log("Update complete");
    return null;
  });

exports.updateCharactersLastSeen = functions.database.ref('/banners/character').onWrite(
  async (snapshot, context) => {
    // Don't run if its deleted
    if (!snapshot.after.exists()) {
      console.log("List deleted. Not doing anything to it");
      return null;
    }

    const bannerData = snapshot.after.val();
    // Get firestore data
    const firestoreDb = getFirestore();

    var finalUpdates = {};

    const characters = await firestoreDb.collection('characters').get();
    characters.forEach((doc) => {
      console.log('Determining Last Seen for', doc.id);
      let characterData = doc.data();
      let since = 0;
      let time = null;
      let bannerName = null;
      // Get rateupcharacters array from each banner data ite,
      for (var item of bannerData) {
        // console.log('[DBG] Checking Banner:', item.name);
        let special = item.rateupcharacters;
        if (special.includes(doc.id)) {
          // Its this one
          time = item.end;
          bannerName = item.name;
          console.log('Found', doc.id, 'in', item.name, '#', since, 'ended at', item.end);
          break;
        }
        since++;
      }

      if (time === null) {
        console.log('Unable to find a rate up appearance for', doc.id);
        // Cannot find character, unset banners_since_last_appearance and date_since_last_appearance
        if (!("banners_since_last_appearance" in characterData)) {
          delete characterData.banners_since_last_appearance;
        }
        if (!("date_since_last_appearance" in characterData)) {
          delete characterData.date_since_last_appearance;
        }
        if (!("banners_since_last_appearance_name" in characterData)) {
          delete characterData.banners_since_last_appearance_name;
        }
      } else {
        characterData.banners_since_last_appearance = since;
        characterData.date_since_last_appearance = time;
        characterData.banners_since_last_appearance_name = bannerName;
      }
      characterData.bsla = Date.now();
      finalUpdates[doc.id] = characterData;
    });

    // Update all data in finalUpdates
    console.log("Has", Object.keys(finalUpdates).length, "items to update");
    var batch = firestoreDb.batch();
    for (var dt in finalUpdates) {
      console.log("Updating Character", dt);
      batch.set(firestoreDb.collection('characters').doc(dt), finalUpdates[dt])
    }
    await batch.commit();
    console.log("Update complete");
    return null;
  });

exports.updateCharacterLastSeen = functions.firestore.document('characters/{charKey}').onWrite(async (change, context) => {
  var key = context.params.charKey;
  if (!change.after.exists) {
    // Do not operate
    console.log("Character", key, "deleted. We do not update it");
    return null;
  }
  const charData = change.after.data();
  // We need to prevent repeat updates by checking banners_since_last_appearance
  if (change.before.exists && "bsla" in change.before.data() && "bsla" in charData && change.before.data().bsla !== charData.bsla) {
    console.log("Already ran. ignore");
    return null;
  }

  let since = 0;
  let time = null;
  let bannerName = null;

  // Get list of all banners in RTDB and process it
  const rtDb = getDatabase();
  const firestoreDb = getFirestore();
  const data = await rtDb.ref('banners/character').once('value');
  const banners = data.val();

  // Get rateupcharacters array from each banner data ite,
  for (var item of banners) {
    // console.log('[DBG] Checking Banner:', item.name);
    let special = item.rateupcharacters;
    if (special.includes(key)) {
      // Its this one
      time = item.end;
      bannerName = item.name;
      console.log('Found', key, 'in', item.name, '#', since, 'ended at', item.end);
      break;
    }
    since++;
  }

  if (time === null) {
    console.log('Unable to find a rate up appearance for', key);
    // Cannot find character, unset banners_since_last_appearance and date_since_last_appearance
    if (!("banners_since_last_appearance" in charData)) {
      delete charData.banners_since_last_appearance;
    }
    if (!("date_since_last_appearance" in charData)) {
      delete charData.date_since_last_appearance;
    }
    if (!("banners_since_last_appearance_name" in charData)) {
      delete charData.banners_since_last_appearance_name;
    }
  } else {
    charData.banners_since_last_appearance = since;
    charData.date_since_last_appearance = time;
    charData.banners_since_last_appearance_name = bannerName;
  }
  charData.bsla = Date.now();

  console.log("Updating Firestore Database for", key);
  await firestoreDb.collection('characters').doc(key).set(charData);
  console.log("Updated", key, "in Firestore Database");
  return null;
});

exports.updateWeaponLastSeen = functions.firestore.document('weapons/{wepKey}').onWrite(async (change, context) => {
  var key = context.params.wepKey;
  if (!change.after.exists) {
    // Do not operate
    console.log("Weapon", key, "deleted. We do not update it");
    return null;
  }
  const wepData = change.after.data();
  // We need to prevent repeat updates by checking banners_since_last_appearance
  if (change.before.exists && "bsla" in change.before.data() && "bsla" in wepData && change.before.data().bsla !== wepData.bsla) {
    console.log("Already ran. ignore");
    return null;
  }

  let since = 0;
  let time = null;
  let bannerName = null;

  // Get list of all banners in RTDB and process it
  const rtDb = getDatabase();
  const firestoreDb = getFirestore();
  const data = await rtDb.ref('banners/weapon').once('value');
  const banners = data.val();

  // Get rateupweapon array from each banner data ite,
  for (var item of banners) {
    // console.log('[DBG] Checking Banner:', item.name);
    let special = item.rateupweapon;
    if (special.includes(key)) {
      // Its this one
      time = item.end;
      bannerName = item.name;
      console.log('Found', key, 'in', item.name, '#', since, 'ended at', item.end);
      break;
    }
    since++;
  }

  if (time === null) {
    console.log('Unable to find a rate up appearance for', key);
    // Cannot find weapon, unset banners_since_last_appearance and date_since_last_appearance
    if (!("banners_since_last_appearance" in wepData)) {
      delete wepData.banners_since_last_appearance;
    }
    if (!("date_since_last_appearance" in wepData)) {
      delete wepData.date_since_last_appearance;
    }
    if (!("banners_since_last_appearance_name" in wepData)) {
      delete wepData.banners_since_last_appearance_name;
    }
  } else {
    wepData.banners_since_last_appearance = since;
    wepData.date_since_last_appearance = time;
    wepData.banners_since_last_appearance_name = bannerName;
  }
  wepData.bsla = Date.now();

  console.log("Updating Firestore Database for", key);
  await firestoreDb.collection('weapons').doc(key).set(wepData);
  console.log("Updated", key, "in Firestore Database");
  return null;
});
