const functions = require('firebase-functions');
const firestore = require('@google-cloud/firestore');
const client = new firestore.v1.FirestoreAdminClient();

const {initializeApp, applicationDefault, cert} = require('firebase-admin/app');
const {getFirestore} = require('firebase-admin/firestore');

const bucket = 'gs://gi-weekly-material-tracker-firestore-prod-backups';

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
    initializeApp();
    const firestoreDb = getFirestore();

    var finalUpdates = {};

    const weapons = await firestoreDb.collection('weapons').get();
    weapons.forEach((doc) => {
      console.log('Determining Last Seen for', doc.id);
      let weaponData = doc.data();
      let since = 0;
      let time = null;
      // Get rateupweapon array from each banner data ite,
      for (var item of bannerData) {
        console.log('Checking Banner:', item.name);
        let special = item.rateupweapon;
        if (special.includes(doc.id)) {
          // Its this one
          time = item.end;
          console.log('Found on', since, 'ended at', item.end);
          break;
        }
        since++;
      }

      if (time === null) {
        // Cannot find weapon, unset banners_since_last_appearance and date_since_last_appearance
        if (!("banners_since_last_appearance" in weaponData)) {
          delete weaponData.banners_since_last_appearance;
        }
        if (!("date_since_last_appearance" in weaponData)) {
          delete weaponData.date_since_last_appearance;
        }
      } else {
        weaponData.banners_since_last_appearance = since;
        weaponData.date_since_last_appearance = time;
      }
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