import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_rating_bar/flutter_rating_bar.dart';
import 'package:flutter_web_browser/flutter_web_browser.dart';
import 'package:get/get.dart';
import 'package:gi_weekly_material_tracker/listeners/sorter.dart';
import 'package:gi_weekly_material_tracker/models/characterdata.dart';
import 'package:gi_weekly_material_tracker/models/grid.dart';
import 'package:gi_weekly_material_tracker/models/materialdata.dart';
import 'package:gi_weekly_material_tracker/models/tracker.dart';
import 'package:gi_weekly_material_tracker/util.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import 'package:transparent_image/transparent_image.dart';
import 'package:url_launcher/url_launcher.dart';

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
                onTap: () =>
                    Get.toNamed('/characters', arguments: [document.id]),
                child: GridData.getGridData(CharacterData.fromJson(document.data())),
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
  CharacterData _info;
  String _infoId;

  Color _rarityColor;

  Map<String, MaterialDataCommon> _materialData;

  Map<String, TrackingStatus> _isBeingTracked;

  void _refreshTrackingStatus() {
    if (_materialData == null || _info == null) return; // No data
    if (_isBeingTracked == null) {
      Map<String, TrackingStatus> _tmpTracker = new Map();
      _info.ascension.keys.forEach((key) {
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
        bool _isTracked =
            TrackingData.isBeingTrackedLocal(_dataList, "${_infoId}_$key");
        CharacterAscension data = _info.ascension[key];
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
      Map<String, Map<String, dynamic>> collectionList = new Map();
      for (String ds in datasets.toList()) {
        collectionList[ds] = await TrackingData.getCollectionList(ds);
      }
      // Run through tracking status and check if its fully tracked
      _tracker.keys.forEach((key) {
        if (_tracker[key] != TrackingStatus.CHECKING) return; // Skip untracked
        bool fullTrack = true;
        CharacterAscension data = _info.ascension[key];
        if (data.material1 != null && fullTrack)
          fullTrack = TrackingData.isMaterialFull(
              _materialData[data.material1].innerType,
              collectionList,
              _materialData,
              "Character_${_infoId}_${data.material1}_$key");
        if (data.material2 != null && fullTrack)
          fullTrack = TrackingData.isMaterialFull(
              _materialData[data.material2].innerType,
              collectionList,
              _materialData,
              "Character_${_infoId}_${data.material2}_$key");
        if (data.material3 != null && fullTrack)
          fullTrack = TrackingData.isMaterialFull(
              _materialData[data.material3].innerType,
              collectionList,
              _materialData,
              "Character_${_infoId}_${data.material3}_$key");
        if (data.material4 != null && fullTrack)
          fullTrack = TrackingData.isMaterialFull(
              _materialData[data.material4].innerType,
              collectionList,
              _materialData,
              "Character_${_infoId}_${data.material4}_$key");
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
    CharacterAscension _ascendTier = _info.ascension[_selectedTier];
    String _ascensionTierSel = _selectedTier;

    TrackingData.addToRecord('character', "${_infoId}_$_selectedTier")
        .then((value) {
      _refreshTrackingStatus();
      Util.showSnackbarQuick(context,
          "${_info.name} Ascension Tier $_ascensionTierSel added to tracker!");
    });
    if (_ascendTier.material1 != null)
      TrackingData.addToCollection(
          "Character_${_infoId}_${_ascendTier.material1}_$_selectedTier",
          _ascendTier.material1,
          _ascendTier.material1Qty,
          _materialData[_ascendTier.material1].innerType,
          'character',
          _infoId);
    if (_ascendTier.material2 != null)
      TrackingData.addToCollection(
          "Character_${_infoId}_${_ascendTier.material2}_$_selectedTier",
          _ascendTier.material2,
          _ascendTier.material2Qty,
          _materialData[_ascendTier.material2].innerType,
          'character',
          _infoId);
    if (_ascendTier.material3 != null)
      TrackingData.addToCollection(
          "Character_${_infoId}_${_ascendTier.material3}_$_selectedTier",
          _ascendTier.material3,
          _ascendTier.material3Qty,
          _materialData[_ascendTier.material3].innerType,
          'character',
          _infoId);
    if (_ascendTier.material4 != null)
      TrackingData.addToCollection(
          "Character_${_infoId}_${_ascendTier.material4}_$_selectedTier",
          _ascendTier.material4,
          _ascendTier.material4Qty,
          _materialData[_ascendTier.material4].innerType,
          'character',
          _infoId);
    Navigator.of(context).pop();
  }

  void _untrackCharacterAction() {
    print("Selected: $_selectedTier");
    CharacterAscension _ascendTier = _info.ascension[_selectedTier];
    String _ascensionTierSel = _selectedTier;

    TrackingData.removeFromRecord('character', "${_infoId}_$_selectedTier")
        .then((value) {
      _refreshTrackingStatus();
      Util.showSnackbarQuick(context,
          "${_info.name} Ascension Tier $_ascensionTierSel removed from tracker!");
    });
    if (_ascendTier.material1 != null)
      TrackingData.removeFromCollection(
          "Character_${_infoId}_${_ascendTier.material1}_$_selectedTier",
          _materialData[_ascendTier.material1].innerType);
    if (_ascendTier.material2 != null)
      TrackingData.removeFromCollection(
          "Character_${_infoId}_${_ascendTier.material2}_$_selectedTier",
          _materialData[_ascendTier.material2].innerType);
    if (_ascendTier.material3 != null)
      TrackingData.removeFromCollection(
          "Character_${_infoId}_${_ascendTier.material3}_$_selectedTier",
          _materialData[_ascendTier.material3].innerType);
    if (_ascendTier.material4 != null)
      TrackingData.removeFromCollection(
          "Character_${_infoId}_${_ascendTier.material4}_$_selectedTier",
          _materialData[_ascendTier.material4].innerType);

    Navigator.of(context).pop();
  }

  List<Widget> _getAscensionTierMaterialRowChild(String key, int qty) {
    return [
      _getAscenionImage(key),
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
                "Remove ${_info.name} Ascension Tier $key from the tracker?"),
            content: SingleChildScrollView(
              child: ListBody(
                children: [
                  GridData.getImageAssetFromFirebase(_info.image, height: 64),
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
            title:
                Text("Add ${_info.name} Ascension Tier $key to the tracker?"),
            content: SingleChildScrollView(
              child: ListBody(
                children: [
                  GridData.getImageAssetFromFirebase(_info.image, height: 64),
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

  @override
  void initState() {
    super.initState();
    _infoId = Get.arguments[0];
    _getStaticData();
  }

  void _getStaticData() async {
    Map<String, CharacterData> infoData =
        await GridData.retrieveCharactersMapData();
    Map<String, MaterialDataCommon> materialData =
        await GridData.retrieveMaterialsMapData();
    setState(() {
      _info = infoData[_infoId];
      _rarityColor = GridData.getRarityColor(_info.rarity);
      _materialData = materialData;
    });
    _refreshTrackingStatus();
  }

  Widget _getAscenionImage(String itemKey) {
    if (itemKey == null) return Image.memory(kTransparentImage, height: 16);

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

    Map<String, CharacterAscension> dataMap = _info.ascension;
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
                    _getAscenionImage(curData.material2),
                    Text((curData.material2Qty == 0)
                        ? ""
                        : curData.material2Qty.toString()),
                    Spacer(),
                    _getAscenionImage(curData.material1),
                    Text(curData.material1Qty.toString()),
                    Spacer(),
                    _getAscenionImage(curData.material3),
                    Text(curData.material3Qty.toString()),
                    Spacer(),
                    _getAscenionImage(curData.material4),
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

  void _openCharacterInfo() async {
    if (_info.genshinGGPath == null) {
      Util.showSnackbarQuick(
          context, "More Info Page not available for ${_info.name}");
      return;
    }
    String fullUrl = Util.genshinGGUrl + _info.genshinGGPath;
    if (GetPlatform.isAndroid || GetPlatform.isIOS) {
      FlutterWebBrowser.openWebPage(
        url: fullUrl,
        customTabsOptions: CustomTabsOptions(
            colorScheme: (Util.themeNotifier.isDarkMode())
                ? CustomTabsColorScheme.dark
                : CustomTabsColorScheme.light,
            toolbarColor: _rarityColor,
            addDefaultShareMenuItem: true,
            showTitle: true,
            urlBarHidingEnabled: true),
        safariVCOptions: SafariViewControllerOptions(
            barCollapsingEnabled: true,
            dismissButtonStyle: SafariViewControllerDismissButtonStyle.close,
            modalPresentationCapturesStatusBarAppearance: true),
      );
      return;
    }
    // Launch through Web
    if (await canLaunch(fullUrl)) {
      await launch(fullUrl);
    } else {
      Util.showSnackbarQuick(
          context, "Failed to launch more info page for ${_info.name}");
    }
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
            onPressed: _openCharacterInfo,
            tooltip: "More Info Page",
          )
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
                      Container(
                        width: 200,
                        child: Text(
                          _info.affiliation,
                          textAlign: TextAlign.start,
                          style: TextStyle(fontSize: 20),
                        ),
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
                  Spacer(),
                  Image.asset(GridData.getElementImageRef(_info.element))
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
                        child: Text(_info.nation),
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
                    Icon(Icons.book),
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.only(left: 8, right: 8),
                        child: Text(_info.introduction.replaceAll('\\n', "\n")),
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
                            child: Text(_info.constellation),
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
                            child: Text(_info.weapon),
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
                          _getGenderIcon(_info.gender, _info.name),
                          Padding(
                            padding: const EdgeInsets.only(left: 8),
                            child: Text(_info.gender),
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
                            child: Text(_info.birthday),
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
      ),
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
