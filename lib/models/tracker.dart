import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:gi_weekly_material_tracker/models/grid.dart';
import 'package:gi_weekly_material_tracker/models/materialdata.dart';
import 'package:gi_weekly_material_tracker/models/trackdata.dart';
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
    TrackingUserInfo fields = TrackingUserInfo.fromJson(snapshot.data());
    switch (key) {
      case "character":
        return fields.character;
      case "material":
        return fields.material;
      case "weapon":
        return fields.weapon;
      default:
        return null;
    }
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

  static void setCount(String key, String type, int curCnt, int maxCnt) async {
    if (maxCnt < 0) maxCnt = 0;
    if (curCnt >= maxCnt)
      curCnt = maxCnt;
    else if (curCnt < 0) curCnt = 0;
    String uid = Util.getFirebaseUid();
    if (uid == null || key == null) return;
    await _db
        .collection("tracking")
        .doc(uid)
        .collection(type)
        .doc(key)
        .update({"current": curCnt, "max": maxCnt});
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

  static Future<void> clearCollection(String materialType) async {
    String uid = Util.getFirebaseUid();
    if (uid == null) return;
    int deleted = 0, limit = 50;
    QuerySnapshot qs = await _db
        .collection("tracking")
        .doc(uid)
        .collection(materialType)
        .limit(limit)
        .get();
    do {
      deleted = 0;
      for (QueryDocumentSnapshot qds in qs.docs) {
        await qds.reference.delete();
        deleted++;
      }
    } while (deleted >= limit);
  }

  static Future<Map<String, TrackingUserData>> getCollectionList(
      String materialType) async {
    String uid = Util.getFirebaseUid();
    QuerySnapshot snaps = await _db
        .collection("tracking")
        .doc(uid)
        .collection(materialType)
        .get();
    Map<String, TrackingUserData> data = new Map();
    snaps.docs.forEach((element) {
      data.putIfAbsent(
          element.id, () => TrackingUserData.fromJson(element.data()));
    });
    return data;
  }

  static bool isMaterialFull(
      String type,
      Map<String, Map<String, TrackingUserData>> tracker,
      Map<String, MaterialDataCommon> materialData,
      String key) {
    // Get type of material
    Map<String, TrackingUserData> trackerData = tracker[type];
    TrackingUserData data = trackerData[key];
    print("${data.current} | ${data.max} | ${data.current >= data.max}");
    return data.current >= data.max;
  }

  static Widget getSupportingWidget(String image, int ascension, String type) {
    if (image == null) return Container();
    Widget typeWidget = SizedBox.shrink();
    if (type != null)
      typeWidget = Image.asset(
        GridData.getElementImageRef(type),
        height: 20,
        width: 20,
      );

    return Container(
      height: 48,
      width: 48,
      child: Stack(
        children: [
          GridData.getImageAssetFromFirebase(image, height: 32),
          Align(
            alignment: FractionalOffset.bottomLeft,
            child: Text(
              GridData.getRomanNumberArray(ascension - 1).toString(),
              style: TextStyle(color: Colors.white),
              textAlign: TextAlign.end,
            ),
          ),
          Align(
            alignment: FractionalOffset.bottomRight,
            child: typeWidget,
          ),
        ],
      ),
    );
  }
}

class UpdateMultiTracking {
  UpdateMultiTracking(this.context, this._material);

  BuildContext context;
  MaterialDataCommon _material;

  void itemClickedAction(TrackingUserData data, String docId,
      Map<String, dynamic> extraData, bool editDialog) {
    print(docId);
    String type = data.addedBy;
    String key = (data.addedBy == "material") ? data.name : data.addData;
    _cntKey = docId;
    if (!editDialog) {
      Get.toNamed('/${type}s', arguments: [key]);
      return;
    }
    switch (type) {
      case "material":
        _displayDialogMat("/materials", key, data);
        break;
      case "weapon":
        _displayDialogNonMat("/weapons", key, data, extraData);
        break;
      case "character":
        _displayDialogNonMat("/characters", key, data, extraData);
        break;
      default:
        Util.showSnackbarQuick(
            context, "Unsupported Action. Contact Developer");
        break;
    }
  }

  String _cntCurrent = "", _cntTotal = "", _cntKey = "", _cntType = "";
  TextEditingController _textCurrentController = TextEditingController();
  TextEditingController _textTotalController = TextEditingController();

  void _displayDialogMat(String navigateTo, String key, TrackingUserData data) {
    _cntCurrent = data.current.toString();
    _cntTotal = data.max.toString();
    _textCurrentController.text = _cntCurrent;
    _textTotalController.text = _cntTotal;
    showDialog(
        context: context,
        builder: (context) {
          _cntType = data.type;
          return AlertDialog(
            title: Text("Update tracked amount for ${_material.name}"),
            content: SingleChildScrollView(
              child: ListBody(
                children: [
                  GridData.getImageAssetFromFirebase(_material.image,
                      height: 48),
                  TextField(
                    onChanged: (newValue) {
                      _cntCurrent = newValue;
                    },
                    controller: _textCurrentController,
                    decoration: InputDecoration(labelText: "Tracked"),
                    keyboardType: TextInputType.number,
                  ),
                  TextField(
                    onChanged: (newValue) {
                      _cntTotal = newValue;
                    },
                    controller: _textTotalController,
                    decoration: InputDecoration(labelText: "Max"),
                    keyboardType: TextInputType.number,
                  ),
                ],
              ),
            ),
            actions: [
              TextButton(
                child: Text('Info'),
                onPressed: () {
                  Get.back();
                  Get.toNamed(navigateTo, arguments: [key]);
                },
              ),
              TextButton(
                child: Text('Cancel'),
                onPressed: () => Get.back(),
              ),
              TextButton(
                child: Text('Update'),
                onPressed: _updateRecord,
              ),
            ],
          );
        });
  }

  void _displayDialogNonMat(String navigateTo, String key,
      TrackingUserData data, Map<String, dynamic> extraData) {
    _cntCurrent = data.current.toString();
    _cntTotal = data.max.toString();
    _textCurrentController.text = _cntCurrent;
    showDialog(
        context: context,
        builder: (context) {
          _cntType = data.type;
          return AlertDialog(
            title: Text("Update tracked amount for ${_material.name}"),
            content: SingleChildScrollView(
              child: ListBody(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceAround,
                    children: [
                      GridData.getImageAssetFromFirebase(_material.image,
                          height: 48),
                      TrackingData.getSupportingWidget(extraData["img"],
                          extraData["asc"], extraData["type"]),
                    ],
                  ),
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Text("Max: $_cntTotal"),
                  ),
                  TextField(
                    onChanged: (newValue) {
                      _cntCurrent = newValue;
                    },
                    controller: _textCurrentController,
                    decoration: InputDecoration(labelText: "Tracked"),
                    keyboardType: TextInputType.number,
                  ),
                ],
              ),
            ),
            actions: [
              TextButton(
                child: Text('Info'),
                onPressed: () {
                  Get.back();
                  Get.toNamed(navigateTo, arguments: [key]);
                },
              ),
              TextButton(
                child: Text('Cancel'),
                onPressed: () => Get.back(),
              ),
              TextButton(
                child: Text('Update'),
                onPressed: _updateRecord,
              ),
            ],
          );
        });
  }

  void _updateRecord() {
    print("$_cntKey | $_cntType | $_cntCurrent | $_cntTotal");
    TrackingData.setCount(_cntKey, _cntType, int.tryParse(_cntCurrent) ?? 0,
        int.tryParse(_cntTotal) ?? 0);
    Get.back();
  }
}
