import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:flutter_rating_bar/flutter_rating_bar.dart';
import 'package:get/get.dart';
import 'package:gi_weekly_material_tracker/models/grid.dart';
import 'package:gi_weekly_material_tracker/models/tracker.dart';
import 'package:gi_weekly_material_tracker/util.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import 'package:transparent_image/transparent_image.dart';

final FirebaseFirestore _db = FirebaseFirestore.instance;

class CharacterListGrid extends StatefulWidget {
  @override
  _CharacterListGridState createState() => _CharacterListGridState();
}

class _CharacterListGridState extends State<CharacterListGrid> {
  @override
  Widget build(BuildContext context) {
    CollectionReference materialRef = _db.collection('characters');
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
                onTap: () => Get.toNamed('/characters',
                    arguments: [document.id, document.data()]),
                child: GridData.getGridData(document.data()),
              );
            }).toList(),
          );
        });
  }
}

class CharacterInfoPage extends StatefulWidget {
  @override
  _CharacterInfoPageState createState() => _CharacterInfoPageState();
}

class _CharacterInfoPageState extends State<CharacterInfoPage> {
  Map<String, dynamic> _infoData;
  String _infoId;

  Color _rarityColor;

  Map<String, dynamic> _materialData;

  Map<String, int> _isBeingTracked;

  void _refreshTrackingStatus() {
    if (_isBeingTracked == null) {
      Map<String, int> _tmpTracker = new Map();
      _infoData['ascension'].keys.forEach((key) {
        _tmpTracker[key] = 0;
      });
      setState(() {
        _isBeingTracked = _tmpTracker;
      });
    }

    TrackingData.getTrackingCategory('character').then((_dataList) {
      print(_dataList);
      _isBeingTracked.keys.forEach((key) {
        bool _isTracked =
            TrackingData.isBeingTrackedLocal(_dataList, "${_infoId}_$key");
        setState(() {
          _isBeingTracked[key] = (_isTracked) ? 1 : 2; // 1 - Yes, 2 - No
        });
      });
    });
  }

  Color _getTrackingColor(int index) {
    if (!_isBeingTracked.keys.contains(index.toString()))
      return Colors.yellow; // No such key (loading)
    switch (_isBeingTracked[index.toString()]) {
      case 0:
        return Colors.white;
      case 1:
        return Colors.lightGreen;
      case 2:
        return Colors.white;
    }
    return Colors.yellow; // Error
  }

  int _isBeingTrackedStatus(String key) {
    if (!_isBeingTracked.keys.contains(key)) return 0;
    return _isBeingTracked[key];
  }

  void _trackCharacterAction() {
    print("Selected: $_selectedTier");
    Map<String, dynamic> _ascendTier = _infoData['ascension'][_selectedTier];

    TrackingData.addToRecord('character', "${_infoId}_$_selectedTier")
        .then((value) {
      _refreshTrackingStatus();
      Util.showSnackbarQuick(context,
          "${_infoData['name']} Ascension Tier $_selectedTier added to tracker!");
    });
    if (_ascendTier['material1'] != null)
      TrackingData.addToCollection(
          "Character_${_infoId}_${_ascendTier['material1']}_$_selectedTier",
          _ascendTier['material1'],
          _ascendTier['material1qty'],
          _materialData[_ascendTier['material1']]['innerType'],
          'character',
          _infoId);
    if (_ascendTier['material2'] != null)
      TrackingData.addToCollection(
          "Character_${_infoId}_${_ascendTier['material2']}_$_selectedTier",
          _ascendTier['material2'],
          _ascendTier['material2qty'],
          _materialData[_ascendTier['material2']]['innerType'],
          'character',
          _infoId);
    if (_ascendTier['material3'] != null)
      TrackingData.addToCollection(
          "Character_${_infoId}_${_ascendTier['material3']}_$_selectedTier",
          _ascendTier['material3'],
          _ascendTier['material3qty'],
          _materialData[_ascendTier['material3']]['innerType'],
          'character',
          _infoId);
    if (_ascendTier['material4'] != null)
      TrackingData.addToCollection(
          "Character_${_infoId}_${_ascendTier['material4']}_$_selectedTier",
          _ascendTier['material4'],
          _ascendTier['material4qty'],
          _materialData[_ascendTier['material4']]['innerType'],
          'character',
          _infoId);
    Navigator.of(context).pop();
  }

  void _untrackCharacterAction() {
    print("Selected: $_selectedTier");
    Map<String, dynamic> _ascendTier = _infoData['ascension'][_selectedTier];

    TrackingData.removeFromRecord('character', "${_infoId}_$_selectedTier")
        .then((value) {
      _refreshTrackingStatus();
      Util.showSnackbarQuick(context,
          "${_infoData['name']} Ascension Tier $_selectedTier removed from tracker!");
    });
    if (_ascendTier['material1'] != null)
      TrackingData.removeFromCollection(
          "Character_${_infoId}_${_ascendTier['material1']}_$_selectedTier",
          _materialData[_ascendTier['material1']]['innerType']);
    if (_ascendTier['material2'] != null)
      TrackingData.removeFromCollection(
          "Character_${_infoId}_${_ascendTier['material2']}_$_selectedTier",
          _materialData[_ascendTier['material2']]['innerType']);
    if (_ascendTier['material3'] != null)
      TrackingData.removeFromCollection(
          "Character_${_infoId}_${_ascendTier['material3']}_$_selectedTier",
          _materialData[_ascendTier['material3']]['innerType']);
    if (_ascendTier['material4'] != null)
      TrackingData.removeFromCollection(
          "Character_${_infoId}_${_ascendTier['material4']}_$_selectedTier",
          _materialData[_ascendTier['material4']]['innerType']);

    Navigator.of(context).pop();
  }

  List<Widget> _getAscensionTierMaterialRowChild(
      Map<String, dynamic> curData, String key) {
    return [
      _getAscenionImage(curData[key]),
      Text(curData[key] == null ? "" : _materialData[curData[key]]['name']),
      Text((curData["${key}qty"] == 0)
          ? ""
          : " x${curData["${key}qty"].toString()}"),
    ];
  }

  String _selectedTier;

  void _addOrRemoveMaterial(int index, Map<String, dynamic> curData) async {
    String key = index.toString();
    if (_isBeingTrackedStatus(key) == 0) {
      Util.showSnackbarQuick(context, "Checking tracking status");
      return;
    }

    setState(() {
      _selectedTier = key;
    });

    if (_isBeingTrackedStatus(key) == 1) {
      showDialog(
        context: context,
        builder: (context) {
          return AlertDialog(
            title: Text(
                "Remove ${_infoData['name']} Ascension Tier $key from the tracker?"),
            content: SingleChildScrollView(
              child: ListBody(
                children: [
                  GridData.getImageAssetFromFirebase(_infoData['image'],
                      height: 64),
                  Text(
                      "This will remove the following materials being tracked for this character from the tracker:"),
                  Row(
                    children:
                        _getAscensionTierMaterialRowChild(curData, 'material2'),
                  ),
                  Row(
                    children:
                        _getAscensionTierMaterialRowChild(curData, 'material1'),
                  ),
                  Row(
                    children:
                        _getAscensionTierMaterialRowChild(curData, 'material3'),
                  ),
                  Row(
                    children:
                        _getAscensionTierMaterialRowChild(curData, 'material4'),
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
                child: Text('Untrack'),
                onPressed: _untrackCharacterAction,
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
            title: Text(
                "Add ${_infoData['name']} Ascension Tier $key to the tracker?"),
            content: SingleChildScrollView(
              child: ListBody(
                children: [
                  GridData.getImageAssetFromFirebase(_infoData['image'],
                      height: 64),
                  Text("Items being added to tracker:"),
                  Row(
                    children:
                        _getAscensionTierMaterialRowChild(curData, 'material2'),
                  ),
                  Row(
                    children:
                        _getAscensionTierMaterialRowChild(curData, 'material1'),
                  ),
                  Row(
                    children:
                        _getAscensionTierMaterialRowChild(curData, 'material3'),
                  ),
                  Row(
                    children:
                        _getAscensionTierMaterialRowChild(curData, 'material4'),
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
                onPressed: _trackCharacterAction,
              ),
            ],
          );
        },
      );
    }
  }

  @override
  void initState() {
    super.initState();
    _infoData = Get.arguments[1];
    _infoId = Get.arguments[0];
    _rarityColor = GridData.getRarityColor(_infoData['rarity']);
    GridData.retrieveMaterialsMapData().then((value) => {
          setState(() {
            _materialData = value;
          })
        });

    // Init map
    _refreshTrackingStatus();
  }

  Widget _getAscenionImage(String itemKey) {
    if (itemKey == null) return Image.memory(kTransparentImage, height: 16);

    return GridData.getImageAssetFromFirebase(_materialData[itemKey]['image'],
        height: 16);
  }

  Widget _generateAscensionData() {
    if (_materialData == null) {
      return Padding(
        padding: const EdgeInsets.only(top: 16),
        child: CircularProgressIndicator(),
      );
    }

    Map<String, dynamic> dataMap = _infoData['ascension'];
    List<MapEntry<String, dynamic>> data =
        dataMap.entries.map((e) => e).toList();
    return ListView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: data.length,
      itemBuilder: (context, index) {
        Map<String, dynamic> curData = data[index].value;
        return Container(
          child: Card(
            color: _getTrackingColor(index + 1),
            child: InkWell(
              onTap: () => _addOrRemoveMaterial(index + 1, curData),
              child: Padding(
                padding: const EdgeInsets.all(8),
                child: Row(
                  children: [
                    Text(
                      GridData.getRomanNumberArray(index),
                      style: TextStyle(fontSize: 24),
                    ),
                    Spacer(),
                    Icon(Icons.show_chart),
                    Text(curData['level'].toString()),
                    Spacer(),
                    Image.asset("assets/images/items/Icon_Mora.png",
                        height: 16),
                    Text(curData['mora'].toString()),
                    Spacer(),
                    _getAscenionImage(curData['material2']),
                    Text((curData['material2qty'] == 0)
                        ? ""
                        : curData['material2qty'].toString()),
                    Spacer(),
                    _getAscenionImage(curData['material1']),
                    Text(curData['material1qty'].toString()),
                    Spacer(),
                    _getAscenionImage(curData['material3']),
                    Text(curData['material3qty'].toString()),
                    Spacer(),
                    _getAscenionImage(curData['material4']),
                    Text(curData['material4qty'].toString()),
                    Spacer(),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_infoData['name']),
        backgroundColor: _rarityColor,
      ),
      body: Padding(
        padding: const EdgeInsets.all(8),
        child: SingleChildScrollView(
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
                        width: 200,
                        child: Text(
                          _infoData['affiliation'].toString(),
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
                  Spacer(),
                  Image.asset(GridData.getElementImageRef(_infoData['element']))
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
                        child: Text(_infoData['nation']),
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
              Divider(),
              Padding(
                padding: const EdgeInsets.all(8),
                child: Row(
                  children: [
                    Icon(Icons.book),
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.only(left: 8, right: 8),
                        child: Text(_infoData['introduction']
                            .toString()
                            .replaceAll('\\n', "\n")),
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
                    Icon(MdiIcons.weatherNight),
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.only(left: 8, right: 8),
                        child: Text(_infoData['constellation']),
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
                    Icon(MdiIcons.swordCross),
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.only(left: 8, right: 8),
                        child: Text(_infoData['weapon']),
                      ),
                    ),
                  ],
                ),
              ),
              Divider(),
              IntrinsicHeight(
                child: Row(
                  children: [
                    Padding(
                      padding: const EdgeInsets.all(8),
                      child: Row(
                        children: [
                          Icon(MdiIcons.genderMaleFemale),
                          Padding(
                            padding: const EdgeInsets.only(left: 8, right: 8),
                            child: Text(_infoData['gender']),
                          ),
                        ],
                      ),
                    ),
                    Spacer(),
                    VerticalDivider(),
                    Padding(
                      padding: const EdgeInsets.all(8),
                      child: Row(
                        children: [
                          Icon(Icons.cake),
                          Padding(
                            padding: const EdgeInsets.only(left: 8, right: 8),
                            child: Text(_infoData['birthday']),
                          ),
                        ],
                      ),
                    ),
                    Spacer(),
                  ],
                ),
              ),
              Divider(),
              Padding(
                  padding: const EdgeInsets.all(8),
                  child: Row(
                    children: [
                      Text(
                        "Ascension Materials",
                        style: TextStyle(fontSize: 24),
                      ),
                    ],
                  )),
              Padding(
                padding: const EdgeInsets.only(left: 8, right: 8),
                child: Row(
                  children: [Text("Select a tier to toggle tracking")],
                ),
              ),
              _generateAscensionData(),
            ],
          ),
        ),
      ),
    );
  }
}
