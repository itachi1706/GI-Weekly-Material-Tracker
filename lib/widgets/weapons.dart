import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:flutter_rating_bar/flutter_rating_bar.dart';
import 'package:get/get.dart';
import 'package:gi_weekly_material_tracker/helpers/grid.dart';
import 'package:gi_weekly_material_tracker/helpers/tracker.dart';
import 'package:gi_weekly_material_tracker/listeners/sorter.dart';
import 'package:gi_weekly_material_tracker/models/materialdata.dart';
import 'package:gi_weekly_material_tracker/models/trackdata.dart';
import 'package:gi_weekly_material_tracker/models/weapondata.dart';
import 'package:gi_weekly_material_tracker/util.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import 'package:transparent_image/transparent_image.dart';

final FirebaseFirestore _db = FirebaseFirestore.instance;

class WeaponTabController extends StatefulWidget {
  final TabController? tabController;
  final SortNotifier? notifier;

  WeaponTabController({Key? key, required this.tabController, this.notifier})
      : super(key: key);

  @override
  _WeaponTabControllerState createState() => _WeaponTabControllerState();
}

class _WeaponTabControllerState extends State<WeaponTabController> {
  @override
  Widget build(BuildContext context) {
    return TabBarView(controller: widget.tabController, children: [
      WeaponListGrid(notifier: widget.notifier),
      WeaponListGrid(filter: 'Bow', notifier: widget.notifier),
      WeaponListGrid(filter: 'Catalyst', notifier: widget.notifier),
      WeaponListGrid(filter: 'Claymore', notifier: widget.notifier),
      WeaponListGrid(filter: 'Polearm', notifier: widget.notifier),
      WeaponListGrid(filter: 'Sword', notifier: widget.notifier),
    ]);
  }
}

class WeaponListGrid extends StatefulWidget {
  final String? filter;
  final SortNotifier? notifier;

  WeaponListGrid({Key? key, this.filter, this.notifier});

  @override
  _WeaponListGridState createState() => _WeaponListGridState();
}

class _WeaponListGridState extends State<WeaponListGrid> {
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
    var weaponRef = _db.collection('weapons');
    Query? queryRef;
    if (widget.filter != null) {
      queryRef = weaponRef.where('type', isEqualTo: widget.filter);
    }
    if (_sorter != null && queryRef == null) {
      queryRef = weaponRef
          .orderBy(_sorter!, descending: _isDescending)
          .orderBy(FieldPath.documentId);
    } else if (_sorter != null) {
      queryRef = queryRef!
          .orderBy(_sorter!, descending: _isDescending)
          .orderBy(FieldPath.documentId);
    }

    return StreamBuilder(
      stream: (queryRef == null) ? weaponRef.snapshots() : queryRef.snapshots(),
      builder: (context, AsyncSnapshot<QuerySnapshot> snapshot) {
        if (snapshot.hasError) {
          return Text('Error occurred getting snapshot');
        }

        if (snapshot.connectionState == ConnectionState.waiting) {
          return Util.centerLoadingCircle('');
        }

        if (widget.filter == null) {
          GridData.setStaticData('weapons', snapshot.data);
        }

        var dt = GridData.getDataListFilteredRelease(snapshot.data!.docs);

        return GridView.count(
          crossAxisCount:
              (Get.context!.orientation == Orientation.portrait) ? 3 : 6,
          children: dt.map((document) {
            return GestureDetector(
              onTap: () => Get.toNamed('/weapons/${document.id}'),
              child: GridData.getGridData(WeaponData.fromJson(document.data() as Map<String, dynamic>)),
            );
          }).toList(),
        );
      },
    );
  }
}

class WeaponInfoPage extends StatefulWidget {
  @override
  _WeaponInfoPageState createState() => _WeaponInfoPageState();
}

class _WeaponInfoPageState extends State<WeaponInfoPage> {
  String? _infoId;
  Color? _rarityColor;
  String? _selectedTier;

  WeaponData? _info;
  Map<String, MaterialDataCommon>? _materialData;
  Map<String, TrackingStatus>? _isBeingTracked;

  @override
  void initState() {
    super.initState();
    _infoId = Get.parameters['weapon'];
    _getStaticData();
  }

  @override
  Widget build(BuildContext context) {
    if (_info == null) return Util.loadingScreen();

    return Scaffold(
      appBar: AppBar(
        title: Text(_info!.name!),
        backgroundColor: _rarityColor,
        actions: [
          IconButton(
            icon: Icon(Icons.info_outline),
            onPressed: () => GridData.launchWikiUrl(context, _info!),
            tooltip: 'View Wiki',
          ),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(8),
        child: SingleChildScrollView(
          child: Column(
            children: [
              _generateWeaponHeader(),
              Divider(),
              ..._getSeriesIfExists(_info!),
              ...GridData.generateInfoLine(
                _info!.obtained!.replaceAll('- ', ''),
                Icons.location_pin,
              ),
              ...GridData.generateInfoLine(
                _info!.description!,
                Icons.format_list_bulleted,
              ),
              ..._generateEffectName(),
              ..._getWeaponStats(),
              Divider(),
              ...TrackingData.getAscensionHeader(),
              _generateAscensionData(),
            ],
          ),
        ),
      ),
    );
  }

  List<Widget> _getSeriesIfExists(WeaponData info) {
    var finalWidgets = <Widget>[SizedBox.shrink()];
    if (info.series != null) {
      finalWidgets = GridData.generateInfoLine(info.series!, MdiIcons.bookshelf);
    }

    return finalWidgets;
  }

  List<Widget> _generateEffectName() {
    return _info!.effectName != null
        ? GridData.generateHeaderInfoLine(
            _info!.effectName!,
            _info!.effect!,
            MdiIcons.shimmer,
          )
        : GridData.generateInfoLine(_info!.effect!, MdiIcons.shimmer);
  }

  Widget _generateWeaponHeader() {
    return Row(
      children: [
        GridData.getImageAssetFromFirebase(_info!.image, height: 64),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              _info!.type!,
              textAlign: TextAlign.start,
              style: TextStyle(fontSize: 20),
            ),
            RatingBar.builder(
              ignoreGestures: true,
              itemCount: 5,
              itemSize: 30,
              initialRating: double.tryParse(_info!.rarity.toString())!,
              itemBuilder: (context, _) =>
                  Icon(Icons.star, color: Colors.amber),
              onRatingUpdate: (rating) {
                print(rating);
              },
            ),
          ],
        ),
      ],
    );
  }

  List<Widget> _getWeaponStats() {
    return [
      Padding(
        padding: const EdgeInsets.all(8),
        child: Row(
          children: [
            Icon(MdiIcons.swordCross),
            Padding(
              padding: const EdgeInsets.only(left: 8),
              child: (_info!.maxBaseAtk == null)
                  ? Text(_info!.baseAtk.toString())
                  : Text('${_info!.baseAtk} -> ${_info!.maxBaseAtk}'),
            ),
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
              child: (_info!.maxSecondaryStat == null)
                  ? Text('${_info!.secondaryStat} (${_info!.secondaryStatType})')
                  : Text(
                      '${_info!.secondaryStat} -> ${_info!.maxSecondaryStat} (${_info!.secondaryStatType})',
                    ),
            ),
          ],
        ),
      ),
    ];
  }

  void _refreshTrackingStatus() {
    if (_materialData == null) return; // No data
    if (_isBeingTracked == null) {
      var _tmpTracker = <String, TrackingStatus>{};
      _info!.ascension!.keys.forEach((key) {
        _tmpTracker[key] = TrackingStatus.UNKNOWN;
      });
      setState(() {
        if (!mounted) return;
        _isBeingTracked = _tmpTracker;
      });
    }

    _checkStatusAndMaterialList().then((_tracker) => setState(() {
          _isBeingTracked = _tracker;
        }));
  }

  Future<Map<String, TrackingStatus>> _checkStatusAndMaterialList() async {
    var _tracker = _isBeingTracked!;
    var _dataList = await TrackingData.getTrackingCategory('weapon');
    print(_dataList);
    var datasets = <String?>{};
    // Check tracking status and get material list
    _isBeingTracked!.keys.forEach((key) {
      var _isTracked =
          TrackingData.isBeingTrackedLocal(_dataList, '${_infoId}_$key');
      var data = _info!.ascension![key]!;
      if (data.material1 != null) {
        datasets.add(_materialData![data.material1!]!.innerType);
      }
      if (data.material2 != null) {
        datasets.add(_materialData![data.material2!]!.innerType);
      }
      if (data.material3 != null) {
        datasets.add(_materialData![data.material3!]!.innerType);
      }
      _tracker[key] =
          (_isTracked) ? TrackingStatus.CHECKING : TrackingStatus.NOT_TRACKED;
    });

    // Get all datasets into a map to check if completed
    var collectionList = <String?, Map<String, TrackingUserData>>{};
    for (var ds in datasets.toList()) {
      collectionList[ds] = await TrackingData.getCollectionList(ds!);
    }

    return _processStatusList(collectionList, _tracker);
  }

  Future<Map<String, TrackingStatus>> _processStatusList(
    Map<String?, Map<String, TrackingUserData>> collectionList,
    Map<String, TrackingStatus> _tracker,
  ) async {
    // Run through tracking status and check if its fully tracked
    _tracker.keys.forEach((key) {
      if (_tracker[key] != TrackingStatus.CHECKING) return; // Skip untracked
      var fullTrack = true;
      var data = _info!.ascension![key]!;
      if (data.material1 != null && fullTrack) {
        fullTrack = TrackingData.isMaterialFull(
          _materialData![data.material1!]!.innerType,
          collectionList,
          _materialData,
          'Weapon_${_infoId}_${data.material1}_$key',
        );
      }
      if (data.material2 != null && fullTrack) {
        fullTrack = TrackingData.isMaterialFull(
          _materialData![data.material2!]!.innerType,
          collectionList,
          _materialData,
          'Weapon_${_infoId}_${data.material2}_$key',
        );
      }
      if (data.material3 != null && fullTrack) {
        fullTrack = TrackingData.isMaterialFull(
          _materialData![data.material3!]!.innerType,
          collectionList,
          _materialData,
          'Weapon_${_infoId}_${data.material3}_$key',
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

  void _trackWeaponAction() {
    print('Selected: $_selectedTier');
    var _ascendTier = _info!.ascension![_selectedTier!]!;
    var _ascensionTierSel = _selectedTier;

    TrackingData.addToRecord('weapon', '${_infoId}_$_selectedTier')
        .then((value) {
      _refreshTrackingStatus();
      Util.showSnackbarQuick(
        context,
        '${_info!.name} Ascension Tier $_ascensionTierSel added to tracker!',
      );
    });
    if (_ascendTier.material1 != null) {
      TrackingData.addToCollection(
        'Weapon_${_infoId}_${_ascendTier.material1}_$_selectedTier',
        _ascendTier.material1,
        _ascendTier.material1Qty,
        _materialData![_ascendTier.material1!]!.innerType,
        'weapon',
        _infoId,
      );
    }
    if (_ascendTier.material2 != null) {
      TrackingData.addToCollection(
        'Weapon_${_infoId}_${_ascendTier.material2}_$_selectedTier',
        _ascendTier.material2,
        _ascendTier.material2Qty,
        _materialData![_ascendTier.material2!]!.innerType,
        'weapon',
        _infoId,
      );
    }
    if (_ascendTier.material3 != null) {
      TrackingData.addToCollection(
        'Weapon_${_infoId}_${_ascendTier.material3}_$_selectedTier',
        _ascendTier.material3,
        _ascendTier.material3Qty,
        _materialData![_ascendTier.material3!]!.innerType,
        'weapon',
        _infoId,
      );
    }
    Navigator.of(context).pop();
  }

  void _untrackWeaponAction() {
    print('Selected: $_selectedTier');
    var _ascendTier = _info!.ascension![_selectedTier!]!;
    var _ascensionTierSel = _selectedTier;

    TrackingData.removeFromRecord('weapon', '${_infoId}_$_selectedTier')
        .then((value) {
      _refreshTrackingStatus();
      Util.showSnackbarQuick(
        context,
        '${_info!.name} Ascension Tier $_ascensionTierSel removed from tracker!',
      );
    });
    if (_ascendTier.material1 != null) {
      TrackingData.removeFromCollection(
        'Weapon_${_infoId}_${_ascendTier.material1}_$_selectedTier',
        _materialData![_ascendTier.material1!]!.innerType,
      );
    }
    if (_ascendTier.material2 != null) {
      TrackingData.removeFromCollection(
        'Weapon_${_infoId}_${_ascendTier.material2}_$_selectedTier',
        _materialData![_ascendTier.material2!]!.innerType,
      );
    }
    if (_ascendTier.material3 != null) {
      TrackingData.removeFromCollection(
        'Weapon_${_infoId}_${_ascendTier.material3}_$_selectedTier',
        _materialData![_ascendTier.material3!]!.innerType,
      );
    }

    Navigator.of(context).pop();
  }

  List<Widget> _getAscensionTierMaterialRowChild(String? key, int? qty) {
    return [
      _getAscensionImage(key),
      Text(key == null ? '' : _materialData![key]!.name!),
      Text((qty == 0) ? '' : ' x$qty'),
    ];
  }

  void _addOrRemoveMaterial(int index, WeaponAscension curData) async {
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
      await _showRemoveDialog(curData, key);
    } else {
      await _showAddDialog(curData, key);
    }
  }

  Future<void> _showRemoveDialog(WeaponAscension curData, String key) async {
    await showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: Text(
            'Remove ${_info!.name} Ascension Tier $key from the tracker?',
          ),
          content: SingleChildScrollView(
            child: ListBody(
              children: [
                GridData.getImageAssetFromFirebase(_info!.image, height: 64),
                Text(
                  'This will remove the following materials being tracked for this weapon from the tracker:',
                ),
                Row(
                  children: _getAscensionTierMaterialRowChild(
                    curData.material1,
                    curData.material1Qty,
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
                    curData.material3,
                    curData.material3Qty,
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
              onPressed: _untrackWeaponAction,
              child: Text('Untrack'),
            ),
          ],
        );
      },
    );
  }

  Future<void> _showAddDialog(WeaponAscension curData, String key) async {
    await showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: Text('Add ${_info!.name} Ascension Tier $key to the tracker?'),
          content: SingleChildScrollView(
            child: ListBody(
              children: [
                GridData.getImageAssetFromFirebase(_info!.image, height: 64),
                Text('Items being added to tracker:'),
                Row(
                  children: _getAscensionTierMaterialRowChild(
                    curData.material1,
                    curData.material1Qty,
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
                    curData.material3,
                    curData.material3Qty,
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
              onPressed: _trackWeaponAction,
              child: Text('Track'),
            ),
          ],
        );
      },
    );
  }

  Widget _getAscensionImage(String? itemKey) {
    if (itemKey == null) return Image.memory(kTransparentImage);

    return GridData.getImageAssetFromFirebase(
      _materialData![itemKey]!.image,
      height: 16,
    );
  }

  Widget _getAscensionRowItem(WeaponAscension curData, int index) {
    return Row(
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
        _getAscensionImage(curData.material1),
        Text(curData.material1Qty.toString()),
        Spacer(),
        _getAscensionImage(curData.material2),
        Text(
          (curData.material2Qty == 0) ? '' : curData.material2Qty.toString(),
        ),
        Spacer(),
        _getAscensionImage(curData.material3),
        Text(curData.material3Qty.toString()),
        Spacer(),
      ],
    );
  }

  Widget _generateAscensionData() {
    if (_materialData == null) {
      return Padding(
        padding: const EdgeInsets.only(top: 16),
        child: CircularProgressIndicator(),
      );
    }

    var dataMap = _info!.ascension!;
    var data = dataMap.entries.map((e) => e.value).toList();

    return ListView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: data.length,
      itemBuilder: (context, index) {
        var curData = data[index];

        return Container(
          child: Card(
            color: TrackingUtils.getTrackingColor(index + 1, _isBeingTracked!),
            child: InkWell(
              onTap: () => _addOrRemoveMaterial(index + 1, curData),
              child: Padding(
                padding: const EdgeInsets.all(8),
                child: _getAscensionRowItem(curData, index),
              ),
            ),
          ),
        );
      },
    );
  }

  void _getStaticData() async {
    var infoData = await GridData.retrieveWeaponsMapData();
    var materialData = await GridData.retrieveMaterialsMapData();
    setState(() {
      _info = infoData![_infoId!];
      if (_info == null) Get.offAndToNamed('/splash');
      _rarityColor = GridData.getRarityColor(_info!.rarity);
      _materialData = materialData;
    });
    _refreshTrackingStatus();
  }
}
