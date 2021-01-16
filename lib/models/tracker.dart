import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:gi_weekly_material_tracker/util.dart';

final FirebaseFirestore _db = FirebaseFirestore.instance;

enum TrackingStatus {
  UNKNOWN,
  CHECKING,
  NOT_TRACKED,
  TRACKED_INCOMPLETE_MATERIAL,
  TRACKED_COMPLETE_MATERIAL
}

class TrackingUtils {
  static Color getTrackingColor(
      int index, Map<String, TrackingStatus> _isBeingTracked) {
    if (!_isBeingTracked.keys.contains(index.toString()))
      return Colors.yellow; // No such key (loading)
    switch (_isBeingTracked[index.toString()]) {
      case TrackingStatus.UNKNOWN:
      case TrackingStatus.CHECKING:
      case TrackingStatus.NOT_TRACKED:
        return Get.theme.cardColor;
      case TrackingStatus.TRACKED_COMPLETE_MATERIAL:
        return (Util.themeNotifier.isDarkMode())
            ? Colors.green
            : Colors.lightGreen;
      case TrackingStatus.TRACKED_INCOMPLETE_MATERIAL:
        return (Util.themeNotifier.isDarkMode())
            ? Colors.indigo
            : Colors.lightBlue;
    }
    return Colors.yellow; // Error
  }
}

class TrackingData {
  static Future<List<dynamic>> getTrackingCategory(String key) async {
    String uid = Util.getFirebaseUid();
    if (uid == null) return null;
    DocumentReference trackRef = _db.collection("tracking").doc(uid);
    DocumentSnapshot snapshot = await trackRef.get();
    Map<String, dynamic> fields = snapshot.data();
    if (fields == null || fields.length <= 0 || !fields.containsKey(key))
      return null;
    return fields[key];
  }

  static Future<bool> isBeingTracked(String key, String item) async {
    List<dynamic> _data = await getTrackingCategory(key);
    if (_data == null) return false;

    return _data.contains(item);
  }

  static bool isBeingTrackedLocal(List<dynamic> _data, String item) {
    if (_data == null) return false;
    return _data.contains(item);
  }

  static Future<void> addToRecord(String key, String item) async {
    String uid = Util.getFirebaseUid();
    if (uid == null) return;
    DocumentReference trackRef = _db.collection("tracking").doc(uid);
    DocumentSnapshot snapshot = await trackRef.get();
    if (snapshot.exists)
      await trackRef.update({
        key: FieldValue.arrayUnion([item])
      });
    else
      trackRef.set({
        key: [item]
      });
  }

  static void incrementCount(
      String key, String type, int curCnt, int maxCnt) async {
    if (curCnt >= maxCnt) return; // Invalid action
    String uid = Util.getFirebaseUid();
    if (uid == null || key == null) return;

    await _db
        .collection("tracking")
        .doc(uid)
        .collection(type)
        .doc(key)
        .update({"current": FieldValue.increment(1)});
  }

  static void decrementCount(String key, String type, int curCnt) async {
    if (curCnt <= 0) return; // Invalid action
    String uid = Util.getFirebaseUid();
    if (uid == null || key == null) return;

    await _db
        .collection("tracking")
        .doc(uid)
        .collection(type)
        .doc(key)
        .update({"current": FieldValue.increment(-1)});
  }

  static void addToCollection(String key, String itemKey, int numToTrack,
      String materialType, String addType, String extraData) async {
    String uid = Util.getFirebaseUid();
    if (uid == null || itemKey == null) return;
    await _db
        .collection("tracking")
        .doc(uid)
        .collection(materialType)
        .doc(key)
        .set({
      "name": itemKey,
      "max": numToTrack,
      "current": 0,
      "type": materialType,
      "addedBy": addType,
      "addData": extraData
    });
  }

  static Future<void> removeFromRecord(String key, String item) async {
    String uid = Util.getFirebaseUid();
    if (uid == null) return;
    DocumentReference trackRef = _db.collection("tracking").doc(uid);
    await trackRef.update({
      key: FieldValue.arrayRemove([item])
    });
  }

  static void removeFromCollection(String key, String materialType) async {
    String uid = Util.getFirebaseUid();
    if (uid == null) return;
    await _db
        .collection("tracking")
        .doc(uid)
        .collection(materialType)
        .doc(key)
        .delete();
  }

  static Future<Map<String, dynamic>> getCollectionList(
      String materialType) async {
    String uid = Util.getFirebaseUid();
    QuerySnapshot snaps = await _db
        .collection("tracking")
        .doc(uid)
        .collection(materialType)
        .get();
    Map<String, dynamic> data = new Map();
    snaps.docs.forEach((element) {
      data.putIfAbsent(element.id, () => element.data());
    });
    return data;
  }

  static bool isMaterialFull(String type, Map<String, dynamic> tracker,
      Map<String, dynamic> materialData, String key) {
    // Get type of material
    Map<String, dynamic> trackerData = tracker[type];
    Map<String, dynamic> data = trackerData[key];
    print(
        "${data["current"]} | ${data["max"]} | ${data["current"] >= data["max"]}");
    return data["current"] >= data["max"];
  }
}
