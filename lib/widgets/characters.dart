import 'dart:collection';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_rating_bar/flutter_rating_bar.dart';
import 'package:get/get.dart';
import 'package:gi_weekly_material_tracker/helpers/grid.dart';
import 'package:gi_weekly_material_tracker/helpers/tracker.dart';
import 'package:gi_weekly_material_tracker/listeners/sorter.dart';
import 'package:gi_weekly_material_tracker/models/characterdata.dart';
import 'package:gi_weekly_material_tracker/models/materialdata.dart';
import 'package:gi_weekly_material_tracker/models/trackdata.dart';
import 'package:gi_weekly_material_tracker/util.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import 'package:shared_preferences/shared_preferences.dart';

final FirebaseFirestore _db = FirebaseFirestore.instance;

class CharacterTabController extends StatefulWidget {
  final TabController? tabController;
  final SortNotifier? notifier;

  CharacterTabController({Key? key, required this.tabController, this.notifier})
      : super(key: key);

  @override
  _CharacterTabControllerWidgetState createState() =>
      _CharacterTabControllerWidgetState();
}

class _CharacterTabControllerWidgetState extends State<CharacterTabController> {
  @override
  Widget build(BuildContext context) {
    return TabBarView(controller: widget.tabController, children: [
      CharacterListGrid(notifier: widget.notifier),
      CharacterListGrid(filter: 'Anemo', notifier: widget.notifier),
      CharacterListGrid(filter: 'Cryo', notifier: widget.notifier),
      CharacterListGrid(filter: 'Electro', notifier: widget.notifier),
      CharacterListGrid(filter: 'Geo', notifier: widget.notifier),
      CharacterListGrid(filter: 'Hydro', notifier: widget.notifier),
      CharacterListGrid(filter: 'Pyro', notifier: widget.notifier),
    ]);
  }
}

class CharacterListGrid extends StatefulWidget {
  final String? filter;
  final SortNotifier? notifier;

  CharacterListGrid({Key? key, this.filter, this.notifier});

  @override
  _CharacterListGridState createState() => _CharacterListGridState();
}

class _CharacterListGridState extends State<CharacterListGrid> {
  String? _sorter;
  bool _isDescending = false;

  @override
  void initState() {
    super.initState();
    widget.notifier!.addListener(() {
      if (!mounted) return;
      setState(() {
        _sorter = widget.notifier!.getSortKey();
        _isDescending = widget.notifier!.isDescending();
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    var characterRef = _db.collection('characters');
    Query? queryRef;
    if (widget.filter != null) {
      queryRef = characterRef.where('element', isEqualTo: widget.filter);
    }
    if (_sorter != null && queryRef == null) {
      queryRef = characterRef
          .orderBy(_sorter!, descending: _isDescending)
          .orderBy(FieldPath.documentId);
    } else if (_sorter != null) {
      queryRef = queryRef!
          .orderBy(_sorter!, descending: _isDescending)
          .orderBy(FieldPath.documentId);
    }

    return StreamBuilder(
      stream:
          (queryRef == null) ? characterRef.snapshots() : queryRef.snapshots(),
      builder: (context, AsyncSnapshot<QuerySnapshot> snapshot) {
        if (snapshot.hasError) {
          return Text('Error occurred getting snapshot');
        }

        if (snapshot.connectionState == ConnectionState.waiting) {
          return Util.centerLoadingCircle('');
        }

        if (widget.filter == null) {
          GridData.setStaticData('characters', snapshot.data);
        }

        var dt = GridData.getDataListFilteredRelease(snapshot.data!.docs);

        return GridView.count(
          crossAxisCount:
              (MediaQuery.of(context).orientation == Orientation.portrait)
                  ? 3
                  : 6,
          children: dt.map((document) {
            return GestureDetector(
              onTap: () => Get.toNamed('/characters/${document.id}'),
              child: GridData.getGridData(
                CharacterData.fromJson(document.data() as Map<String, dynamic>),
              ),
            );
          }).toList(),
        );
      },
    );
  }
}

class CharacterInfoMainPage extends StatefulWidget {
  @override
  _CharacterInfoMainPageState createState() => _CharacterInfoMainPageState();
}

class _CharacterInfoMainPageState extends State<CharacterInfoMainPage> {
  CharacterData? _info;
  String? _infoId;
  Color? _rarityColor;

  Map<String, MaterialDataCommon>? _materialData;
  late SharedPreferences _prefs;
  String? _bgSource;

  @override
  void initState() {
    super.initState();
    _infoId = Get.parameters['character'];
    _getStaticData();
  }

  @override
  Widget build(BuildContext context) {
    if (_info == null) return Util.loadingScreen();

    return DefaultTabController(
      length: 3,
      child: Scaffold(
        appBar: AppBar(
          title: Text(_info!.name!),
          backgroundColor: _rarityColor,
          bottom: TabBar(tabs: [
            Tab(text: 'General'),
            Tab(text: 'Talents'),
            Tab(text: 'Constellations'),
          ]),
          actions: [
            IconButton(
              icon: Icon(Icons.info_outline),
              onPressed: () => GridData.launchWikiUrl(context, _info!),
              tooltip: 'View Wiki',
            ),
            IconButton(
              icon: Icon(MdiIcons.swordCross),
              onPressed: _openCharBuildGuide,
              tooltip: 'Build Guide ($_bgSource)',
            ),
          ],
        ),
        body: TabBarView(
          children: [
            CharacterInfoPage(
              info: _info,
              infoId: _infoId,
              materialData: _materialData,
            ),
            CharacterTalentPage(
              info: _info,
              infoId: _infoId,
              materialData: _materialData,
            ),
            CharacterConstellationPage(info: _info),
          ],
        ),
      ),
    );
  }

  void _getStaticData() async {
    var infoData = await GridData.retrieveCharactersMapData();
    var materialData = await GridData.retrieveMaterialsMapData();
    _prefs = await SharedPreferences.getInstance();
    setState(() {
      _info = infoData![_infoId!];
      if (_info == null) Get.offAndToNamed('/splash');
      _materialData = materialData;
      _bgSource = _prefs.getString('build_guide_source') ?? 'genshin.gg';
      _rarityColor =
          GridData.getRarityColor(_info!.rarity, crossover: _info!.crossover);
    });
  }

  void _openCharBuildGuide() async {
    var source = Util.genshinGGUrl;
    var sourcePath = _info!.genshinGGPath;
    if (_bgSource == 'paimon.moe') {
      source = Util.paimonMoeUrl;
      sourcePath = _info!.paimonMoePath;
    }

    if (sourcePath == null) {
      Util.showSnackbarQuick(
        context,
        'Build Guide not available for ${_info!.name} on $_bgSource',
      );

      return;
    }

    var fullUrl = source + sourcePath;
    if (!await Util.launchWebPage(fullUrl, rarityColor: _rarityColor)) {
      Util.showSnackbarQuick(
        context,
        'Failed to launch build guide for ${_info!.name} on $_bgSource',
      );
    }
  }
}

class CharacterInfoPage extends StatefulWidget {
  final CharacterData? info;
  final String? infoId;
  final Map<String, MaterialDataCommon>? materialData;

  CharacterInfoPage({
    Key? key,
    required this.info,
    required this.infoId,
    required this.materialData,
  }) : super(key: key);

  @override
  _CharacterInfoPageState createState() => _CharacterInfoPageState();
}

class _CharacterInfoPageState extends State<CharacterInfoPage> {
  Map<String, TrackingStatus>? _isBeingTracked;

  String? _selectedTier;

  @override
  void initState() {
    super.initState();
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
            _getCharacterHeader(),
            Divider(),
            ..._getCharacterFullNameWidget(widget.info!),
            ...GridData.generateInfoLine(
              widget.info!.affiliation!,
              Icons.flag,
            ),
            ...GridData.generateInfoLine(
              widget.info!.nation!,
              Icons.location_pin,
            ),
            ...GridData.generateInfoLine(
              widget.info!.description!,
              Icons.format_list_bulleted,
            ),
            ...GridData.generateInfoLine(widget.info!.introduction!, Icons.book),
            _getConstellationWeaponWidget(),
            Divider(),
            _getGenderBirthdayWidget(),
            Divider(),
            ...TrackingData.getAscensionHeader(),
            _generateAscensionData(),
          ],
        ),
      ),
    );
  }

  List<Widget> _getCharacterFullNameWidget(CharacterData info) {
    var finalWidget = <Widget>[SizedBox.shrink()];
    if (info.fullName != null) {
      finalWidget = GridData.generateInfoLine(
        info.fullName!,
        Icons.account_circle,
      );
    }

    return finalWidget;
  }

  Widget _getGenderBirthdayWidget() {
    return IntrinsicHeight(
      child: Row(
        children: [
          Padding(
            padding: const EdgeInsets.all(8),
            child: Row(
              children: [
                _getGenderIcon(widget.info!.gender!, widget.info!.name!),
                Padding(
                  padding: const EdgeInsets.only(left: 8),
                  child: Text(widget.info!.gender!),
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
                  child: Text(widget.info!.birthday!),
                ),
              ],
            ),
          ),
          Spacer(),
        ],
      ),
    );
  }

  Widget _getConstellationWeaponWidget() {
    return IntrinsicHeight(
      child: Row(
        children: [
          Padding(
            padding: const EdgeInsets.all(8),
            child: Row(
              children: [
                Icon(MdiIcons.weatherNight),
                Padding(
                  padding: const EdgeInsets.only(left: 8),
                  child: Text(widget.info!.constellation!),
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
                Icon(MdiIcons.swordCross),
                Padding(
                  padding: const EdgeInsets.only(left: 8, right: 8),
                  child: Text(widget.info!.weapon!),
                ),
              ],
            ),
          ),
          Spacer(),
        ],
      ),
    );
  }

  Widget _getCharacterHeader() {
    return Row(
      children: [
        GridData.getImageAssetFromFirebase(
          widget.info!.image,
          height: 64,
        ),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 200,
              child: Text(
                widget.info!.caption!,
                textAlign: TextAlign.start,
                style: TextStyle(fontSize: 20),
              ),
            ),
            RatingBar.builder(
              ignoreGestures: true,
              itemCount: 5,
              itemSize: 30,
              initialRating: double.tryParse(widget.info!.rarity.toString())!,
              itemBuilder: (context, _) =>
                  Icon(Icons.star, color: Colors.amber),
              onRatingUpdate: (rating) {
                print(rating);
              },
            ),
          ],
        ),
        Spacer(),
        Image.asset(GridData.getElementImageRef(widget.info!.element!)!),
      ],
    );
  }

  void _refreshTrackingStatus() {
    if (widget.materialData == null || widget.info == null) return; // No data
    if (_isBeingTracked == null) {
      var _tmpTracker = <String, TrackingStatus>{};
      widget.info!.ascension!.keys.forEach((key) {
        _tmpTracker[key] = TrackingStatus.UNKNOWN;
      });
      setState(() {
        _isBeingTracked = _tmpTracker;
      });
    }

    var _tracker = _isBeingTracked;
    TrackingData.getTrackingCategory('character').then((_dataList) async {
      print(_dataList);
      var datasets = <String?>{};
      // Check tracking status and get material list
      _tracker!.keys.forEach((key) {
        var _isTracked = TrackingData.isBeingTrackedLocal(
          _dataList,
          '${widget.infoId}_$key',
        );
        var data = widget.info!.ascension![key]!;
        if (data.material1 != null) {
          datasets.add(widget.materialData![data.material1!]!.innerType);
        }
        if (data.material2 != null) {
          datasets.add(widget.materialData![data.material2!]!.innerType);
        }
        if (data.material3 != null) {
          datasets.add(widget.materialData![data.material3!]!.innerType);
        }
        if (data.material4 != null) {
          datasets.add(widget.materialData![data.material4!]!.innerType);
        }
        _tracker![key] =
            (_isTracked) ? TrackingStatus.CHECKING : TrackingStatus.NOT_TRACKED;
      });

      _tracker = await _processTrackingStatus(datasets, _tracker!);

      if (mounted) {
        setState(() {
          _isBeingTracked = _tracker;
        });
      }
    });
  }

  Future<Map<String, TrackingStatus>> _processTrackingStatus(
    Set<String?> datasets,
    Map<String, TrackingStatus> _tracker,
  ) async {
    // Get all datasets into a map to check if completed
    var collectionList = <String?, Map<String, TrackingUserData>>{};
    for (var ds in datasets.toList()) {
      collectionList[ds] = await TrackingData.getCollectionList(ds!);
    }
    // Run through tracking status and check if its fully tracked
    _tracker.keys.forEach((key) {
      if (_tracker[key] != TrackingStatus.CHECKING) return; // Skip untracked
      var fullTrack = true;
      var data = widget.info!.ascension![key]!;
      if (data.material1 != null && fullTrack) {
        fullTrack = TrackingData.isMaterialFull(
          widget.materialData![data.material1!]!.innerType,
          collectionList,
          widget.materialData,
          'Character_${widget.infoId}_${data.material1}_$key',
        );
      }
      if (data.material2 != null && fullTrack) {
        fullTrack = TrackingData.isMaterialFull(
          widget.materialData![data.material2!]!.innerType,
          collectionList,
          widget.materialData,
          'Character_${widget.infoId}_${data.material2}_$key',
        );
      }
      if (data.material3 != null && fullTrack) {
        fullTrack = TrackingData.isMaterialFull(
          widget.materialData![data.material3!]!.innerType,
          collectionList,
          widget.materialData,
          'Character_${widget.infoId}_${data.material3}_$key',
        );
      }
      if (data.material4 != null && fullTrack) {
        fullTrack = TrackingData.isMaterialFull(
          widget.materialData![data.material4!]!.innerType,
          collectionList,
          widget.materialData,
          'Character_${widget.infoId}_${data.material4}_$key',
        );
      }
      _tracker[key] = (fullTrack)
          ? TrackingStatus.TRACKED_COMPLETE_MATERIAL
          : TrackingStatus.TRACKED_INCOMPLETE_MATERIAL;
    });

    return _tracker;
  }

  TrackingStatus? _isBeingTrackedStatus(String key) {
    return (!_isBeingTracked!.keys.contains(key))
        ? TrackingStatus.UNKNOWN
        : _isBeingTracked![key];
  }

  void _trackCharacterAction() {
    print('Selected: $_selectedTier');
    var _ascendTier = widget.info!.ascension![_selectedTier!]!;
    var _ascensionTierSel = _selectedTier;

    TrackingData.addToRecord('character', '${widget.infoId}_$_selectedTier')
        .then((value) {
      _refreshTrackingStatus();
      Util.showSnackbarQuick(
        context,
        '${widget.info!.name} Ascension Tier $_ascensionTierSel added to tracker!',
      );
    });
    if (_ascendTier.material1 != null) {
      TrackingData.addToCollection(
        'Character_${widget.infoId}_${_ascendTier.material1}_$_selectedTier',
        _ascendTier.material1,
        _ascendTier.material1Qty,
        widget.materialData![_ascendTier.material1!]!.innerType,
        'character',
        widget.infoId,
      );
    }
    if (_ascendTier.material2 != null) {
      TrackingData.addToCollection(
        'Character_${widget.infoId}_${_ascendTier.material2}_$_selectedTier',
        _ascendTier.material2,
        _ascendTier.material2Qty,
        widget.materialData![_ascendTier.material2!]!.innerType,
        'character',
        widget.infoId,
      );
    }
    if (_ascendTier.material3 != null) {
      TrackingData.addToCollection(
        'Character_${widget.infoId}_${_ascendTier.material3}_$_selectedTier',
        _ascendTier.material3,
        _ascendTier.material3Qty,
        widget.materialData![_ascendTier.material3!]!.innerType,
        'character',
        widget.infoId,
      );
    }
    if (_ascendTier.material4 != null) {
      TrackingData.addToCollection(
        'Character_${widget.infoId}_${_ascendTier.material4}_$_selectedTier',
        _ascendTier.material4,
        _ascendTier.material4Qty,
        widget.materialData![_ascendTier.material4!]!.innerType,
        'character',
        widget.infoId,
      );
    }
    Navigator.of(context).pop();
  }

  void _untrackCharacterAction() {
    print('Selected: $_selectedTier');
    var _ascendTier = widget.info!.ascension![_selectedTier!]!;
    var _ascensionTierSel = _selectedTier;

    TrackingData.removeFromRecord(
      'character',
      '${widget.infoId}_$_selectedTier',
    ).then((value) {
      _refreshTrackingStatus();
      Util.showSnackbarQuick(
        context,
        '${widget.info!.name} Ascension Tier $_ascensionTierSel removed from tracker!',
      );
    });
    if (_ascendTier.material1 != null) {
      TrackingData.removeFromCollection(
        'Character_${widget.infoId}_${_ascendTier.material1}_$_selectedTier',
        widget.materialData![_ascendTier.material1!]!.innerType,
      );
    }
    if (_ascendTier.material2 != null) {
      TrackingData.removeFromCollection(
        'Character_${widget.infoId}_${_ascendTier.material2}_$_selectedTier',
        widget.materialData![_ascendTier.material2!]!.innerType,
      );
    }
    if (_ascendTier.material3 != null) {
      TrackingData.removeFromCollection(
        'Character_${widget.infoId}_${_ascendTier.material3}_$_selectedTier',
        widget.materialData![_ascendTier.material3!]!.innerType,
      );
    }
    if (_ascendTier.material4 != null) {
      TrackingData.removeFromCollection(
        'Character_${widget.infoId}_${_ascendTier.material4}_$_selectedTier',
        widget.materialData![_ascendTier.material4!]!.innerType,
      );
    }

    Navigator.of(context).pop();
  }

  List<Widget> _getAscensionTierMaterialRowChild(String? key, int? qty) {
    return [
      GridData.getAscensionImage(key, widget.materialData),
      Text(key == null ? '' : widget.materialData![key]!.name!),
      Text((qty == 0) ? '' : ' x$qty'),
    ];
  }

  void _addOrRemoveMaterial(int index, CharacterAscension curData) async {
    var key = index.toString();
    var isTracked = _isBeingTrackedStatus(key);
    if (isTracked == TrackingStatus.UNKNOWN ||
        isTracked == TrackingStatus.CHECKING) {
      Util.showSnackbarQuick(context, 'Checking tracking status');

      return;
    }

    setState(() {
      _selectedTier = key;
    });

    if (isTracked == TrackingStatus.TRACKED_INCOMPLETE_MATERIAL ||
        isTracked == TrackingStatus.TRACKED_COMPLETE_MATERIAL) {
      await _removeMaterial(curData, key);
    } else {
      await _addMaterial(curData, key);
    }
  }

  Future<void> _removeMaterial(CharacterAscension curData, String key) async {
    await showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: Text(
            'Remove ${widget.info!.name} Ascension Tier $key from the tracker?',
          ),
          content: SingleChildScrollView(
            child: ListBody(
              children: [
                GridData.getImageAssetFromFirebase(
                  widget.info!.image,
                  height: 64,
                ),
                Text(
                  'This will remove the following materials being tracked for this character from the tracker:',
                ),
                Row(
                  children: _getAscensionTierMaterialRowChild(
                    curData.material2,
                    curData.material2Qty,
                  ),
                ),
                Row(
                  children: _getAscensionTierMaterialRowChild(
                    curData.material1,
                    curData.material1Qty,
                  ),
                ),
                Row(
                  children: _getAscensionTierMaterialRowChild(
                    curData.material3,
                    curData.material3Qty,
                  ),
                ),
                Row(
                  children: _getAscensionTierMaterialRowChild(
                    curData.material4,
                    curData.material4Qty,
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: Text('Cancel'),
            ),
            TextButton(
              onPressed: _untrackCharacterAction,
              child: Text('Untrack'),
            ),
          ],
        );
      },
    );
  }

  Future<void> _addMaterial(CharacterAscension curData, String key) async {
    await showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: Text(
            'Add ${widget.info!.name} Ascension Tier $key to the tracker?',
          ),
          content: SingleChildScrollView(
            child: ListBody(
              children: [
                GridData.getImageAssetFromFirebase(
                  widget.info!.image,
                  height: 64,
                ),
                Text('Items being added to tracker:'),
                Row(
                  children: _getAscensionTierMaterialRowChild(
                    curData.material2,
                    curData.material2Qty,
                  ),
                ),
                Row(
                  children: _getAscensionTierMaterialRowChild(
                    curData.material1,
                    curData.material1Qty,
                  ),
                ),
                Row(
                  children: _getAscensionTierMaterialRowChild(
                    curData.material3,
                    curData.material3Qty,
                  ),
                ),
                Row(
                  children: _getAscensionTierMaterialRowChild(
                    curData.material4,
                    curData.material4Qty,
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: Text('Cancel'),
            ),
            TextButton(
              onPressed: _trackCharacterAction,
              child: Text('Track'),
            ),
          ],
        );
      },
    );
  }

  Widget _generateAscensionData() {
    if (widget.materialData == null) {
      return Padding(
        padding: const EdgeInsets.only(top: 16),
        child: CircularProgressIndicator(),
      );
    }

    var dataMap = widget.info!.ascension!;
    var data = dataMap.entries.map((e) => e.value).toList();

    return ListView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: data.length,
      itemBuilder: (context, index) {
        var curData = data[index];

        return _getAscensionTierWidget(curData, index);
      },
    );
  }

  Widget _getAscensionTierWidget(CharacterAscension curData, int index) {
    return Container(
      child: Card(
        color: TrackingUtils.getTrackingColor(index + 1, _isBeingTracked!),
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
                Image.asset(
                  'assets/images/items/Icon_Mora.png',
                  height: 16,
                ),
                Text(curData.mora.toString()),
                Spacer(),
                ...GridData.getAscensionMaterialDataWidgets(
                  curData.material2Qty,
                  curData.material2,
                  widget.materialData,
                ),
                ...GridData.getAscensionMaterialDataWidgets(
                  curData.material1Qty,
                  curData.material1,
                  widget.materialData,
                ),
                ...GridData.getAscensionMaterialDataWidgets(
                  curData.material3Qty,
                  curData.material3,
                  widget.materialData,
                ),
                ...GridData.getAscensionMaterialDataWidgets(
                  curData.material4Qty,
                  curData.material4,
                  widget.materialData,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Icon _getGenderIcon(String gender, String name) {
    Color color;
    var icon = MdiIcons.genderFemale;
    if (gender.toLowerCase() == 'male') {
      icon = MdiIcons.genderMale;
      color = Util.themeNotifier.isDarkMode() ? Colors.lightBlue : Colors.blue;
    } else if (Util.themeNotifier.isDarkMode()) {
      color = Colors.pinkAccent;
    } else {
      color = Colors.pink;
    }

    if (name.startsWith('Traveler')) {
      return Icon(MdiIcons.genderMaleFemale);
    }

    return Icon(icon, color: color);
  }
}

class CharacterTalentPage extends StatefulWidget {
  final CharacterData? info;
  final String? infoId;
  final Map<String, MaterialDataCommon>? materialData;

  CharacterTalentPage({
    Key? key,
    required this.info,
    required this.infoId,
    required this.materialData,
  }) : super(key: key);

  @override
  _CharacterTalentPageState createState() => _CharacterTalentPageState();
}

class _CharacterTalentPageState extends State<CharacterTalentPage> {
  Map<String, TrackingStatus>? _isBeingTracked;

  String? _selectedTier;
  String? _selectedTalent;

  @override
  void initState() {
    super.initState();
    _refreshTrackingStatus();
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
            Text('Attack Talents', style: TextStyle(fontSize: 18)),
            ..._attackTalentWidgets(),
            Text('Passive Talents', style: TextStyle(fontSize: 18)),
            ..._passiveTalentWidgets(),
          ],
        ),
      ),
    );
  }

  void _refreshTrackingStatus() {
    if (widget.materialData == null || widget.info == null) return; // No data
    if (_isBeingTracked == null) {
      var _tmpTracker = <String, TrackingStatus>{};
      widget.info!.talent!.attack!.keys.forEach((key) {
        widget.info!.talent!.ascension!.keys.forEach((k2) {
          _tmpTracker['${key}_$k2'] = TrackingStatus.UNKNOWN;
        });
      });
      setState(() {
        _isBeingTracked = _tmpTracker;
      });
    }

    var _tracker = _isBeingTracked;
    TrackingData.getTrackingCategory('talents').then((_dataList) async {
      print(_dataList);
      var datasets = <String?>{};
      // Check tracking status and get material list
      _tracker!.keys.forEach((key) {
        var _isTracked = TrackingData.isBeingTrackedLocal(
          _dataList,
          '${widget.infoId}_$key',
        );
        var splitKey = key.split('_');
        var data = widget.info!.talent!.ascension![splitKey[splitKey.length - 1]]!;
        if (data.material1 != null) {
          datasets.add(widget.materialData![data.material1!]!.innerType);
        }
        if (data.material2 != null) {
          datasets.add(widget.materialData![data.material2!]!.innerType);
        }
        if (data.material3 != null) {
          datasets.add(widget.materialData![data.material3!]!.innerType);
        }
        if (data.material4 != null) {
          datasets.add(widget.materialData![data.material4!]!.innerType);
        }
        _tracker![key] =
            (_isTracked) ? TrackingStatus.CHECKING : TrackingStatus.NOT_TRACKED;
      });

      _tracker = await _processTracker(_tracker!, datasets);

      if (mounted) {
        setState(() {
          _isBeingTracked = _tracker;
        });
      }
    });
  }

  Future<Map<String, TrackingStatus>> _processTracker(
    Map<String, TrackingStatus> _tracker,
    Set<String?> datasets,
  ) async {
    // Get all datasets into a map to check if completed
    var collectionList = <String?, Map<String, TrackingUserData>>{};
    for (var ds in datasets.toList()) {
      collectionList[ds] = await TrackingData.getCollectionList(ds!);
    }
    // Run through tracking status and check if its fully tracked
    _tracker.keys.forEach((key) {
      if (_tracker[key] != TrackingStatus.CHECKING) return; // Skip untracked
      var fullTrack = true;
      var splitKey = key.split('_');
      var data = widget.info!.talent!.ascension![splitKey[splitKey.length - 1]]!;
      if (data.material1 != null && fullTrack) {
        fullTrack = TrackingData.isMaterialFull(
          widget.materialData![data.material1!]!.innerType,
          collectionList,
          widget.materialData,
          'Talent_${widget.infoId}_${data.material1}_$key',
        );
      }
      if (data.material2 != null && fullTrack) {
        fullTrack = TrackingData.isMaterialFull(
          widget.materialData![data.material2!]!.innerType,
          collectionList,
          widget.materialData,
          'Talent_${widget.infoId}_${data.material2}_$key',
        );
      }
      if (data.material3 != null && fullTrack) {
        fullTrack = TrackingData.isMaterialFull(
          widget.materialData![data.material3!]!.innerType,
          collectionList,
          widget.materialData,
          'Talent_${widget.infoId}_${data.material3}_$key',
        );
      }
      if (data.material4 != null && fullTrack) {
        fullTrack = TrackingData.isMaterialFull(
          widget.materialData![data.material4!]!.innerType,
          collectionList,
          widget.materialData,
          'Talent_${widget.infoId}_${data.material4}_$key',
        );
      }
      _tracker[key] = (fullTrack)
          ? TrackingStatus.TRACKED_COMPLETE_MATERIAL
          : TrackingStatus.TRACKED_INCOMPLETE_MATERIAL;
    });

    return _tracker;
  }

  void _trackTalentAction() {
    print('Selected: $_selectedTalent : $_selectedTier');
    var _ascendTier = widget.info!.talent!.ascension![_selectedTier!]!;
    var _ascensionTierSel = _selectedTier;

    TrackingData.addToRecord(
      'talents',
      '${widget.infoId}_${_selectedTalent}_$_selectedTier',
    ).then((value) {
      _refreshTrackingStatus();
      Util.showSnackbarQuick(
        context,
        "Tracking Tier $_ascensionTierSel of ${widget.info!.name}'s ${widget.info!.talent!.attack![_selectedTalent!]!.name}",
      );
    });
    if (_ascendTier.material1 != null) {
      TrackingData.addToCollection(
        'Talent_${widget.infoId}_${_ascendTier.material1}_${_selectedTalent}_$_selectedTier',
        _ascendTier.material1,
        _ascendTier.material1Qty,
        widget.materialData![_ascendTier.material1!]!.innerType,
        'talent',
        widget.infoId! + '|' + _selectedTalent!,
      );
    }
    if (_ascendTier.material2 != null) {
      TrackingData.addToCollection(
        'Talent_${widget.infoId}_${_ascendTier.material2}_${_selectedTalent}_$_selectedTier',
        _ascendTier.material2,
        _ascendTier.material2Qty,
        widget.materialData![_ascendTier.material2!]!.innerType,
        'talent',
        widget.infoId! + '|' + _selectedTalent!,
      );
    }
    if (_ascendTier.material3 != null) {
      TrackingData.addToCollection(
        'Talent_${widget.infoId}_${_ascendTier.material3}_${_selectedTalent}_$_selectedTier',
        _ascendTier.material3,
        _ascendTier.material3Qty,
        widget.materialData![_ascendTier.material3!]!.innerType,
        'talent',
        widget.infoId! + '|' + _selectedTalent!,
      );
    }
    if (_ascendTier.material4 != null) {
      TrackingData.addToCollection(
        'Talent_${widget.infoId}_${_ascendTier.material4}_${_selectedTalent}_$_selectedTier',
        _ascendTier.material4,
        _ascendTier.material4Qty,
        widget.materialData![_ascendTier.material4!]!.innerType,
        'talent',
        widget.infoId! + '|' + _selectedTalent!,
      );
    }
    Navigator.of(context).pop();
  }

  void _untrackTalentAction() {
    print('Selected: $_selectedTalent : $_selectedTier');
    var _ascendTier = widget.info!.talent!.ascension![_selectedTier!]!;
    var _ascensionTierSel = _selectedTier;

    TrackingData.removeFromRecord(
      'talents',
      '${widget.infoId}_${_selectedTalent}_$_selectedTier',
    ).then((value) {
      _refreshTrackingStatus();
      Util.showSnackbarQuick(
        context,
        "Untracked Tier $_ascensionTierSel of ${widget.info!.name}'s ${widget.info!.talent!.attack![_selectedTalent!]!.name}",
      );
    });
    if (_ascendTier.material1 != null) {
      TrackingData.removeFromCollection(
        'Talent_${widget.infoId}_${_ascendTier.material1}_${_selectedTalent}_$_selectedTier',
        widget.materialData![_ascendTier.material1!]!.innerType,
      );
    }
    if (_ascendTier.material2 != null) {
      TrackingData.removeFromCollection(
        'Talent_${widget.infoId}_${_ascendTier.material2}_${_selectedTalent}_$_selectedTier',
        widget.materialData![_ascendTier.material2!]!.innerType,
      );
    }
    if (_ascendTier.material3 != null) {
      TrackingData.removeFromCollection(
        'Talent_${widget.infoId}_${_ascendTier.material3}_${_selectedTalent}_$_selectedTier',
        widget.materialData![_ascendTier.material3!]!.innerType,
      );
    }
    if (_ascendTier.material4 != null) {
      TrackingData.removeFromCollection(
        'Talent_${widget.infoId}_${_ascendTier.material4}_${_selectedTalent}_$_selectedTier',
        widget.materialData![_ascendTier.material4!]!.innerType,
      );
    }

    Navigator.of(context).pop();
  }

  TrackingStatus? _isBeingTrackedStatus(String key) {
    return (!_isBeingTracked!.keys.contains(key))
        ? TrackingStatus.UNKNOWN
        : _isBeingTracked![key];
  }

  List<Widget> _getAscensionTierMaterialRowChild(String? key, int? qty) {
    if (key == null) return [SizedBox.shrink()];

    return [
      GridData.getAscensionImage(key, widget.materialData),
      Text(key == null ? '' : widget.materialData![key]!.name!),
      Text((qty == 0) ? '' : ' x$qty'),
    ];
  }

  void _addOrRemoveMaterial(
    String talent,
    int index,
    CharacterAscension curData,
  ) async {
    var key = '${talent}_$index';
    var isTracked = _isBeingTrackedStatus(key);
    if (isTracked == TrackingStatus.UNKNOWN ||
        isTracked == TrackingStatus.CHECKING) {
      Util.showSnackbarQuick(context, 'Checking tracking status');

      return;
    }

    setState(() {
      _selectedTier = index.toString();
      _selectedTalent = talent;
    });

    if (isTracked == TrackingStatus.TRACKED_INCOMPLETE_MATERIAL ||
        isTracked == TrackingStatus.TRACKED_COMPLETE_MATERIAL) {
      _removeMaterial(curData, talent, index);
    } else {
      _addMaterial(curData, talent, index);
    }
  }

  void _removeMaterial(
    CharacterAscension curData,
    String talent,
    int index,
  ) async {
    await showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: Text(
            "Remove ${widget.info!.name}'s ${widget.info!.talent!.attack![talent]!.name} Tier $index from the tracker?",
          ),
          content: SingleChildScrollView(
            child: ListBody(
              children: [
                Text(
                  'This will remove the following materials being tracked for this talent from the tracker:',
                ),
                Row(
                  children: _getAscensionTierMaterialRowChild(
                    curData.material3,
                    curData.material3Qty,
                  ),
                ),
                Row(
                  children: _getAscensionTierMaterialRowChild(
                    curData.material4,
                    curData.material4Qty,
                  ),
                ),
                Row(
                  children: _getAscensionTierMaterialRowChild(
                    curData.material2,
                    curData.material2Qty,
                  ),
                ),
                Row(
                  children: _getAscensionTierMaterialRowChild(
                    curData.material1,
                    curData.material1Qty,
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: Text('Cancel'),
            ),
            TextButton(
              onPressed: _untrackTalentAction,
              child: Text('Untrack'),
            ),
          ],
        );
      },
    );
  }

  void _addMaterial(
    CharacterAscension curData,
    String talent,
    int index,
  ) async {
    await showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: Text(
            "Add ${widget.info!.name}'s ${widget.info!.talent!.attack![talent]!.name} Tier $index to the tracker?",
          ),
          content: SingleChildScrollView(
            child: ListBody(
              children: [
                Text('Items being added to tracker:'),
                Row(
                  children: _getAscensionTierMaterialRowChild(
                    curData.material3,
                    curData.material3Qty,
                  ),
                ),
                Row(
                  children: _getAscensionTierMaterialRowChild(
                    curData.material4,
                    curData.material4Qty,
                  ),
                ),
                Row(
                  children: _getAscensionTierMaterialRowChild(
                    curData.material2,
                    curData.material2Qty,
                  ),
                ),
                Row(
                  children: _getAscensionTierMaterialRowChild(
                    curData.material1,
                    curData.material1Qty,
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: Text('Cancel'),
            ),
            TextButton(
              onPressed: _trackTalentAction,
              child: Text('Track'),
            ),
          ],
        );
      },
    );
  }

  Widget _generateAscensionData(
    String talent,
    Map<String, CharacterAscension>? ascendInfo,
  ) {
    if (widget.materialData == null) {
      return Padding(
        padding: const EdgeInsets.only(top: 16),
        child: CircularProgressIndicator(),
      );
    }

    var data = ascendInfo!.entries.map((e) => e.value).toList();

    return ListView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: data.length,
      itemBuilder: (context, index) {
        var curData = data[index];
        //print('${talent}_${index+2}');

        return _generateTalentAscensionMaterialWidget(talent, index, curData);
      },
    );
  }

  Widget _generateTalentAscensionMaterialWidget(
    String talent,
    int index,
    CharacterAscension curData,
  ) {
    return Container(
      child: Card(
        color: TrackingUtils.getTrackingColorString(
          '${talent}_${index + 2}',
          _isBeingTracked!,
        ),
        child: InkWell(
          onTap: () => _addOrRemoveMaterial(talent, index + 2, curData),
          child: Padding(
            padding: const EdgeInsets.all(8),
            child: Row(
              children: [
                Text(
                  GridData.getRomanNumberArray(index + 1),
                  style: TextStyle(fontSize: 24),
                ),
                Spacer(),
                Image.asset(
                  'assets/images/items/Icon_Mora.png',
                  height: 16,
                ),
                Padding(
                  padding: const EdgeInsets.only(left: 4),
                  child: Text(curData.mora.toString()),
                ),
                Spacer(),
                ...GridData.getAscensionMaterialDataWidgets(
                  curData.material3Qty,
                  curData.material3,
                  widget.materialData,
                ),
                ...GridData.getAscensionMaterialDataWidgets(
                  curData.material4Qty,
                  curData.material4,
                  widget.materialData,
                ),
                ...GridData.getAscensionMaterialDataWidgets(
                  curData.material2Qty,
                  curData.material2,
                  widget.materialData,
                ),
                ...GridData.getAscensionMaterialDataWidgets(
                  curData.material1Qty,
                  curData.material1,
                  widget.materialData,
                ),
              ],
            ),
          ),
        ),
      ),
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
              Expanded(child: Text(_talInfo.name!)),
            ],
          ),
          content: SingleChildScrollView(
            child: GridData.generateElementalColoredLine(_talInfo.effect!),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: Text('Close'),
            ),
          ],
        );
      },
    );
  }

  Widget _shouldShowTalentDescription(TalentInfo _talInfo, bool show) {
    return (!show)
        ? SizedBox.shrink()
        : Padding(
            padding: const EdgeInsets.only(top: 4),
            child: GridData.generateElementalColoredLine(_talInfo.effect!),
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
                  GridData.getImageAssetFromFirebase(
                    _talInfo.image,
                    height: 32,
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        width: MediaQuery.of(context).size.width - 80,
                        child: Text(
                          _talInfo.name!,
                          textAlign: TextAlign.start,
                          style: TextStyle(fontSize: 18),
                        ),
                      ),
                      Text(_talInfo.type!),
                    ],
                  ),
                ],
              ),
            ),
            _shouldShowTalentDescription(_talInfo, _isPassive),
          ],
        ),
      ),
    );
  }

  SplayTreeMap<String, TalentInfo> _sortTalent(Map<String, TalentInfo> talent) {
    return SplayTreeMap.from(
      talent,
      (a, b) => talent[a]!.order!.compareTo(talent[b]!.order!),
    );
  }

  List<Widget> _attackTalentWidgets() {
    var _wid = <Widget>[];
    _sortTalent(widget.info!.talent!.attack!).forEach((key, value) {
      var _ascendInfo = widget.info!.talent!.ascension;
      _wid.add(_generateTalentWidget(value, false));
      _wid.add(_generateAscensionData(key, _ascendInfo));
      _wid.add(Divider());
    });

    return _wid;
  }

  List<Widget> _passiveTalentWidgets() {
    var _wid = <Widget>[];
    _sortTalent(widget.info!.talent!.passive!).forEach((key, value) {
      _wid.add(_generateTalentWidget(value, true));
      _wid.add(Divider());
    });

    return _wid;
  }
}

class CharacterConstellationPage extends StatelessWidget {
  final CharacterData? info;

  CharacterConstellationPage({Key? key, required this.info}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    if (info == null) return Util.loadingScreen();

    return Padding(
      padding: const EdgeInsets.all(8),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: _constellationWidgets(context),
        ),
      ),
    );
  }

  List<Widget> _constellationWidgets(BuildContext context) {
    var _wid = <Widget>[];
    info!.constellations!.forEach((key, value) {
      _wid.add(_generateConstellationWidget(key, value, context));
      _wid.add(Divider());
    });

    return _wid;
  }

  Widget _generateConstellationWidget(
    int index,
    CharacterConstellations constellation,
    BuildContext context,
  ) {
    return Padding(
      padding: const EdgeInsets.all(8),
      child: Column(
        children: [
          IntrinsicHeight(
            child: Row(
              children: [
                Stack(
                  children: [
                    GridData.getImageAssetFromFirebase(
                      constellation.image,
                      height: 32,
                    ),
                    Align(
                      alignment: FractionalOffset.bottomLeft,
                      child: Text(
                        GridData.getRomanNumberArray(index - 1).toString(),
                        style: TextStyle(color: Colors.white),
                        textAlign: TextAlign.end,
                      ),
                    ),
                  ],
                ),
                Container(
                  width: MediaQuery.of(context).size.width - 80,
                  child: Text(
                    constellation.name!,
                    textAlign: TextAlign.start,
                    style: TextStyle(fontSize: 18),
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: GridData.generateElementalColoredLine(constellation.effect!),
          ),
        ],
      ),
    );
  }
}
