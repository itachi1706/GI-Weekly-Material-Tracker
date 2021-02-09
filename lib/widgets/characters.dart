import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_rating_bar/flutter_rating_bar.dart';
import 'package:get/get.dart';
import 'package:gi_weekly_material_tracker/listeners/sorter.dart';
import 'package:gi_weekly_material_tracker/models/characterdata.dart';
import 'package:gi_weekly_material_tracker/models/grid.dart';
import 'package:gi_weekly_material_tracker/models/materialdata.dart';
import 'package:gi_weekly_material_tracker/models/trackdata.dart';
import 'package:gi_weekly_material_tracker/models/tracker.dart';
import 'package:gi_weekly_material_tracker/placeholder.dart';
import 'package:gi_weekly_material_tracker/util.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import 'package:transparent_image/transparent_image.dart';

final FirebaseFirestore _db = FirebaseFirestore.instance;

class CharacterTabController extends StatefulWidget {
  CharacterTabController({Key key, @required this.tabController, this.notifier})
      : super(key: key);

  final TabController tabController;
  final SortNotifier notifier;

  @override
  _CharacterTabControllerWidgetState createState() =>
      _CharacterTabControllerWidgetState();
}

class _CharacterTabControllerWidgetState extends State<CharacterTabController> {
  @override
  Widget build(BuildContext context) {
    return TabBarView(controller: widget.tabController, children: [
      CharacterListGrid(notifier: widget.notifier),
      CharacterListGrid(filter: "Anemo", notifier: widget.notifier),
      CharacterListGrid(filter: "Cryo", notifier: widget.notifier),
      CharacterListGrid(filter: "Electro", notifier: widget.notifier),
      CharacterListGrid(filter: "Geo", notifier: widget.notifier),
      CharacterListGrid(filter: "Hydro", notifier: widget.notifier),
      CharacterListGrid(filter: "Pyro", notifier: widget.notifier),
    ]);
  }
}

class CharacterListGrid extends StatefulWidget {
  CharacterListGrid({Key key, this.filter, this.notifier});

  final String filter;
  final SortNotifier notifier;

  @override
  _CharacterListGridState createState() => _CharacterListGridState();
}

class _CharacterListGridState extends State<CharacterListGrid> {
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
    CollectionReference characterRef = _db.collection('characters');
    Query queryRef;
    if (widget.filter != null)
      queryRef = characterRef.where("element", isEqualTo: widget.filter);
    if (_sorter != null && queryRef == null)
      queryRef = characterRef
          .orderBy(_sorter, descending: _isDescending)
          .orderBy(FieldPath.documentId);
    else if (_sorter != null)
      queryRef = queryRef
          .orderBy(_sorter, descending: _isDescending)
          .orderBy(FieldPath.documentId);
    return StreamBuilder(
        stream: (queryRef == null)
            ? characterRef.snapshots()
            : queryRef.snapshots(),
        builder: (context, AsyncSnapshot<QuerySnapshot> snapshot) {
          if (snapshot.hasError) {
            return Text("Error occurred getting snapshot");
          }

          if (snapshot.connectionState == ConnectionState.waiting) {
            return Util.centerLoadingCircle("");
          }

          if (widget.filter == null)
            GridData.setStaticData("characters", snapshot.data);
          return GridView.count(
            crossAxisCount:
                (MediaQuery.of(context).orientation == Orientation.portrait)
                    ? 3
                    : 6,
            children: snapshot.data.docs.map((document) {
              return GestureDetector(
                onTap: () => Get.toNamed('/characters/${document.id}'),
                child: GridData.getGridData(
                    CharacterData.fromJson(document.data())),
              );
            }).toList(),
          );
        });
  }
}

class CharacterInfoMainPage extends StatefulWidget {
  @override
  _CharacterInfoMainPageState createState() => _CharacterInfoMainPageState();
}

class _CharacterInfoMainPageState extends State<CharacterInfoMainPage> {
  CharacterData _info;
  String _infoId;

  Color _rarityColor;

  @override
  void initState() {
    super.initState();
    _infoId = Get.parameters['character'];
    _getStaticData();
  }

  void _getStaticData() async {
    Map<String, CharacterData> infoData =
        await GridData.retrieveCharactersMapData();
    setState(() {
      _info = infoData[_infoId];
      if (_info == null) Get.offAndToNamed('/splash');
      _rarityColor = GridData.getRarityColor(_info.rarity);
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_info == null) return Util.loadingScreen();

    return DefaultTabController(
        length: 3,
        child: Scaffold(
          appBar: AppBar(
            title: Text(_info.name),
            backgroundColor: _rarityColor,
            bottom: TabBar(tabs: [
              Tab(text: "General"),
              Tab(text: "Talents"),
              Tab(text: "Constellations"),
            ]),
            actions: [
              IconButton(
                icon: Icon(Icons.info_outline),
                onPressed: () => GridData.launchWikiUrl(context, _info),
                tooltip: "View Wiki",
              ),
              IconButton(
                icon: Icon(MdiIcons.swordCross),
                onPressed: _openCharBuildGuide,
                tooltip: "Build Guide",
              )
            ],
          ),
          body: TabBarView(
            children: [
              CharacterInfoPage(info: _info, infoId: _infoId),
              CharacterTalentPage(info: _info, infoId: _infoId),
              PlaceholderWidgetContainer(Colors.green)
            ],
          ),
        ));
  }

  void _openCharBuildGuide() async {
    if (_info.genshinGGPath == null) {
      Util.showSnackbarQuick(
          context, "Build Guide not available for ${_info.name}");
      return;
    }
    String fullUrl = Util.genshinGGUrl + _info.genshinGGPath;
    if (!await Util.launchWebPage(fullUrl, rarityColor: _rarityColor)) {
      Util.showSnackbarQuick(
          context, "Failed to launch build guide for ${_info.name}");
    }
  }
}

class CharacterInfoPage extends StatefulWidget {
  CharacterInfoPage({Key key, @required this.info, @required this.infoId})
      : super(key: key);

  final CharacterData info;
  final String infoId;

  @override
  _CharacterInfoPageState createState() => _CharacterInfoPageState();
}

class _CharacterInfoPageState extends State<CharacterInfoPage> {
  Map<String, MaterialDataCommon> _materialData;
  Map<String, TrackingStatus> _isBeingTracked;

  @override
  void initState() {
    super.initState();
    _getStaticData();
  }

  void _getStaticData() async {
    Map<String, MaterialDataCommon> materialData =
        await GridData.retrieveMaterialsMapData();
    setState(() {
      _materialData = materialData;
    });
    _refreshTrackingStatus();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.info == null) return Util.loadingScreen();
    return Padding(
      padding: const EdgeInsets.all(8),
      child: SingleChildScrollView(
        child: Column(
          children: [
            Row(
              children: [
                GridData.getImageAssetFromFirebase(widget.info.image,
                    height: 64),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 200,
                      child: Text(
                        widget.info.affiliation,
                        textAlign: TextAlign.start,
                        style: TextStyle(fontSize: 20),
                      ),
                    ),
                    RatingBar.builder(
                      ignoreGestures: true,
                      itemCount: 5,
                      itemSize: 30,
                      initialRating:
                          double.tryParse(widget.info.rarity.toString()),
                      itemBuilder: (context, _) =>
                          Icon(Icons.star, color: Colors.amber),
                      onRatingUpdate: (rating) {
                        print(rating);
                      },
                    ),
                  ],
                ),
                Spacer(),
                Image.asset(GridData.getElementImageRef(widget.info.element))
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
                      child: Text(widget.info.nation),
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
                      child:
                          Text(widget.info.description.replaceAll('\\n', "\n")),
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
                      child: Text(
                          widget.info.introduction.replaceAll('\\n', "\n")),
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
                        Icon(MdiIcons.weatherNight),
                        Padding(
                          padding: const EdgeInsets.only(left: 8),
                          child: Text(widget.info.constellation),
                        )
                      ],
                    ),
                  ),
                  Spacer(),
                  VerticalDivider(),
                  Padding(
                    padding: const EdgeInsets.all(8),
                    child: Row(
                      children: [
                        Icon(MdiIcons.swordCross),
                        Padding(
                          padding: const EdgeInsets.only(left: 8, right: 8),
                          child: Text(widget.info.weapon),
                        )
                      ],
                    ),
                  ),
                  Spacer(),
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
                        _getGenderIcon(widget.info.gender, widget.info.name),
                        Padding(
                          padding: const EdgeInsets.only(left: 8),
                          child: Text(widget.info.gender),
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
                          child: Text(widget.info.birthday),
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
    );
  }

  void _refreshTrackingStatus() {
    if (_materialData == null || widget.info == null) return; // No data
    if (_isBeingTracked == null) {
      Map<String, TrackingStatus> _tmpTracker = new Map();
      widget.info.ascension.keys.forEach((key) {
        _tmpTracker[key] = TrackingStatus.UNKNOWN;
      });
      setState(() {
        _isBeingTracked = _tmpTracker;
      });
    }

    Map<String, TrackingStatus> _tracker = _isBeingTracked;
    TrackingData.getTrackingCategory('character').then((_dataList) async {
      print(_dataList);
      Set<String> datasets = new Set();
      // Check tracking status and get material list
      _tracker.keys.forEach((key) {
        bool _isTracked = TrackingData.isBeingTrackedLocal(
            _dataList, "${widget.infoId}_$key");
        CharacterAscension data = widget.info.ascension[key];
        if (data.material1 != null)
          datasets.add(_materialData[data.material1].innerType);
        if (data.material2 != null)
          datasets.add(_materialData[data.material2].innerType);
        if (data.material3 != null)
          datasets.add(_materialData[data.material3].innerType);
        if (data.material4 != null)
          datasets.add(_materialData[data.material4].innerType);
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
        CharacterAscension data = widget.info.ascension[key];
        if (data.material1 != null && fullTrack)
          fullTrack = TrackingData.isMaterialFull(
              _materialData[data.material1].innerType,
              collectionList,
              _materialData,
              "Character_${widget.infoId}_${data.material1}_$key");
        if (data.material2 != null && fullTrack)
          fullTrack = TrackingData.isMaterialFull(
              _materialData[data.material2].innerType,
              collectionList,
              _materialData,
              "Character_${widget.infoId}_${data.material2}_$key");
        if (data.material3 != null && fullTrack)
          fullTrack = TrackingData.isMaterialFull(
              _materialData[data.material3].innerType,
              collectionList,
              _materialData,
              "Character_${widget.infoId}_${data.material3}_$key");
        if (data.material4 != null && fullTrack)
          fullTrack = TrackingData.isMaterialFull(
              _materialData[data.material4].innerType,
              collectionList,
              _materialData,
              "Character_${widget.infoId}_${data.material4}_$key");
        _tracker[key] = (fullTrack)
            ? TrackingStatus.TRACKED_COMPLETE_MATERIAL
            : TrackingStatus.TRACKED_INCOMPLETE_MATERIAL;
      });

      setState(() {
        if (!mounted) return;
        _isBeingTracked = _tracker;
      });
    });
  }

  TrackingStatus _isBeingTrackedStatus(String key) {
    if (!_isBeingTracked.keys.contains(key)) return TrackingStatus.UNKNOWN;
    return _isBeingTracked[key];
  }

  void _trackCharacterAction() {
    print("Selected: $_selectedTier");
    CharacterAscension _ascendTier = widget.info.ascension[_selectedTier];
    String _ascensionTierSel = _selectedTier;

    TrackingData.addToRecord('character', "${widget.infoId}_$_selectedTier")
        .then((value) {
      _refreshTrackingStatus();
      Util.showSnackbarQuick(context,
          "${widget.info.name} Ascension Tier $_ascensionTierSel added to tracker!");
    });
    if (_ascendTier.material1 != null)
      TrackingData.addToCollection(
          "Character_${widget.infoId}_${_ascendTier.material1}_$_selectedTier",
          _ascendTier.material1,
          _ascendTier.material1Qty,
          _materialData[_ascendTier.material1].innerType,
          'character',
          widget.infoId);
    if (_ascendTier.material2 != null)
      TrackingData.addToCollection(
          "Character_${widget.infoId}_${_ascendTier.material2}_$_selectedTier",
          _ascendTier.material2,
          _ascendTier.material2Qty,
          _materialData[_ascendTier.material2].innerType,
          'character',
          widget.infoId);
    if (_ascendTier.material3 != null)
      TrackingData.addToCollection(
          "Character_${widget.infoId}_${_ascendTier.material3}_$_selectedTier",
          _ascendTier.material3,
          _ascendTier.material3Qty,
          _materialData[_ascendTier.material3].innerType,
          'character',
          widget.infoId);
    if (_ascendTier.material4 != null)
      TrackingData.addToCollection(
          "Character_${widget.infoId}_${_ascendTier.material4}_$_selectedTier",
          _ascendTier.material4,
          _ascendTier.material4Qty,
          _materialData[_ascendTier.material4].innerType,
          'character',
          widget.infoId);
    Navigator.of(context).pop();
  }

  void _untrackCharacterAction() {
    print("Selected: $_selectedTier");
    CharacterAscension _ascendTier = widget.info.ascension[_selectedTier];
    String _ascensionTierSel = _selectedTier;

    TrackingData.removeFromRecord(
            'character', "${widget.infoId}_$_selectedTier")
        .then((value) {
      _refreshTrackingStatus();
      Util.showSnackbarQuick(context,
          "${widget.info.name} Ascension Tier $_ascensionTierSel removed from tracker!");
    });
    if (_ascendTier.material1 != null)
      TrackingData.removeFromCollection(
          "Character_${widget.infoId}_${_ascendTier.material1}_$_selectedTier",
          _materialData[_ascendTier.material1].innerType);
    if (_ascendTier.material2 != null)
      TrackingData.removeFromCollection(
          "Character_${widget.infoId}_${_ascendTier.material2}_$_selectedTier",
          _materialData[_ascendTier.material2].innerType);
    if (_ascendTier.material3 != null)
      TrackingData.removeFromCollection(
          "Character_${widget.infoId}_${_ascendTier.material3}_$_selectedTier",
          _materialData[_ascendTier.material3].innerType);
    if (_ascendTier.material4 != null)
      TrackingData.removeFromCollection(
          "Character_${widget.infoId}_${_ascendTier.material4}_$_selectedTier",
          _materialData[_ascendTier.material4].innerType);

    Navigator.of(context).pop();
  }

  List<Widget> _getAscensionTierMaterialRowChild(String key, int qty) {
    return [
      GridData.getAscensionImage(key, _materialData),
      Text(key == null ? "" : _materialData[key].name),
      Text((qty == 0) ? "" : " x$qty"),
    ];
  }

  String _selectedTier;

  void _addOrRemoveMaterial(int index, CharacterAscension curData) async {
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
                "Remove ${widget.info.name} Ascension Tier $key from the tracker?"),
            content: SingleChildScrollView(
              child: ListBody(
                children: [
                  GridData.getImageAssetFromFirebase(widget.info.image,
                      height: 64),
                  Text(
                      "This will remove the following materials being tracked for this character from the tracker:"),
                  Row(
                    children: _getAscensionTierMaterialRowChild(
                        curData.material2, curData.material2Qty),
                  ),
                  Row(
                    children: _getAscensionTierMaterialRowChild(
                        curData.material1, curData.material1Qty),
                  ),
                  Row(
                    children: _getAscensionTierMaterialRowChild(
                        curData.material3, curData.material3Qty),
                  ),
                  Row(
                    children: _getAscensionTierMaterialRowChild(
                        curData.material4, curData.material4Qty),
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
                "Add ${widget.info.name} Ascension Tier $key to the tracker?"),
            content: SingleChildScrollView(
              child: ListBody(
                children: [
                  GridData.getImageAssetFromFirebase(widget.info.image,
                      height: 64),
                  Text("Items being added to tracker:"),
                  Row(
                    children: _getAscensionTierMaterialRowChild(
                        curData.material2, curData.material2Qty),
                  ),
                  Row(
                    children: _getAscensionTierMaterialRowChild(
                        curData.material1, curData.material1Qty),
                  ),
                  Row(
                    children: _getAscensionTierMaterialRowChild(
                        curData.material3, curData.material3Qty),
                  ),
                  Row(
                    children: _getAscensionTierMaterialRowChild(
                        curData.material4, curData.material4Qty),
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

  Widget _generateAscensionData() {
    if (_materialData == null) {
      return Padding(
        padding: const EdgeInsets.only(top: 16),
        child: CircularProgressIndicator(),
      );
    }

    Map<String, CharacterAscension> dataMap = widget.info.ascension;
    List<CharacterAscension> data =
        dataMap.entries.map((e) => e.value).toList();
    return ListView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: data.length,
      itemBuilder: (context, index) {
        CharacterAscension curData = data[index];
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
                    GridData.getAscensionImage(curData.material2, _materialData),
                    Text((curData.material2Qty == 0)
                        ? ""
                        : curData.material2Qty.toString()),
                    Spacer(),
                    GridData.getAscensionImage(curData.material1, _materialData),
                    Text(curData.material1Qty.toString()),
                    Spacer(),
                    GridData.getAscensionImage(curData.material3, _materialData),
                    Text(curData.material3Qty.toString()),
                    Spacer(),
                    GridData.getAscensionImage(curData.material4, _materialData),
                    Text(curData.material4Qty.toString()),
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

  Icon _getGenderIcon(String gender, String name) {
    Color color;
    IconData icon = MdiIcons.genderFemale;
    if (gender.toLowerCase() == "male") {
      icon = MdiIcons.genderMale;
      if (Util.themeNotifier.isDarkMode())
        color = Colors.lightBlue;
      else
        color = Colors.blue;
    } else if (Util.themeNotifier.isDarkMode())
      color = Colors.pinkAccent;
    else
      color = Colors.pink;

    if (name == "Aether/Lumine") return Icon(MdiIcons.genderMaleFemale);
    return Icon(icon, color: color);
  }
}

class CharacterTalentPage extends StatefulWidget {
  CharacterTalentPage({Key key, @required this.info, @required this.infoId})
      : super(key: key);

  final CharacterData info;
  final String infoId;

  @override
  _CharacterTalentPageState createState() => _CharacterTalentPageState();
}

class _CharacterTalentPageState extends State<CharacterTalentPage> {
  Map<String, MaterialDataCommon> _materialData;

  @override
  void initState() {
    super.initState();
    _getStaticData();
  }

  void _getStaticData() async {
    Map<String, MaterialDataCommon> materialData =
        await GridData.retrieveMaterialsMapData();
    setState(() {
      _materialData = materialData;
    });
    // TODO: Track Talents
    //_refreshTrackingStatus();
  }
  
  Map<String, TrackingStatus> _isBeingTracked = new Map();

  Widget _generateAscensionData(Map<String, CharacterAscension> ascendInfo) {
    if (_materialData == null) {
      return Padding(
        padding: const EdgeInsets.only(top: 16),
        child: CircularProgressIndicator(),
      );
    }
    
    List<CharacterAscension> data = ascendInfo.entries.map((e) => e.value).toList();
    return ListView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: data.length,
      itemBuilder: (context, index) {
        CharacterAscension curData = data[index];
        return Container(
          child: Card(
            //color: TrackingUtils.getTrackingColor(index + 1, _isBeingTracked),
            child: InkWell(
              //onTap: () => _addOrRemoveMaterial(index + 1, curData),
              child: Padding(
                padding: const EdgeInsets.all(8),
                child: Row(
                  children: [
                    Text(
                      GridData.getRomanNumberArray(index+1),
                      style: TextStyle(fontSize: 24),
                    ),
                    Spacer(),
                    Image.asset("assets/images/items/Icon_Mora.png", height: 16),
                    Padding(padding: const EdgeInsets.only(left: 4),
                    child: Text(curData.mora.toString()),),
                    Spacer(),
                    GridData.getAscensionImage(curData.material3, _materialData),
                    Text((curData.material3Qty == 0) ? "" : curData.material3Qty.toString()),
                    Spacer(),
                    GridData.getAscensionImage(curData.material4, _materialData),
                    Text((curData.material4Qty == 0) ? "" : curData.material4Qty.toString()),
                    Spacer(),
                    GridData.getAscensionImage(curData.material2, _materialData),
                    Text((curData.material2Qty == 0) ? "" : curData.material2Qty.toString()),
                    Spacer(),
                    GridData.getAscensionImage(curData.material1, _materialData),
                    Text((curData.material1Qty == 0) ? "" : curData.material1Qty.toString()),
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

  void _showDescription(TalentInfo _talInfo) {
    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: Row(
            children: [
              GridData.getImageAssetFromFirebase(_talInfo.image, height: 32),
              Expanded(child: Text(_talInfo.name))
            ],
          ),
          content: SingleChildScrollView(
            child: Text(_talInfo.effect),
          ),
          actions: [
            TextButton(
              child: Text('Close'),
              onPressed: () => Navigator.of(context).pop(),
            ),
          ],
        );
      }
    );
  }

  Widget _shouldShowTalentDescription(TalentInfo _talInfo, bool show) {
    if (!show) return SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: 4),
      child: Text(_talInfo.effect),
    );
  }

  Widget _generateTalentWidget(TalentInfo _talInfo, bool _isPassive) {
    return InkWell(
      onTap: () => _showDescription(_talInfo),
      child: Padding(
        padding: const EdgeInsets.all(8),
        child: Column(
          children: [
            IntrinsicHeight(
              child: Row(
                children: [
                  GridData.getImageAssetFromFirebase(_talInfo.image, height: 32),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        width: MediaQuery.of(context).size.width - 80,
                        child: Text(
                          _talInfo.name,
                          textAlign: TextAlign.start,
                          style: TextStyle(fontSize: 18),
                        ),
                      ),
                      Text(_talInfo.type),
                    ],
                  ),
                ],
              ),
            ),
            _shouldShowTalentDescription(_talInfo, _isPassive)
          ],
        ),
      ),
    );
  }

  List<Widget> _attackTalentWidgets() {
    List<Widget> _wid = [];
    widget.info.talent.attack.forEach((key, value) {
      Map<String, CharacterAscension> _ascendInfo = widget.info.talent.ascension;
      _wid.add(_generateTalentWidget(value, false));
      _wid.add(_generateAscensionData(_ascendInfo));
      _wid.add(Divider());
    });

    return _wid;
  }

  List<Widget> _passiveTalentWidgets() {
    List<Widget> _wid = [];
    widget.info.talent.passive.forEach((key, value) {
      _wid.add(_generateTalentWidget(value, true));
      _wid.add(Divider());
    });

    return _wid;
  }

  @override
  Widget build(BuildContext context) {
    if (widget.info == null) return Util.loadingScreen();
    return Padding(
      padding: const EdgeInsets.all(8),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text("Attack Talents", style: TextStyle(fontSize: 18)),
            ..._attackTalentWidgets(),
            Text("Passive Talents", style: TextStyle(fontSize: 18)),
            ..._passiveTalentWidgets()
          ],
        ),
      ),
    );
  }
}
