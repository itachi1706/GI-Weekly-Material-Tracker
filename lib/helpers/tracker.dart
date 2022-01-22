import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:gi_weekly_material_tracker/helpers/grid.dart';
import 'package:gi_weekly_material_tracker/models/materialdata.dart';
import 'package:gi_weekly_material_tracker/models/trackdata.dart';
import 'package:gi_weekly_material_tracker/util.dart';

final FirebaseFirestore _db = FirebaseFirestore.instance;

enum TrackingStatus {
  unknown,
  checking,
  notTracked,
  trackedIncompleteMaterial,
  trackedCompleteMaterial,
}

class TrackingUtils {
  static Color getTrackingColor(
    int index,
    Map<String, TrackingStatus> _isBeingTracked,
  ) {
    return getTrackingColorString(index.toString(), _isBeingTracked);
  }

  static Color getTrackingColorString(
    String index,
    Map<String, TrackingStatus> _isBeingTracked,
  ) {
    if (!_isBeingTracked.keys.contains(index.toString())) {
      return Colors.yellow;
    } // No such key (loading)
    switch (_isBeingTracked[index.toString()]) {
      case TrackingStatus.unknown:
      case TrackingStatus.checking:
      case TrackingStatus.notTracked:
        return Get.theme.cardColor;
      case TrackingStatus.trackedCompleteMaterial:
        return (Util.themeNotifier.isDarkMode())
            ? Colors.green
            : Colors.lightGreen;
      case TrackingStatus.trackedIncompleteMaterial:
        return (Util.themeNotifier.isDarkMode())
            ? Colors.indigo
            : Colors.lightBlue;
      default: return Colors.yellow; // Error
    }
  }
}

class TrackingData {
  static Future<List<dynamic>?> getTrackingCategory(String key) async {
    var uid = Util.getFirebaseUid();
    if (uid == null) return null;
    var trackRef = _db.collection('tracking').doc(uid);
    var snapshot = await trackRef.get();
    var fields = TrackingUserInfo.fromJson(snapshot.data());
    switch (key) {
      case 'character':
        return fields.character;
      case 'material':
        return fields.material;
      case 'weapon':
        return fields.weapon;
      case 'talents':
        return fields.talent;
      default:
        return null;
    }
  }

  static Future<bool> isBeingTracked(String key, String? item) async {
    var _data = await getTrackingCategory(key);

    return (_data == null) ? false : _data.contains(item);
  }

  static bool isBeingTrackedLocal(List<dynamic>? _data, String item) {
    return (_data == null) ? false : _data.contains(item);
  }

  static Future<void> addToRecord(String key, String? item) async {
    var uid = Util.getFirebaseUid();
    if (uid == null) return;
    var trackRef = _db.collection('tracking').doc(uid);
    var snapshot = await trackRef.get();
    if (snapshot.exists) {
      await trackRef.update({
        key: FieldValue.arrayUnion([item]),
      });
    } else {
      await trackRef.set({
        key: [item],
      });
    }
  }

  static void setCount(String? key, String? type, int curCnt, int maxCnt) async {
    if (maxCnt < 0) maxCnt = 0;
    if (curCnt >= maxCnt) {
      curCnt = maxCnt;
    } else if (curCnt < 0) {
      curCnt = 0;
    }
    var uid = Util.getFirebaseUid();
    if (uid == null || key == null) return;
    await _db
        .collection('tracking')
        .doc(uid)
        .collection(type!)
        .doc(key)
        .update({'current': curCnt, 'max': maxCnt});
  }

  static void incrementCount(
    String key,
    String? type,
    int curCnt,
    int maxCnt,
  ) async {
    if (curCnt >= maxCnt) return; // Invalid action
    var uid = Util.getFirebaseUid();
    if (uid == null) return;

    await _db
        .collection('tracking')
        .doc(uid)
        .collection(type!)
        .doc(key)
        .update({'current': FieldValue.increment(1)});
  }

  static void decrementCount(String key, String? type, int curCnt) async {
    if (curCnt <= 0) return; // Invalid action
    var uid = Util.getFirebaseUid();
    if (uid == null) return;

    await _db
        .collection('tracking')
        .doc(uid)
        .collection(type!)
        .doc(key)
        .update({'current': FieldValue.increment(-1)});
  }

  static void addToCollection(
    String key,
    String? itemKey,
    int? numToTrack,
    String? materialType,
    String addType,
    String? extraData,
  ) async {
    var uid = Util.getFirebaseUid();
    if (uid == null || itemKey == null) return;
    await _db
        .collection('tracking')
        .doc(uid)
        .collection(materialType!)
        .doc(key)
        .set({
      'name': itemKey,
      'max': numToTrack,
      'current': 0,
      'type': materialType,
      'addedBy': addType,
      'addData': extraData,
    });
  }

  static Future<void> removeFromRecord(String key, String? item) async {
    var uid = Util.getFirebaseUid();
    if (uid == null) return;
    var trackRef = _db.collection('tracking').doc(uid);
    await trackRef.update({
      key: FieldValue.arrayRemove([item]),
    });
  }

  static void removeFromCollection(String key, String? materialType) async {
    var uid = Util.getFirebaseUid();
    if (uid == null) return;
    await _db
        .collection('tracking')
        .doc(uid)
        .collection(materialType!)
        .doc(key)
        .delete();
  }

  static Future<void> clearCollection(String materialType) async {
    var uid = Util.getFirebaseUid();
    if (uid == null) return;
    var deleted = 0;
    var limit = 50;
    do {
      var qs = await _db
          .collection('tracking')
          .doc(uid)
          .collection(materialType)
          .limit(limit)
          .get();

      var batch = _db.batch();
      deleted = 0;
      for (var qds in qs.docs) {
        batch.delete(qds.reference);
        deleted++;
      }
      await batch.commit();
    } while (deleted >= limit);
  }

  static Future<Map<String, TrackingUserData>> getCollectionList(
    String materialType,
  ) async {
    var uid = Util.getFirebaseUid();
    var snaps = await _db
        .collection('tracking')
        .doc(uid)
        .collection(materialType)
        .get();
    var data = <String, TrackingUserData>{};
    for (var element in snaps.docs) {
      data.putIfAbsent(
        element.id,
        () => TrackingUserData.fromJson(element.data()),
      );
    }

    return data;
  }

  static bool isMaterialFull(
    String? type,
    Map<String?, Map<String, TrackingUserData>> tracker,
    Map<String, MaterialDataCommon>? materialData,
    String key,
  ) {
    // Get type of material
    var trackerData = tracker[type]!;
    var data = trackerData[key]!;
    debugPrint('${data.current} | ${data.max} | ${data.current! >= data.max!}');

    return data.current! >= data.max!;
  }

  static Widget getSupportingWidget(String? image, int? ascension, String? type) {
    if (image == null) return Container();
    Widget typeWidget = const SizedBox.shrink();
    if (type != null) {
      typeWidget = Image.asset(
        GridUtils.getElementImageRef(type)!,
        height: 20,
        width: 20,
      );
    }

    return SizedBox(
      height: 48,
      width: 48,
      child: Stack(
        children: [
          GridData.getImageAssetFromFirebase(image, height: 32),
          Align(
            alignment: FractionalOffset.bottomLeft,
            child: Text(
              GridUtils.getRomanNumberArray(ascension! - 1).toString(),
              style: const TextStyle(color: Colors.white),
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

  static List<Widget> getAscensionHeader() {
    return [
      Padding(
        padding: const EdgeInsets.all(8),
        child: Row(
          children: const [
            Text(
              'Ascension Materials',
              style: TextStyle(fontSize: 24),
            ),
          ],
        ),
      ),
      Padding(
        padding: const EdgeInsets.only(left: 8, right: 8),
        child: Row(
          children: const [
            Text(
              'Select a tier to toggle tracking\nBlue - Getting materials | Green - Enough materials',
            ),
          ],
        ),
      ),
    ];
  }
}

class UpdateMultiTracking {
  BuildContext context;

  String? _cntCurrent = '', _cntTotal = '', _cntKey = '', _cntType = '';
  final TextEditingController _textCurrentController = TextEditingController();
  final TextEditingController _textTotalController = TextEditingController();
  final MaterialDataCommon? _material;

  UpdateMultiTracking(this.context, this._material);

  void itemClickedAction(
    TrackingUserData data,
    String docId,
    Map<String, dynamic> extraData,
    bool editDialog,
  ) {
    debugPrint(docId);
    var type = data.addedBy;
    var key = (data.addedBy == 'material') ? data.name : data.addData;
    _cntKey = docId;
    if (!editDialog) {
      if (data.addedBy == 'talent') {
        Get.toNamed('/characters/${data.addData!.split('|')[0]}');
      } else {
        Get.toNamed('/${type}s/$key');
      }

      return;
    }
    switch (type) {
      case 'material':
        _displayDialogMat('/materials', key, data);
        break;
      case 'weapon':
        _displayDialogNonMat('/weapons', key, data, extraData);
        break;
      case 'character':
        _displayDialogNonMat('/characters', key, data, extraData);
        break;
      case 'talent':
        _displayDialogNonMat(
          '/characters',
          data.addData!.split('|')[0],
          data,
          extraData,
        );
        break;
      default:
        Util.showSnackbarQuick(
          context,
          'Unsupported Action. Contact Developer',
        );
        break;
    }
  }

  List<Widget> _commonDialogButtons() {
    return [
      TextButton(
        onPressed: () => Get.back(),
        child: const Text('Cancel'),
      ),
      TextButton(
        onPressed: _updateRecord,
        child: const Text('Update'),
      ),
    ];
  }

  void _displayDialogMat(String navigateTo, String? key, TrackingUserData data) {
    _cntCurrent = data.current.toString();
    _cntTotal = data.max.toString();
    _textCurrentController.text = _cntCurrent!;
    _textTotalController.text = _cntTotal!;
    showDialog(
      context: context,
      builder: (context) {
        _cntType = data.type;

        return AlertDialog(
          title: Text('Update tracked amount for ${_material!.name}'),
          content: SingleChildScrollView(
            child: ListBody(
              children: [
                GridData.getImageAssetFromFirebase(_material!.image, height: 48),
                TextField(
                  onChanged: (newValue) {
                    _cntCurrent = newValue;
                  },
                  controller: _textCurrentController,
                  decoration: const InputDecoration(labelText: 'Tracked'),
                  keyboardType: TextInputType.number,
                ),
                TextField(
                  onChanged: (newValue) {
                    _cntTotal = newValue;
                  },
                  controller: _textTotalController,
                  decoration: const InputDecoration(labelText: 'Max'),
                  keyboardType: TextInputType.number,
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () {
                Get.back();
                Get.toNamed('$navigateTo/$key');
              },
              child: const Text('Info'),
            ),
            ..._commonDialogButtons(),
          ],
        );
      },
    );
  }

  Widget _getImageRow(Map<String, dynamic> extraData) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceAround,
      children: [
        GridData.getImageAssetFromFirebase(
          _material!.image,
          height: 48,
        ),
        TrackingData.getSupportingWidget(
          extraData['img'],
          extraData['asc'],
          extraData['type'],
        ),
      ],
    );
  }

  void _displayDialogNonMat(
    String navigateTo,
    String? key,
    TrackingUserData data,
    Map<String, dynamic> extraData,
  ) {
    _cntCurrent = data.current.toString();
    _cntTotal = data.max.toString();
    _textCurrentController.text = _cntCurrent!;
    showDialog(
      context: context,
      builder: (context) {
        _cntType = data.type;

        return AlertDialog(
          title: Text('Update tracked amount for ${_material!.name}'),
          content: SingleChildScrollView(
            child: ListBody(
              children: [
                _getImageRow(extraData),
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text('Max: $_cntTotal'),
                ),
                TextField(
                  onChanged: (newValue) {
                    _cntCurrent = newValue;
                  },
                  controller: _textCurrentController,
                  decoration: const InputDecoration(labelText: 'Tracked'),
                  keyboardType: TextInputType.number,
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () {
                Get.back();
                Get.toNamed('$navigateTo/$key');
              },
              child: const Text('Info'),
            ),
            ..._commonDialogButtons(),
          ],
        );
      },
    );
  }

  void _updateRecord() {
    debugPrint('$_cntKey | $_cntType | $_cntCurrent | $_cntTotal');
    TrackingData.setCount(
      _cntKey,
      _cntType,
      int.tryParse(_cntCurrent!) ?? 0,
      int.tryParse(_cntTotal!) ?? 0,
    );
    Get.back();
  }
}
