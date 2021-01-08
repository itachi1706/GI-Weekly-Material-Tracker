import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

final FirebaseFirestore _db = FirebaseFirestore.instance;
final FirebaseAuth _auth = FirebaseAuth.instance;

class TrackingData {

  static Future<bool> isBeingTracked(String key, String item) async {
    if (_auth.currentUser == null) return false;
    String uid = _auth.currentUser.uid;
    DocumentReference trackRef = _db.collection("tracking").doc(uid);
    DocumentSnapshot snapshot = await trackRef.get();
    Map<String, dynamic> fields = snapshot.data();
    if (fields == null || fields.length <= 0 || !fields.containsKey(key)) return false; // No tracking
    List<dynamic> _data = fields[key];
    return _data.contains(item);
  }

  static Future<void> addToRecord(String key, String item) async {
    if (_auth.currentUser == null) return;
    String uid = _auth.currentUser.uid;
    DocumentReference trackRef = _db.collection("tracking").doc(uid);
    DocumentSnapshot snapshot = await trackRef.get();
    if (snapshot.exists) await trackRef.update({key: FieldValue.arrayUnion([item])});
    else trackRef.set({key: [item]});
  }

  static void addToCollection(String key, String itemKey, int numToTrack, String materialType, String addType) async {
    if (_auth.currentUser == null) return;
    String uid = _auth.currentUser.uid;
    await _db.collection("tracking").doc(uid).collection(materialType).doc(key).set({
      "name": itemKey,
      "max": numToTrack,
      "current": 0,
      "type": materialType,
      "addedBy": addType,
    });
  }

  static Future<void> removeFromRecord(String key, String item) async {
    if (_auth.currentUser == null) return;
    String uid = _auth.currentUser.uid;
    DocumentReference trackRef = _db.collection("tracking").doc(uid);
    await trackRef.update({key: FieldValue.arrayRemove([item])});
  }

  static void removeFromCollection(String key, String materialType) async {
    if (_auth.currentUser == null) return;
    String uid = _auth.currentUser.uid;
    await _db.collection("tracking").doc(uid).collection(materialType).doc(key).delete();
  }

}