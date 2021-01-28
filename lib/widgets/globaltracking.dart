import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:flutter_rating_bar/flutter_rating_bar.dart';
import 'package:get/get.dart';
import 'package:gi_weekly_material_tracker/models/grid.dart';
import 'package:gi_weekly_material_tracker/models/tracker.dart';
import 'package:gi_weekly_material_tracker/util.dart';

final FirebaseFirestore _db = FirebaseFirestore.instance;

class GlobalTrackingPage extends StatelessWidget {
  final List<Tab> _tabs = [
    Tab(text: "Boss"),
    Tab(text: "Domains"),
    Tab(text: "Monster"),
    Tab(text: "Local Speciality")
  ];

  final List<Widget> _children = [
    GlobalTracker(path: "boss_drops"),
    GlobalTracker(path: "domain_forgery"),
    GlobalTracker(path: "mob_drops"),
    GlobalTracker(path: "local_speciality"),
  ];

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: _tabs.length,
      child: Scaffold(
        appBar: AppBar(
          title: Text("Consolidated Material List"),
          bottom: TabBar(
            tabs: _tabs,
          ),
        ),
        body: TabBarView(
          children: _children,
        ),
      ),
    );
  }
}

class GlobalTracker extends StatefulWidget {
  GlobalTracker({Key key, @required this.path}) : super(key: key);

  final String path;

  @override
  _GlobalTrackerState createState() => _GlobalTrackerState();
}

class _GlobalTrackerState extends State<GlobalTracker> {
  Map<String, dynamic> _materialData;

  @override
  void initState() {
    super.initState();

    GridData.retrieveMaterialsMapData().then((value) => {
          setState(() {
            _materialData = value;
          })
        });
  }

  @override
  Widget build(BuildContext context) {
    CollectionReference ref = _db
        .collection("tracking")
        .doc(Util.getFirebaseUid())
        .collection(widget.path);
    return StreamBuilder(
        stream: ref.snapshots(),
        builder: (context, AsyncSnapshot<QuerySnapshot> snapshot) {
          if (snapshot.hasError) {
            return Text("Error occurred getting snapshot");
          }

          if (snapshot.connectionState == ConnectionState.waiting ||
              _materialData == null) {
            return Util.centerLoadingCircle("");
          }

          QuerySnapshot data = snapshot.data;
          final int _collectionLen = data.docs.length;

          if (_collectionLen > 0) {
            // Consolidate stuff together
            Map<String, Map<String, dynamic>> _conData = new Map();
            data.docs.forEach((snap) {
              Map<String, dynamic> _tmp = snap.data();
              if (_conData.containsKey(_tmp["name"])) {
                // Append
                _conData[_tmp["name"]]["current"] =
                    _conData[_tmp["name"]]["current"] + _tmp["current"];
                _conData[_tmp["name"]]["max"] =
                    _conData[_tmp["name"]]["max"] + _tmp["max"];
              } else {
                _conData.putIfAbsent(
                    _tmp["name"],
                    () => {
                          "current": _tmp["current"],
                          "max": _tmp["max"],
                          "name": _tmp["name"],
                          "type": _tmp["type"]
                        });
              }
            });

            return ListView.builder(
              itemCount: _conData.length,
              itemBuilder: (context, index) {
                String key = _conData.keys.elementAt(index);
                Map<String, dynamic> _data = _conData[key];
                print(_data);
                Map<String, dynamic> _material = _materialData[_data["name"]];

                return Card(
                  color: GridData.getRarityColor(_material["rarity"]),
                  child: InkWell(
                    onTap: () => Get.toNamed('/globalMaterial',
                        arguments: [_data["name"]]),
                    child: Padding(
                      padding: const EdgeInsets.all(8),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.center,
                        children: [
                          GridData.getImageAssetFromFirebase(_material["image"],
                              height: 48),
                          Container(
                            width: MediaQuery.of(context).size.width - 180,
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisAlignment: MainAxisAlignment.start,
                              children: [
                                Text(
                                  _material["name"],
                                  style: TextStyle(
                                      fontSize: 20, color: Colors.white),
                                ),
                                RatingBar.builder(
                                  ignoreGestures: true,
                                  itemCount: 5,
                                  itemSize: 12,
                                  unratedColor: Colors.transparent,
                                  initialRating: double.tryParse(
                                      _material['rarity'].toString()),
                                  itemBuilder: (context, _) =>
                                      Icon(Icons.star, color: Colors.amber),
                                  onRatingUpdate: (rating) {
                                    print(rating);
                                  },
                                ),
                                Text(
                                  _material["obtained"]
                                      .toString()
                                      .replaceAll("\\n", "\n"),
                                  style: TextStyle(
                                      fontSize: 11, color: Colors.white),
                                ),
                              ],
                            ),
                          ),
                          Spacer(),
                          Column(
                            children: [
                              Text(
                                "${_data["current"]}/${_data["max"]}",
                                style: TextStyle(
                                    fontSize: 18,
                                    color: GridData.getCountColor(
                                        _data["current"], _data["max"])),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              },
            );
          } else {
            return Center(
              child: Text("No items being tracked for this material category"),
            );
          }
        });
  }
}

class GlobalMaterialPage extends StatefulWidget {
  @override
  _GlobalMaterialPageState createState() => _GlobalMaterialPageState();
}

class _GlobalMaterialPageState extends State<GlobalMaterialPage> {
  String _materialKey;
  Map<String, dynamic> _material;
  Map<String, dynamic> _weaponData;
  Map<String, dynamic> _characterData;

  Color _rarityColor;

  @override
  void initState() {
    super.initState();
    _materialKey = Get.arguments[0];
    _getStaticData();
  }

  void _getStaticData() async {
    Map<String, dynamic> characterData =
        await GridData.retrieveCharactersMapData();
    Map<String, dynamic> weaponData = await GridData.retrieveWeaponsMapData();
    Map<String, dynamic> materialData =
        await GridData.retrieveMaterialsMapData();
    setState(() {
      _characterData = characterData;
      _weaponData = weaponData;
      _material = materialData[_materialKey];
      _rarityColor = GridData.getRarityColor(_material['rarity']);
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_material == null) return Util.loadingScreen();
    return Scaffold(
      appBar: AppBar(
        title: Text(_material['name']),
        backgroundColor: _rarityColor,
      ),
      body: Padding(
        padding: const EdgeInsets.all(8),
        child: SingleChildScrollView(
          child: Column(
            children: [
              Row(
                children: [
                  GridData.getImageAssetFromFirebase(_material['image'],
                      height: 64),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        width: MediaQuery.of(context).size.width - 128,
                        child: Text(
                          _material['type'],
                          textAlign: TextAlign.start,
                          style: TextStyle(fontSize: 20),
                        ),
                      ),
                      RatingBar.builder(
                        ignoreGestures: true,
                        itemCount: 5,
                        itemSize: 30,
                        initialRating:
                            double.tryParse(_material['rarity'].toString()),
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
                        child: Text(_material['obtained']
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
                        child: Text(_material['description']
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
                      Text(
                        "Tracking For",
                        style: TextStyle(fontSize: 24),
                      ),
                    ],
                  )),
              _getCharacterData(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _getCharacterData() {
    Query ref = _db
        .collection("tracking")
        .doc(Util.getFirebaseUid())
        .collection(_material["innerType"])
        .where("name", isEqualTo: _materialKey);

    return StreamBuilder(
        stream: ref.snapshots(),
        builder: (context, AsyncSnapshot<QuerySnapshot> snapshot) {
          if (_characterData == null ||
              _weaponData == null ||
              snapshot.connectionState == ConnectionState.waiting) {
            return Padding(
              padding: const EdgeInsets.only(top: 16),
              child: CircularProgressIndicator(),
            );
          }

          QuerySnapshot qs = snapshot.data;
          Map<String, dynamic> _trackerData = new Map();
          qs.docs.forEach(
              (data) => {_trackerData.putIfAbsent(data.id, () => data.data())});

          return ListView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: _trackerData.length,
            itemBuilder: (context, index) {
              String key = _trackerData.keys.elementAt(index);
              Map<String, dynamic> _data = _trackerData[key];
              String imageRef = _material["image"];
              int extraAscensionRef = 0;
              String extraTypeRef;
              String name = _material["name"];
              var _ascendTier = key.substring(key.length - 1);
              if (_data["addData"] != null) {
                // Grab image ref of extra data based on addedBy
                if (_data["addedBy"] == "character") {
                  // Grab from character
                  name = _characterData[_data["addData"]]["name"];
                  imageRef = _characterData[_data["addData"]]["image"];
                  extraTypeRef = _characterData[_data["addData"]]["element"];
                  extraAscensionRef = int.tryParse(_ascendTier) ?? 0;
                } else if (_data["addedBy"] == "weapon") {
                  // Grab from weapon
                  imageRef = _weaponData[_data["addData"]]["image"];
                  name = _weaponData[_data["addData"]]["name"];
                  extraAscensionRef = int.tryParse(_ascendTier) ?? 0;
                }
                name =
                    "$name (Tier ${GridData.getRomanNumberArray(extraAscensionRef)})";
              }

              Widget typeWidget = SizedBox.shrink();
              if (extraTypeRef != null)
                typeWidget = Image.asset(
                  GridData.getElementImageRef(extraTypeRef),
                  height: 20,
                  width: 20,
                );

              return Container(
                child: Card(
                  child: InkWell(
                    child: Padding(
                      padding: const EdgeInsets.all(8),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.center,
                        children: [
                          Container(
                            height: 64,
                            width: 64,
                            child: Stack(
                              children: [
                                GridData.getImageAssetFromFirebase(imageRef,
                                    height: 48),
                                Align(
                                  alignment: FractionalOffset.bottomLeft,
                                  child: Text(GridData.getRomanNumberArray(
                                          extraAscensionRef - 1)
                                      .toString()),
                                ),
                                Align(
                                  alignment: FractionalOffset.bottomRight,
                                  child: typeWidget,
                                ),
                              ],
                            ),
                          ),
                          Container(
                            width: MediaQuery.of(context).size.width - 200,
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisAlignment: MainAxisAlignment.start,
                              children: [
                                Text(
                                  name,
                                  style: TextStyle(fontSize: 20),
                                ),
                              ],
                            ),
                          ),
                          Spacer(),
                          Column(
                            children: [
                              Text(
                                "${_data["current"]}/${_data["max"]}",
                                style: TextStyle(
                                    fontSize: 18,
                                    color: GridData.getCountColorBW(
                                        _data["current"], _data["max"])),
                              ),
                              Row(
                                children: [
                                  ButtonTheme(
                                    padding: EdgeInsets.symmetric(
                                        vertical: 4.0, horizontal: 8.0),
                                    //adds padding inside the button
                                    materialTapTargetSize:
                                        MaterialTapTargetSize.shrinkWrap,
                                    //limits the touch area to the button area
                                    minWidth: 0,
                                    //wraps child's width
                                    height: 0,
                                    //wraps child's height
                                    child: FlatButton(
                                      onPressed: () =>
                                          TrackingData.decrementCount(key,
                                              _data["type"], _data["current"]),
                                      child: Icon(Icons.remove),
                                    ),
                                  ),
                                  ButtonTheme(
                                    padding: EdgeInsets.symmetric(
                                        vertical: 4.0, horizontal: 8.0),
                                    //adds padding inside the button
                                    materialTapTargetSize:
                                        MaterialTapTargetSize.shrinkWrap,
                                    //limits the touch area to the button area
                                    minWidth: 0,
                                    //wraps child's width
                                    height: 0,
                                    //wraps child's height
                                    child: FlatButton(
                                      onPressed: () =>
                                          TrackingData.incrementCount(
                                              key,
                                              _data["type"],
                                              _data["current"],
                                              _data["max"]),
                                      child: Icon(Icons.add),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    onLongPress: () => _itemClickedAction(_data, key, {
                      "img": imageRef,
                      "asc": extraAscensionRef,
                      "type": extraTypeRef
                    }),
                  ),
                ),
              );
            },
          );
        });
  }

  void _itemClickedAction(
      Map<String, dynamic> data, String docId, Map<String, dynamic> extraData) {
    print(docId);
    String type = data["addedBy"];
    String key =
        (data["addedBy"] == "material") ? data["name"] : data["addData"];
    _cntKey = docId;
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

  void _displayDialogMat(
      String navigateTo, String key, Map<String, dynamic> data) {
    _cntCurrent = data["current"].toString();
    _cntTotal = data["max"].toString();
    _textCurrentController.text = _cntCurrent;
    _textTotalController.text = _cntTotal;
    showDialog(
        context: context,
        builder: (context) {
          _cntType = data["type"];
          return AlertDialog(
            title: Text("Update tracked amount for ${_material["name"]}"),
            content: SingleChildScrollView(
              child: ListBody(
                children: [
                  GridData.getImageAssetFromFirebase(_material["image"],
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
      Map<String, dynamic> data, Map<String, dynamic> extraData) {
    _cntCurrent = data["current"].toString();
    _cntTotal = data["max"].toString();
    _textCurrentController.text = _cntCurrent;
    showDialog(
        context: context,
        builder: (context) {
          _cntType = data["type"];
          return AlertDialog(
            title: Text("Update tracked amount for ${_material["name"]}"),
            content: SingleChildScrollView(
              child: ListBody(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceAround,
                    children: [
                      GridData.getImageAssetFromFirebase(_material["image"],
                          height: 48),
                      _getSupportingWidget(extraData["img"], extraData["asc"],
                          extraData["type"]),
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

  Widget _getSupportingWidget(String image, int ascension, String type) {
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
