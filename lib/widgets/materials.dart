import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:flutter_rating_bar/flutter_rating_bar.dart';
import 'package:get/get.dart';
import 'package:gi_weekly_material_tracker/models/grid.dart';
import 'package:gi_weekly_material_tracker/models/tracker.dart';
import 'package:gi_weekly_material_tracker/util.dart';

final FirebaseFirestore _db = FirebaseFirestore.instance;

class MaterialListGrid extends StatefulWidget {
  @override
  _MaterialListGridState createState() => _MaterialListGridState();
}

class _MaterialListGridState extends State<MaterialListGrid> {
  @override
  Widget build(BuildContext context) {
    CollectionReference materialRef = _db.collection('materials');
    return StreamBuilder(
        stream: materialRef.snapshots(),
        builder: (context, AsyncSnapshot<QuerySnapshot> snapshot) {
          if (snapshot.hasError) {
            return Text("Error occurred getting snapshot");
          }

          if (snapshot.connectionState == ConnectionState.waiting) {
            return Util.centerLoadingCircle("");
          }

          return GridView.count(
            crossAxisCount: 3,
            children: snapshot.data.docs.map((document) {
              return GestureDetector(
                onTap: () => Get.toNamed('/materials',
                    arguments: [document.id, document.data()]),
                child: GridData.getGridData(document.data()),
              );
            }).toList(),
          );
        });
  }
}

class MaterialInfoPage extends StatefulWidget {
  @override
  _MaterialInfoPageState createState() => _MaterialInfoPageState();
}

class _MaterialInfoPageState extends State<MaterialInfoPage> {
  Map<String, dynamic> _infoData;
  String _infoId;

  Color _rarityColor;

  bool _isAdded = false;
  bool _addCheckObtained = false;

  @override
  void initState() {
    super.initState();
    _infoData = Get.arguments[1];
    _infoId = Get.arguments[0];
    _rarityColor = GridData.getRarityColor(_infoData['rarity']);
    refreshTrackingStatus();
  }

  void refreshTrackingStatus() {
    setState(() {
      _addCheckObtained = false;
    });
    TrackingData.isBeingTracked('material', _infoId)
        .then((isTracked) => setState(() {
              _isAdded = isTracked;
              _addCheckObtained = true;
            }));
  }

  Widget _getFabWidget() {
    if (!_addCheckObtained) return CircularProgressIndicator();
    if (_isAdded)
      return Icon(Icons.remove, color: Colors.white,);
    else
      return Icon(Icons.add, color: Colors.white,);
  }

  String _cntTrack = "";
  TextEditingController _textEditingController = TextEditingController();

  void _trackMaterialAction() {
    int toTrack = int.tryParse(_cntTrack) ?? 0;
    TrackingData.addToRecord('material', _infoId).then((value) {
      refreshTrackingStatus();
      Util.showSnackbarQuick(context, "${_infoData['name']} added to tracker!");
    });
    TrackingData.addToCollection("Material_$_infoId", _infoId, toTrack,
        _infoData['innerType'], 'material', null);
    Navigator.of(context).pop();
  }

  void _untrackMaterialAction() {
    TrackingData.removeFromRecord('material', _infoId)
        .then((value) {
      refreshTrackingStatus();
      Util.showSnackbarQuick(
          context, "${_infoData['name']} removed from tracker!");
    });
    TrackingData.removeFromCollection(
        "Material_$_infoId", _infoData['innerType']);
    Navigator.of(context).pop();
  }

  void _addOrRemoveMaterial() async {
    if (!_addCheckObtained) {
      Util.showSnackbarQuick(context, "Checking tracking status");
      return;
    }

    if (_isAdded) {
      showDialog(
        context: context,
        builder: (context) {
          return AlertDialog(
            title: Text("Remove ${_infoData['name']} from the tracker?"),
            content: SingleChildScrollView(
              child: ListBody(
                children: [
                  GridData.getImageAssetFromFirebase(_infoData['image'],
                      height: 64),
                  Text(
                      "This will remove the currently tracked data for this material from the tracker"),
                ],
              ),
            ),
            actions: [
              TextButton(
                child: Text('Cancel'),
                onPressed: () => Navigator.of(context).pop(),
              ),
              TextButton(
                child: Text('Untrack'),
                onPressed: _untrackMaterialAction,
              ),
            ],
          );
        },
      );
    } else {
      showDialog(
        context: context,
        builder: (context) {
          return AlertDialog(
            title: Text("Add ${_infoData['name']} to the tracker?"),
            content: SingleChildScrollView(
              child: ListBody(
                children: [
                  GridData.getImageAssetFromFirebase(_infoData['image'],
                      height: 64),
                  TextField(
                    onChanged: (newValue) {
                      setState(() {
                        _cntTrack = newValue;
                      });
                    },
                    controller: _textEditingController,
                    decoration: InputDecoration(hintText: "Quantity to track"),
                    keyboardType: TextInputType.number,
                  ),
                ],
              ),
            ),
            actions: [
              TextButton(
                child: Text('Cancel'),
                onPressed: () => Navigator.of(context).pop(),
              ),
              TextButton(
                child: Text('Track'),
                onPressed: _trackMaterialAction,
              ),
            ],
          );
        },
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_infoData['name']),
        backgroundColor: _rarityColor,
      ),
      floatingActionButton: FloatingActionButton(
        child: _getFabWidget(),
        backgroundColor: _rarityColor,
        onPressed: _addOrRemoveMaterial,
      ),
      body: Padding(
        padding: const EdgeInsets.all(8),
        child: Column(
          children: [
            Row(
              children: [
                GridData.getImageAssetFromFirebase(_infoData['image'],
                    height: 64),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: MediaQuery.of(context).size.width - 128,
                      child: Text(
                        _infoData['type'],
                        textAlign: TextAlign.start,
                        style: TextStyle(fontSize: 20),
                      ),
                    ),
                    RatingBar.builder(
                      ignoreGestures: true,
                      itemCount: 5,
                      itemSize: 30,
                      initialRating:
                          double.tryParse(_infoData['rarity'].toString()),
                      itemBuilder: (context, _) =>
                          Icon(Icons.star, color: Colors.amber),
                      onRatingUpdate: (rating) {
                        print(rating);
                      },
                    ),
                  ],
                ),
              ],
            ),
            Divider(),
            Padding(
              padding: const EdgeInsets.all(8),
              child: Row(
                children: [
                  Icon(Icons.location_pin),
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.only(left: 8, right: 8),
                      child: Text(_infoData['obtained']
                          .toString()
                          .replaceAll('\\n', "\n")
                          .replaceAll("- ", "")),
                    ),
                  ),
                ],
              ),
            ),
            Divider(),
            Padding(
              padding: const EdgeInsets.all(8),
              child: Row(
                children: [
                  Icon(Icons.format_list_bulleted),
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.only(left: 8, right: 8),
                      child: Text(_infoData['description']
                          .toString()
                          .replaceAll('\\n', "\n")),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
