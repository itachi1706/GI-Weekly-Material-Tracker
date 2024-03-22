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

  const TrackingTabController({Key? key, required this.tabController})
      : super(key: key);

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

  const TrackerPage({Key? key, required this.path}) : super(key: key);

  @override
  TrackerPageState createState() => TrackerPageState();
}

class TrackerPageState extends State<TrackerPage> {
  Map<String, MaterialDataCommon>? _materialData;
  Map<String, WeaponData>? _weaponData;
  Map<String, CharacterData>? _characterData;

  late SharedPreferences _prefs;

  final ButtonStyle _flatButtonStyle = TextButton.styleFrom(
    foregroundColor: Colors.black87,
    minimumSize: const Size(0, 0),
    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
    padding: const EdgeInsets.symmetric(horizontal: 8.0, vertical: 4.0),
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.all(Radius.circular(2.0)),
    ),
  );

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

              return _getCardData(
                data,
                dataId,
                extraImageRef,
                extraAscensionRef,
                extraTypeRef,
                material,
              );
            },
          )
        : const Center(
            child: Text('No items being tracked for this material category'),
          );
  }

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
      _materialData![data.name!],
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

  Widget _getCardData(
    TrackingUserData data,
    String dataId,
    String? extraImageRef,
    int extraAscensionRef,
    String? extraTypeRef,
    MaterialDataCommon material,
  ) {
    return Card(
      color: GridUtils.getRarityColor(material.rarity),
      child: InkWell(
        onTap: () => _updateMultiTracking(
          data,
          dataId,
          extraImageRef,
          extraAscensionRef,
          extraTypeRef,
          material,
          false,
        ),
        onSecondaryTapDown: (details) async {
          if (kIsWeb) {
            await BrowserContextMenu.disableContextMenu();
            await Future.delayed(const Duration(seconds: 0));
            BrowserContextMenu.enableContextMenu();
          }
        },
        onSecondaryTap: () => _updateMultiTracking(
          data,
          dataId,
          extraImageRef,
          extraAscensionRef,
          extraTypeRef,
          material,
          true,
        ),
        onLongPress: () => _updateMultiTracking(
          data,
          dataId,
          extraImageRef,
          extraAscensionRef,
          extraTypeRef,
          material,
          true,
        ),
        child: Padding(
          padding: const EdgeInsets.all(8),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              GridData.getImageAssetFromFirebase(
                material.image,
                height: 48,
              ),
              _trackerInfo(material),
              const Spacer(),
              _trackerControls(
                data,
                dataId,
                extraImageRef,
                extraAscensionRef,
                extraTypeRef,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _trackerInfo(MaterialDataCommon material) {
    return SizedBox(
      width: MediaQuery.of(context).size.width - 180,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.start,
        children: [
          Text(
            material.name!,
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
              material.rarity.toString(),
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
            material.obtained!.replaceAll('\\n', '\n'),
            style: const TextStyle(
              fontSize: 11,
              color: Colors.white,
            ),
          ),
        ],
      ),
    );
  }

  Widget _trackerControls(
    TrackingUserData data,
    String dataId,
    String? extraImageRef,
    int extraAscensionRef,
    String? extraTypeRef,
  ) {
    return Column(
      children: [
        Text(
          '${data.current}/${data.max}',
          style: TextStyle(
            fontSize: 18,
            color: GridData.getCountColor(
              data.current,
              data.max,
            ),
          ),
        ),
        Row(
          children: [
            TextButton(
              style: _flatButtonStyle,
              onPressed: () => TrackingData.decrementCount(
                dataId,
                data.type,
                data.current!,
              ),
              child: const Icon(
                Icons.remove,
                color: Colors.white,
              ),
            ),
            TextButton(
              style: _flatButtonStyle,
              onPressed: () => TrackingData.incrementCount(
                dataId,
                data.type,
                data.current!,
                data.max!,
              ),
              child: const Icon(Icons.add, color: Colors.white),
            ),
          ],
        ),
        TrackingData.getSupportingWidget(
          extraImageRef,
          extraAscensionRef,
          extraTypeRef,
        ),
      ],
    );
  }

  void _retrieveData() async {
    var prefs = await SharedPreferences.getInstance();
    var m = await GridData.retrieveMaterialsMapData();
    var c = await GridData.retrieveCharactersMapData();
    var w = await GridData.retrieveWeaponsMapData();
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
  const PlannerPage({Key? key}) : super(key: key);

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
    // This day at 12am
    _beforeDT =
        tz.TZDateTime(loc, _cDT!.year, _cDT!.month, _cDT!.day, 0, 0, 0, 0);
    _dbDT = _cDT!.subtract(const Duration(days: 1));
    // Next day at 12am
    _afterDT = _beforeDT!.add(const Duration(days: 1));
    // This day at 4am
    _coffDT =
        tz.TZDateTime(loc, _cDT!.year, _cDT!.month, _cDT!.day, 4, 0, 0, 0);

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
