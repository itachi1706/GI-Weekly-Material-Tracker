import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_countdown_timer/index.dart';
import 'package:flutter_rating_bar/flutter_rating_bar.dart';
import 'package:get/get.dart';
import 'package:gi_weekly_material_tracker/helpers/grid.dart';
import 'package:gi_weekly_material_tracker/helpers/tracker.dart';
import 'package:gi_weekly_material_tracker/models/characterdata.dart';
import 'package:gi_weekly_material_tracker/models/materialdata.dart';
import 'package:gi_weekly_material_tracker/models/trackdata.dart';
import 'package:gi_weekly_material_tracker/models/weapondata.dart';
import 'package:gi_weekly_material_tracker/util.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:timezone/data/latest.dart' as tz;
import 'package:timezone/timezone.dart' as tz;

final FirebaseFirestore _db = FirebaseFirestore.instance;

class TrackingTabController extends StatefulWidget {
  final TabController? tabController;

  const TrackingTabController({super.key, required this.tabController});

  @override
  TrackingTabControllerState createState() => TrackingTabControllerState();
}

class TrackingTabControllerState extends State<TrackingTabController> {
  final List<Widget> _children = [
    const TrackerPage(path: 'boss_drops'),
    const TrackerPage(path: 'domain_material'),
    const TrackerPage(path: 'mob_drops'),
    const TrackerPage(path: 'local_speciality'),
    const PlannerPage(),
  ];

  @override
  Widget build(BuildContext context) {
    return TabBarView(controller: widget.tabController, children: _children);
  }
}

class TrackerPage extends StatefulWidget {
  final String path;

  const TrackerPage({super.key, required this.path});

  @override
  TrackerPageState createState() => TrackerPageState();
}

class TrackerPageState extends State<TrackerPage> {
  Map<String, MaterialDataCommon>? _materialData;
  Map<String, WeaponData>? _weaponData;
  Map<String, CharacterData>? _characterData;

  late SharedPreferences _prefs;

  @override
  void initState() {
    super.initState();
    _retrieveData();
  }

  Widget _process(int collectionLen, QuerySnapshot data) {
    var dt = data.docs;
    if (_prefs.getBool('move_completed_bottom') ?? false) {
      dt.sort((a, b) {
        var aD = TrackingUserData.fromJson(a.data() as Map<String, dynamic>);
        var bD = TrackingUserData.fromJson(b.data() as Map<String, dynamic>);

        var aDD = (aD.max! - aD.current!) <= 0 ? 1 : 0;
        var bDD = (bD.max! - bD.current!) <= 0 ? 1 : 0;

        debugPrint('${bD.max! - bD.current!} - ${aD.max! - aD.current!}');

        return aDD.compareTo(bDD);
      });
    }

    return collectionLen > 0
        ? ListView.builder(
            itemCount: collectionLen,
            itemBuilder: (context, index) {
              var data = TrackingUserData.fromJson(
                dt[index].data() as Map<String, dynamic>,
              );
              var dataId = dt[index].id;
              debugPrint(data.toString());
              var material = _materialData![data.name!]!;
              String? extraImageRef;
              var extraAscensionRef = 0;
              String? extraTypeRef;
              var splitKey = dataId.split('_');
              var ascendTier = splitKey[splitKey.length - 1];
              if (data.addData != null) {
                if (data.addedBy == 'character') {
                  extraImageRef = _characterData![data.addData!]!.image;
                  extraAscensionRef = int.tryParse(ascendTier) ?? 0;
                  extraTypeRef = _characterData![data.addData!]!.element;
                } else if (data.addedBy == 'weapon') {
                  extraImageRef = _weaponData![data.addData!]!.image;
                  extraAscensionRef = int.tryParse(ascendTier) ?? 0;
                } else if (data.addedBy == 'talent') {
                  var cData = data.addData!.split('|');
                  extraImageRef = _characterData![cData[0]]!
                      .talent!
                      .attack![cData[1]]!
                      .image;
                  extraAscensionRef = int.tryParse(ascendTier) ?? 0;
                }
              }

              return TrackerCard(
                data: data,
                dataId: dataId,
                extraImageRef: extraImageRef,
                extraAscensionRef: extraAscensionRef,
                extraTypeRef: extraTypeRef,
                material: material,
              );
            },
          )
        : const Center(
            child: Text('No items being tracked for this material category'),
          );
  }

  void _retrieveData() async {
    var prefs = await SharedPreferences.getInstance();
    var m = await GridData.retrieveMaterialsMapData();
    var c = await GridData.retrieveCharactersMapData();
    var w = await GridData.retrieveWeaponsMapData();
    var o = await GridData.retrieveOutfitsMapData();

    debugPrint("Found ${c?.length ?? 0} characters, "
        "${m?.length ?? 0} materials, ${w?.length ?? 0} weapons, "
        "${o?.length ?? 0} outfits");

    if (mounted) {
      setState(() {
        _materialData = m;
        _characterData = c;
        _weaponData = w;
        _prefs = prefs;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_materialData == null ||
        _characterData == null ||
        _weaponData == null) {
      return Util.centerLoadingCircle('Loading');
    }

    var ref = _db
        .collection('tracking')
        .doc(Util.getFirebaseUid())
        .collection(widget.path);

    return StreamBuilder(
      stream: ref.snapshots(),
      builder: (context, AsyncSnapshot<QuerySnapshot> snapshot) {
        if (snapshot.hasError) {
          debugPrint(snapshot.error.toString());

          return const Text('Error occurred getting snapshot');
        }

        if (snapshot.connectionState == ConnectionState.waiting ||
            _materialData == null ||
            _characterData == null ||
            _weaponData == null) {
          return Util.centerLoadingCircle('');
        }

        var data = snapshot.data!;
        final collectionLen = data.docs.length;

        return _process(collectionLen, data);
      },
    );
  }
}

class PlannerPage extends StatefulWidget {
  const PlannerPage({super.key});

  @override
  PlannerPageState createState() => PlannerPageState();
}

class PlannerPageState extends State<PlannerPage> {
  Map<String, MaterialDataCommon>? _matData;

  tz.TZDateTime? _cDT, _beforeDT, _afterDT, _coffDT, _dbDT;

  String _location = 'Asia';

  @override
  void initState() {
    super.initState();
    GridData.retrieveMaterialsMapData().then((value) => {
          setState(() {
            _matData = value;
          }),
        });

    SharedPreferences.getInstance().then((value) {
      _location = value.getString('location') ?? 'Asia';
    });
    tz.initializeTimeZones();
  }

  String _getLoc() {
    switch (_location) {
      case 'EU':
        return 'Europe/Paris';
      case 'NA':
        return 'America/New_York';
      default:
        return 'Asia/Singapore';
    }
  }

  String _getLocStr() {
    switch (_location) {
      case 'EU':
        return '+1 (EU)';
      case 'NA':
        return '-5 (NA)';
      default:
        return '+8 (Asia)';
    }
  }

  Widget _buildWeeklyMaterials(Map<int, Set<String>> mappedData) {
    // Assume each 180px, divide and round up to get how many per grid (min 3)
    var webWidth = MediaQuery.of(context).size.width;
    var gridCnt = (webWidth / 180).round();
    if (gridCnt < 3) gridCnt = 3;
    debugPrint('Width: $webWidth | Generated Grid: $gridCnt');

    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(8, 8, 8, 0),
            child: Row(
              children: [
                Text(
                  'Day resets at 4am GMT${_getLocStr()}',
                  style: const TextStyle(fontSize: 12),
                ),
                const Spacer(),
                const Text('Day Reset in: ', style: TextStyle(fontSize: 12)),
                _getCountdown(),
              ],
            ),
          ),
          ListView.separated(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: mappedData.length,
            itemBuilder: (context, index) {
              var key = mappedData.keys.elementAt(index);
              var curData = mappedData[key]!.toList();

              return ListTile(
                tileColor: _getTileColorIfCurrentDay(key),
                leading: Text(GridUtils.getDayString(key)),
                title: _getGridMaterials(curData, gridCnt),
              );
            },
            separatorBuilder: (context, index) => const Divider(height: 1),
          ),
        ],
      ),
    );
  }

  Widget _getCountdown() {
    return CountdownTimer(
      endTime: _getResetTime(),
      widgetBuilder: (_, CurrentRemainingTime? time) {
        if (time == null) {
          return const Text('Refreshing', style: TextStyle(fontSize: 12));
        }
        var finalStr = '';
        if (time.days != null) {
          if (time.days! < 10) finalStr += '0';
          finalStr += '${time.days}:';
        }
        if (time.hours != null) {
          if (time.hours! < 10) finalStr += '0';
          finalStr += '${time.hours}:';
        }
        if (time.min != null) {
          if (time.min! < 10) finalStr += '0';
          finalStr += '${time.min}:';
        }
        if (time.sec != null) {
          if (time.sec! < 10) finalStr += '0';
          finalStr += '${time.sec}';
        }

        return Text(finalStr, style: const TextStyle(fontSize: 12));
      },
    );
  }

  int _getResetTime() {
    var actualCDT = _coffDT;
    if (_cDT!.isAfter(_coffDT!)) {
      actualCDT = _coffDT!.add(const Duration(days: 1));
    }

    return actualCDT!.millisecondsSinceEpoch;
  }

  Color _getTileColorIfCurrentDay(int key) {
    var currentDay = false;
    if (_cDT!.isAfter(_coffDT!) &&
        _cDT!.isBefore(_afterDT!) &&
        _cDT!.weekday == key) {
      currentDay = true;
    } else if (_cDT!.isBefore(_coffDT!) &&
        _cDT!.isAfter(_beforeDT!) &&
        _dbDT!.weekday == key) {
      currentDay = true;
    }

    return currentDay
        ? (Util.themeNotifier.isDarkMode())
            ? Colors.green
            : Colors.lightGreen
        : Colors.transparent;
  }

  Widget _getGridMaterials(List<String> curData, int gridCnt) {
    if (curData.isEmpty) {
      return const Text('Not tracking any domain materials for this day');
    }

    return GridView.count(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisCount: gridCnt,
      children: curData.map((materialId) {
        return GestureDetector(
          onTap: () => Get.toNamed('/materials/$materialId'),
          child: GridData.getGridData(_matData![materialId]!),
        );
      }).toList(),
    );
  }

  @override
  Widget build(BuildContext context) {
    var loc = tz.getLocation(_getLoc());
    _cDT = tz.TZDateTime.now(loc);

    var year = _cDT!.year;
    var mth = _cDT!.month;
    var day = _cDT!.day;

    // This day at 12am
    _beforeDT = tz.TZDateTime(loc, year, mth, day, 0, 0, 0, 0);
    _dbDT = _cDT!.subtract(const Duration(days: 1));
    // Next day at 12am
    _afterDT = _beforeDT!.add(const Duration(days: 1));
    // This day at 4am
    _coffDT = tz.TZDateTime(loc, year, mth, day, 4, 0, 0, 0);

    var ref = _db
        .collection('tracking')
        .doc(Util.getFirebaseUid())
        .collection('domain_material');

    return StreamBuilder(
      stream: ref.snapshots(),
      builder: (
        context,
        AsyncSnapshot<QuerySnapshot<Map<String, dynamic>>> snapshot,
      ) {
        if (snapshot.hasError) {
          return const Text('Error occurred getting snapshot');
        }

        if (snapshot.connectionState == ConnectionState.waiting ||
            _matData == null) {
          return Util.centerLoadingCircle('');
        }

        var data = snapshot.data!;
        var uniqueMaterials = data.docs
            .map((snapshot) => snapshot.data()['name'].toString())
            .toSet()
            .toList();

        var finalDomainMaterials = <String>[];
        // Tabulate the materials and remove completed ones
        for (var element in uniqueMaterials) {
          var cur = 0, max = 0;
          data.docs
              .where((element2) => element2.data()['name'] == element)
              .forEach((element) {
            cur += element.data()['current'] as int;
            max += element.data()['max'] as int;
          });

          if (cur < max) {
            finalDomainMaterials.add(element);
          }
        }

        var mappedData = <int, Set<String>>{};
        for (var i = 1; i <= 7; i++) {
          mappedData.putIfAbsent(i, () => {});
        }
        for (var domainMaterial in finalDomainMaterials) {
          if (_matData![domainMaterial] is! MaterialDataDomains) continue;

          var daysForMaterial =
              (_matData![domainMaterial] as MaterialDataDomains).days!;

          for (var day in daysForMaterial) {
            mappedData[day]!.add(domainMaterial);
          }
        }

        return _buildWeeklyMaterials(mappedData);
      },
    );
  }
}

// Tracker card itself
class TrackerCard extends StatefulWidget {
  final TrackingUserData data;
  final String dataId;
  final String? extraImageRef;
  final int extraAscensionRef;
  final String? extraTypeRef;
  final MaterialDataCommon material;

  const TrackerCard({
    super.key,
    required this.data,
    required this.dataId,
    required this.extraImageRef,
    required this.extraAscensionRef,
    required this.extraTypeRef,
    required this.material,
  });

  @override
  TrackerCardState createState() => TrackerCardState();
}

class TrackerCardState extends State<TrackerCard> {
  int _currentCount = 0;
  bool _bulkChange = false;
  Timer? _bulkTimer;

  final ButtonStyle _flatButtonStyle = TextButton.styleFrom(
    foregroundColor: Colors.black87,
    minimumSize: const Size(0, 0),
    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
    padding: const EdgeInsets.symmetric(horizontal: 8.0, vertical: 4.0),
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.all(Radius.circular(2.0)),
    ),
  );

  void _updateMultiTracking(
    TrackingUserData data,
    String dataId,
    String? extraImageRef,
    int extraAscensionRef,
    String? extraTypeRef,
    MaterialDataCommon material,
    bool dialog,
  ) {
    UpdateMultiTracking(
      context,
      material,
    ).itemClickedAction(
      data,
      dataId,
      {
        'img': extraImageRef,
        'asc': extraAscensionRef,
        'type': extraTypeRef,
      },
      dialog,
    );
  }

  Widget _trackerInfo() {
    return SizedBox(
      width: MediaQuery.of(context).size.width - 180,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.start,
        children: [
          Text(
            widget.material.name!,
            style: const TextStyle(
              fontSize: 20,
              color: Colors.white,
            ),
          ),
          RatingBar.builder(
            ignoreGestures: true,
            itemCount: 5,
            itemSize: 12,
            unratedColor: Colors.transparent,
            initialRating: double.tryParse(
              widget.material.rarity.toString(),
            )!,
            itemBuilder: (context, _) => const Icon(
              Icons.star,
              color: Colors.amber,
            ),
            onRatingUpdate: (rating) {
              debugPrint(rating.toString());
            },
          ),
          Text(
            widget.material.obtained!.replaceAll('\\n', '\n'),
            style: const TextStyle(
              fontSize: 11,
              color: Colors.white,
            ),
          ),
        ],
      ),
    );
  }

  Widget _trackerControls() {
    return Column(
      children: [
        Text(
          _getCounterText(),
          style: TextStyle(
            fontSize: 18,
            color: GridData.getCountColor(
              (_bulkChange) ? _currentCount : widget.data.current,
              widget.data.max,
            ),
          ),
        ),
        Row(
          children: [
            GestureDetector(
              onLongPressStart: _startDecrement,
              onLongPressEnd: _endDecrement,
              child: TextButton(
                style: _flatButtonStyle,
                onPressed: _decrement,
                child: const Icon(
                  Icons.remove,
                  color: Colors.white,
                ),
              ),
            ),
            GestureDetector(
              onLongPressStart: _startIncrement,
              onLongPressEnd: _endIncrement,
              child: TextButton(
                style: _flatButtonStyle,
                onPressed: _increment,
                child: const Icon(Icons.add, color: Colors.white),
              ),
            ),
          ],
        ),
        TrackingData.getSupportingWidget(
          widget.extraImageRef,
          widget.extraAscensionRef,
          widget.extraTypeRef,
        ),
      ],
    );
  }

  String _getCounterText() {
    String maxCnt = widget.data.max.toString();

    return _bulkChange
        ? "$_currentCount/$maxCnt"
        : "${widget.data.current}/$maxCnt";
  }

  void _startIncrement(LongPressStartDetails _) {
    setState(() {
      _bulkChange = true;
      _currentCount = widget.data.current ?? 0;
    });

    _bulkTimer = Timer.periodic(Duration(milliseconds: 500), (timer) {
      if (_currentCount >= (widget.data.max ?? 0)) {
        return;
      }
      setState(() {
        _currentCount++;
      });
    });
  }

  void _endIncrement(LongPressEndDetails _) {
    _bulkTimer?.cancel();
    TrackingData.setCount(
      widget.dataId,
      widget.data.type,
      _currentCount,
      widget.data.max!,
    );
    setState(() {
      _bulkChange = false;
    });
  }

  void _startDecrement(LongPressStartDetails _) {
    setState(() {
      _bulkChange = true;
      _currentCount = widget.data.current ?? 0;
    });

    _bulkTimer = Timer.periodic(Duration(milliseconds: 500), (timer) {
      if (_currentCount <= 0) {
        return;
      }
      setState(() {
        _currentCount--;
      });
    });
  }

  void _endDecrement(LongPressEndDetails _) {
    _bulkTimer?.cancel();
    TrackingData.setCount(
      widget.dataId,
      widget.data.type,
      _currentCount,
      widget.data.max!,
    );
    setState(() {
      _bulkChange = false;
    });
  }

  void _increment() {
    TrackingData.incrementCount(
      widget.dataId,
      widget.data.type,
      widget.data.current!,
      widget.data.max!,
    );
  }

  void _decrement() {
    TrackingData.decrementCount(
      widget.dataId,
      widget.data.type,
      widget.data.current!,
    );
  }

  void _secondaryTapDown(TapDownDetails details) {
    _handleSecondaryTapDownAsync(details);
  }

  Future<void> _handleSecondaryTapDownAsync(TapDownDetails _) async {
    if (kIsWeb) {
      await BrowserContextMenu.disableContextMenu();
      await Future.delayed(const Duration(seconds: 0));
      BrowserContextMenu.enableContextMenu();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      color: GridUtils.getRarityColor(widget.material.rarity),
      child: InkWell(
        onTap: () => _updateMultiTracking(
          widget.data,
          widget.dataId,
          widget.extraImageRef,
          widget.extraAscensionRef,
          widget.extraTypeRef,
          widget.material,
          false,
        ),
        onSecondaryTapDown: _secondaryTapDown,
        onSecondaryTap: () => _updateMultiTracking(
          widget.data,
          widget.dataId,
          widget.extraImageRef,
          widget.extraAscensionRef,
          widget.extraTypeRef,
          widget.material,
          true,
        ),
        onLongPress: () => _updateMultiTracking(
          widget.data,
          widget.dataId,
          widget.extraImageRef,
          widget.extraAscensionRef,
          widget.extraTypeRef,
          widget.material,
          true,
        ),
        child: Padding(
          padding: const EdgeInsets.all(8),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              GridData.getImageAssetFromFirebase(
                widget.material.image,
                height: 48,
              ),
              _trackerInfo(),
              const Spacer(),
              _trackerControls(),
            ],
          ),
        ),
      ),
    );
  }
}
