
async function deleteCollection(db, collectionPath, batchSize) {
    const query = db.collection(collectionPath).orderBy('__name__').limit(batchSize);
    return new Promise((resolve, reject) => {deleteQueryBatch(db, query, resolve).catch(reject);});
}

async function deleteQueryBatch(db, query, resolve) {
    const snapshot = await query.get();
    if (snapshot.size === 0) { resolve(); return; } // When there are no documents left, we are done

    // Delete documents in a batch
    const batch = db.batch();
    snapshot.docs.forEach((doc) => {batch.delete(doc.ref);});
    await batch.commit();

    // Recurse on the next process tick, to avoid exploding the stack.
    process.nextTick(() => {deleteQueryBatch(db, query, resolve);});
}

module.exports.deleteCollection = deleteCollection;
module.exports.deleteQueryBatch = deleteQueryBatch;