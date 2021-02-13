import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:flutter_rating_bar/flutter_rating_bar.dart';
import 'package:get/get.dart';
import 'package:gi_weekly_material_tracker/helpers/tracker.dart';
import 'package:gi_weekly_material_tracker/listeners/sorter.dart';
import 'package:gi_weekly_material_tracker/helpers/grid.dart';
import 'package:gi_weekly_material_tracker/models/materialdata.dart';
import 'package:gi_weekly_material_tracker/models/trackdata.dart';
import 'package:gi_weekly_material_tracker/models/weapondata.dart';
import 'package:gi_weekly_material_tracker/util.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import 'package:transparent_image/transparent_image.dart';

final FirebaseFirestore _db = FirebaseFirestore.instance;

class WeaponTabController extends StatefulWidget {
  WeaponTabController({Key key, @required this.tabController, this.notifier})
      : super(key: key);

  final TabController tabController;
  final SortNotifier notifier;

  @override
  _WeaponTabControllerState createState() => _WeaponTabControllerState();
}

class _WeaponTabControllerState extends State<WeaponTabController> {
  @override
  Widget build(BuildContext context) {
    return TabBarView(controller: widget.tabController, children: [
      WeaponListGrid(notifier: widget.notifier),
      WeaponListGrid(filter: "Bow", notifier: widget.notifier),
      WeaponListGrid(filter: "Catalyst", notifier: widget.notifier),
      WeaponListGrid(filter: "Claymore", notifier: widget.notifier),
      WeaponListGrid(filter: "Polearm", notifier: widget.notifier),
      WeaponListGrid(filter: "Sword", notifier: widget.notifier),
    ]);
  }
}

class WeaponListGrid extends StatefulWidget {
  WeaponListGrid({Key key, this.filter, this.notifier});

  final String filter;
  final SortNotifier notifier;

  @override
  _WeaponListGridState createState() => _WeaponListGridState();
}

class _WeaponListGridState extends State<WeaponListGrid> {
  String _sorter;
  bool _isDescending = false;

  @override
  void initState() {
    super.initState();
    widget.notifier.addListener(() {
      if (!mounted) return;
      setState(() {
        _sorter = widget.notifier.getSortKey();
        _isDescending = widget.notifier.isDescending();
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    CollectionReference weaponRef = _db.collection('weapons');
    Query queryRef;
    if (widget.filter != null)
      queryRef = weaponRef.where("type", isEqualTo: widget.filter);
    if (_sorter != null && queryRef == null)
      queryRef = weaponRef
          .orderBy(_sorter, descending: _isDescending)
          .orderBy(FieldPath.documentId);
    else if (_sorter != null)
      queryRef = queryRef
          .orderBy(_sorter, descending: _isDescending)
          .orderBy(FieldPath.documentId);
    return StreamBuilder(
        stream:
            (queryRef == null) ? weaponRef.snapshots() : queryRef.snapshots(),
        builder: (context, AsyncSnapshot<QuerySnapshot> snapshot) {
          if (snapshot.hasError) {
            return Text("Error occurred getting snapshot");
          }

          if (snapshot.connectionState == ConnectionState.waiting) {
            return Util.centerLoadingCircle("");
          }

          if (widget.filter == null)
            GridData.setStaticData("weapons", snapshot.data);

          return GridView.count(
            crossAxisCount:
                (Get.context.orientation == Orientation.portrait) ? 3 : 6,
            children: snapshot.data.docs.map((document) {
              return GestureDetector(
                onTap: () => Get.toNamed('/weapons/${document.id}'),
                child:
                    GridData.getGridData(WeaponData.fromJson(document.data())),
              );
            }).toList(),
          );
        });
  }
}

class WeaponInfoPage extends StatefulWidget {
  @override
  _WeaponInfoPageState createState() => _WeaponInfoPageState();
}

class _WeaponInfoPageState extends State<WeaponInfoPage> {
  String _infoId;
  Color _rarityColor;

  WeaponData _info;
  Map<String, MaterialDataCommon> _materialData;
  Map<String, TrackingStatus> _isBeingTracked;

  void _refreshTrackingStatus() {
    if (_materialData == null) return; // No data
    if (_isBeingTracked == null) {
      Map<String, TrackingStatus> _tmpTracker = new Map();
      _info.ascension.keys.forEach((key) {
        _tmpTracker[key] = TrackingStatus.UNKNOWN;
      });
      setState(() {
        if (!mounted) return;
        _isBeingTracked = _tmpTracker;
      });
    }

    Map<String, TrackingStatus> _tracker = _isBeingTracked;
    TrackingData.getTrackingCategory('weapon').then((_dataList) async {
      print(_dataList);
      Set<String> datasets = new Set();
      // Check tracking status and get material list
      _isBeingTracked.keys.forEach((key) {
        bool _isTracked =
            TrackingData.isBeingTrackedLocal(_dataList, "${_infoId}_$key");
        WeaponAscension data = _info.ascension[key];
        if (data.material1 != null)
          datasets.add(_materialData[data.material1].innerType);
        if (data.material2 != null)
          datasets.add(_materialData[data.material2].innerType);
        if (data.material3 != null)
          datasets.add(_materialData[data.material3].innerType);
        _tracker[key] =
            (_isTracked) ? TrackingStatus.CHECKING : TrackingStatus.NOT_TRACKED;
      });

      // Get all datasets into a map to check if completed
      Map<String, Map<String, TrackingUserData>> collectionList = new Map();
      for (String ds in datasets.toList()) {
        collectionList[ds] = await TrackingData.getCollectionList(ds);
      }
      // Run through tracking status and check if its fully tracked
      _tracker.keys.forEach((key) {
        if (_tracker[key] != TrackingStatus.CHECKING) return; // Skip untracked
        bool fullTrack = true;
        WeaponAscension data = _info.ascension[key];
        if (data.material1 != null && fullTrack)
          fullTrack = TrackingData.isMaterialFull(
              _materialData[data.material1].innerType,
              collectionList,
              _materialData,
              "Weapon_${_infoId}_${data.material1}_$key");
        if (data.material2 != null && fullTrack)
          fullTrack = TrackingData.isMaterialFull(
              _materialData[data.material2].innerType,
              collectionList,
              _materialData,
              "Weapon_${_infoId}_${data.material2}_$key");
        if (data.material3 != null && fullTrack)
          fullTrack = TrackingData.isMaterialFull(
              _materialData[data.material3].innerType,
              collectionList,
              _materialData,
              "Weapon_${_infoId}_${data.material3}_$key");
        _tracker[key] = (fullTrack)
            ? TrackingStatus.TRACKED_COMPLETE_MATERIAL
            : TrackingStatus.TRACKED_INCOMPLETE_MATERIAL;
      });

      setState(() {
        _isBeingTracked = _tracker;
      });
    });
  }

  TrackingStatus _isBeingTrackedStatus(String key) {
    if (!_isBeingTracked.keys.contains(key)) return TrackingStatus.UNKNOWN;
    return _isBeingTracked[key];
  }

  void _trackWeaponAction() {
    print("Selected: $_selectedTier");
    WeaponAscension _ascendTier = _info.ascension[_selectedTier];
    String _ascensionTierSel = _selectedTier;

    TrackingData.addToRecord('weapon', "${_infoId}_$_selectedTier")
        .then((value) {
      _refreshTrackingStatus();
      Util.showSnackbarQuick(context,
          "${_info.name} Ascension Tier $_ascensionTierSel added to tracker!");
    });
    if (_ascendTier.material1 != null)
      TrackingData.addToCollection(
          "Weapon_${_infoId}_${_ascendTier.material1}_$_selectedTier",
          _ascendTier.material1,
          _ascendTier.material1Qty,
          _materialData[_ascendTier.material1].innerType,
          'weapon',
          _infoId);
    if (_ascendTier.material2 != null)
      TrackingData.addToCollection(
          "Weapon_${_infoId}_${_ascendTier.material2}_$_selectedTier",
          _ascendTier.material2,
          _ascendTier.material2Qty,
          _materialData[_ascendTier.material2].innerType,
          'weapon',
          _infoId);
    if (_ascendTier.material3 != null)
      TrackingData.addToCollection(
          "Weapon_${_infoId}_${_ascendTier.material3}_$_selectedTier",
          _ascendTier.material3,
          _ascendTier.material3Qty,
          _materialData[_ascendTier.material3].innerType,
          'weapon',
          _infoId);
    Navigator.of(context).pop();
  }

  void _untrackWeaponAction() {
    print("Selected: $_selectedTier");
    WeaponAscension _ascendTier = _info.ascension[_selectedTier];
    String _ascensionTierSel = _selectedTier;

    TrackingData.removeFromRecord('weapon', "${_infoId}_$_selectedTier")
        .then((value) {
      _refreshTrackingStatus();
      Util.showSnackbarQuick(context,
          "${_info.name} Ascension Tier $_ascensionTierSel removed from tracker!");
    });
    if (_ascendTier.material1 != null)
      TrackingData.removeFromCollection(
          "Weapon_${_infoId}_${_ascendTier.material1}_$_selectedTier",
          _materialData[_ascendTier.material1].innerType);
    if (_ascendTier.material2 != null)
      TrackingData.removeFromCollection(
          "Weapon_${_infoId}_${_ascendTier.material2}_$_selectedTier",
          _materialData[_ascendTier.material2].innerType);
    if (_ascendTier.material3 != null)
      TrackingData.removeFromCollection(
          "Weapon_${_infoId}_${_ascendTier.material3}_$_selectedTier",
          _materialData[_ascendTier.material3].innerType);

    Navigator.of(context).pop();
  }

  List<Widget> _getAscensionTierMaterialRowChild(String key, int qty) {
    return [
      _getAscensionImage(key),
      Text(key == null ? "" : _materialData[key].name),
      Text((qty == 0) ? "" : " x$qty"),
    ];
  }

  String _selectedTier;

  void _addOrRemoveMaterial(int index, WeaponAscension curData) async {
    String key = index.toString();
    TrackingStatus isTracked = _isBeingTrackedStatus(key);
    if (isTracked == TrackingStatus.UNKNOWN ||
        isTracked == TrackingStatus.CHECKING) {
      Util.showSnackbarQuick(context, "Checking tracking status");
      return;
    }

    setState(() {
      _selectedTier = key;
    });

    if (isTracked == TrackingStatus.TRACKED_INCOMPLETE_MATERIAL ||
        isTracked == TrackingStatus.TRACKED_COMPLETE_MATERIAL) {
      showDialog(
        context: context,
        builder: (context) {
          return AlertDialog(
            title: Text(
                "Remove ${_info.name} Ascension Tier $key from the tracker?"),
            content: SingleChildScrollView(
              child: ListBody(
                children: [
                  GridData.getImageAssetFromFirebase(_info.image, height: 64),
                  Text(
                      "This will remove the following materials being tracked for this weapon from the tracker:"),
                  Row(
                    children: _getAscensionTierMaterialRowChild(
                        curData.material1, curData.material1Qty),
                  ),
                  Row(
                    children: _getAscensionTierMaterialRowChild(
                        curData.material2, curData.material2Qty),
                  ),
                  Row(
                    children: _getAscensionTierMaterialRowChild(
                        curData.material3, curData.material3Qty),
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
                onPressed: _untrackWeaponAction,
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
            title:
                Text("Add ${_info.name} Ascension Tier $key to the tracker?"),
            content: SingleChildScrollView(
              child: ListBody(
                children: [
                  GridData.getImageAssetFromFirebase(_info.image, height: 64),
                  Text("Items being added to tracker:"),
                  Row(
                    children: _getAscensionTierMaterialRowChild(
                        curData.material1, curData.material1Qty),
                  ),
                  Row(
                    children: _getAscensionTierMaterialRowChild(
                        curData.material2, curData.material2Qty),
                  ),
                  Row(
                    children: _getAscensionTierMaterialRowChild(
                        curData.material3, curData.material3Qty),
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
                onPressed: _trackWeaponAction,
              ),
            ],
          );
        },
      );
    }
  }

  Widget _getAscensionImage(String itemKey) {
    if (itemKey == null) return Image.memory(kTransparentImage);

    return GridData.getImageAssetFromFirebase(_materialData[itemKey].image,
        height: 16);
  }

  Widget _generateAscensionData() {
    if (_materialData == null) {
      return Padding(
        padding: const EdgeInsets.only(top: 16),
        child: CircularProgressIndicator(),
      );
    }

    Map<String, WeaponAscension> dataMap = _info.ascension;
    List<WeaponAscension> data = dataMap.entries.map((e) => e.value).toList();
    return ListView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: data.length,
      itemBuilder: (context, index) {
        WeaponAscension curData = data[index];
        return Container(
          child: Card(
            color: TrackingUtils.getTrackingColor(index + 1, _isBeingTracked),
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
                    Text(curData.level.toString()),
                    Spacer(),
                    Image.asset("assets/images/items/Icon_Mora.png",
                        height: 16),
                    Text(curData.mora.toString()),
                    Spacer(),
                    _getAscensionImage(curData.material1),
                    Text(curData.material1Qty.toString()),
                    Spacer(),
                    _getAscensionImage(curData.material2),
                    Text((curData.material2Qty == 0)
                        ? ""
                        : curData.material2Qty.toString()),
                    Spacer(),
                    _getAscensionImage(curData.material3),
                    Text(curData.material3Qty.toString()),
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
  void initState() {
    super.initState();
    _infoId = Get.parameters['weapon'];
    _getStaticData();
  }

  void _getStaticData() async {
    Map<String, WeaponData> infoData = await GridData.retrieveWeaponsMapData();
    Map<String, MaterialDataCommon> materialData =
        await GridData.retrieveMaterialsMapData();
    setState(() {
      _info = infoData[_infoId];
      if (_info == null) Get.offAndToNamed('/splash');
      _rarityColor = GridData.getRarityColor(_info.rarity);
      _materialData = materialData;
    });
    _refreshTrackingStatus();
  }

  @override
  Widget build(BuildContext context) {
    if (_info == null) return Util.loadingScreen();
    return Scaffold(
      appBar: AppBar(
        title: Text(_info.name),
        backgroundColor: _rarityColor,
        actions: [
          IconButton(
            icon: Icon(Icons.info_outline),
            onPressed: () => GridData.launchWikiUrl(context, _info),
            tooltip: "View Wiki",
          ),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(8),
        child: SingleChildScrollView(
          child: Column(
            children: [
              Row(
                children: [
                  GridData.getImageAssetFromFirebase(_info.image, height: 64),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _info.type,
                        textAlign: TextAlign.start,
                        style: TextStyle(fontSize: 20),
                      ),
                      RatingBar.builder(
                        ignoreGestures: true,
                        itemCount: 5,
                        itemSize: 30,
                        initialRating: double.tryParse(_info.rarity.toString()),
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
                        child: Text(_info.obtained
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
                        child: Text(_info.description.replaceAll('\\n', "\n")),
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
                    Icon(MdiIcons.sparkles),
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.only(left: 8, right: 8),
                        child: Text(_info.effect.replaceAll('\\n', "\n")),
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
                    Padding(
                      padding: const EdgeInsets.only(left: 8),
                      child: (_info.maxBaseAtk == null)
                          ? Text(_info.baseAtk.toString())
                          : Text("${_info.baseAtk} -> ${_info.maxBaseAtk}"),
                    )
                  ],
                ),
              ),
              Divider(),
              Padding(
                padding: const EdgeInsets.all(8),
                child: Row(
                  children: [
                    Icon(MdiIcons.shield),
                    Padding(
                      padding: const EdgeInsets.only(left: 8, right: 8),
                      child: (_info.maxSecondaryStat == null)
                          ? Text(
                              "${_info.secondaryStat} (${_info.secondaryStatType})")
                          : Text(
                              "${_info.secondaryStat} -> ${_info.maxSecondaryStat} (${_info.secondaryStatType})"),
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
                        "Ascension Materials",
                        style: TextStyle(fontSize: 24),
                      ),
                    ],
                  )),
              Padding(
                padding: const EdgeInsets.only(left: 8, right: 8),
                child: Row(
                  children: [
                    Text(
                        "Select a tier to toggle tracking\nBlue - Getting materials | Green - Enough materials")
                  ],
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
