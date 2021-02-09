import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:flutter_rating_bar/flutter_rating_bar.dart';
import 'package:get/get.dart';
import 'package:gi_weekly_material_tracker/models/characterdata.dart';
import 'package:gi_weekly_material_tracker/models/grid.dart';
import 'package:gi_weekly_material_tracker/models/materialdata.dart';
import 'package:gi_weekly_material_tracker/models/trackdata.dart';
import 'package:gi_weekly_material_tracker/models/tracker.dart';
import 'package:gi_weekly_material_tracker/models/weapondata.dart';
import 'package:gi_weekly_material_tracker/util.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:timezone/data/latest.dart' as tz;
import 'package:timezone/timezone.dart' as tz;

final FirebaseFirestore _db = FirebaseFirestore.instance;

class TrackingTabController extends StatefulWidget {
  TrackingTabController({Key key, @required this.tabController})
      : super(key: key);

  final TabController tabController;

  @override
  _TrackingTabControllerState createState() => _TrackingTabControllerState();
}

class _TrackingTabControllerState extends State<TrackingTabController> {
  final List<Widget> _children = [
    TrackerPage(path: "boss_drops"),
    TrackerPage(path: "domain_material"),
    TrackerPage(path: "mob_drops"),
    TrackerPage(path: "local_speciality"),
    PlannerPage(),
  ];

  @override
  Widget build(BuildContext context) {
    return TabBarView(controller: widget.tabController, children: _children);
  }
}

class TrackerPage extends StatefulWidget {
  TrackerPage({Key key, @required this.path}) : super(key: key);

  final String path;

  @override
  _TrackerPageState createState() => _TrackerPageState();
}

class _TrackerPageState extends State<TrackerPage> {
  Map<String, MaterialDataCommon> _materialData;
  Map<String, WeaponData> _weaponData;
  Map<String, CharacterData> _characterData;

  @override
  void initState() {
    super.initState();
    _retrieveData();
  }

  void _retrieveData() async {
    Map<String, MaterialDataCommon> m =
        await GridData.retrieveMaterialsMapData();
    Map<String, CharacterData> c = await GridData.retrieveCharactersMapData();
    Map<String, WeaponData> w = await GridData.retrieveWeaponsMapData();
    if (this.mounted)
      setState(() {
        _materialData = m;
        _characterData = c;
        _weaponData = w;
      });
  }

  @override
  Widget build(BuildContext context) {
    if (_materialData == null || _characterData == null || _weaponData == null)
      return Util.centerLoadingCircle("Loading");

    CollectionReference ref = _db
        .collection("tracking")
        .doc(Util.getFirebaseUid())
        .collection(widget.path);
    return StreamBuilder(
        stream: ref.snapshots(),
        builder: (context, AsyncSnapshot<QuerySnapshot> snapshot) {
          if (snapshot.hasError) {
            print(snapshot.error);
            return Text("Error occurred getting snapshot");
          }

          if (snapshot.connectionState == ConnectionState.waiting ||
              _materialData == null ||
              _characterData == null ||
              _weaponData == null) {
            return Util.centerLoadingCircle("");
          }

          QuerySnapshot data = snapshot.data;
          final int _collectionLen = data.docs.length;

          if (_collectionLen > 0) {
            return ListView.builder(
              itemCount: _collectionLen,
              itemBuilder: (context, index) {
                TrackingUserData _data =
                    TrackingUserData.fromJson(data.docs[index].data());
                String _dataId = data.docs[index].id;
                print(_data);
                MaterialDataCommon _material = _materialData[_data.name];
                String extraImageRef;
                int extraAscensionRef = 0;
                String extraTypeRef;
                var _ascendTier = _dataId.substring(_dataId.length - 1);
                if (_data.addData != null) {
                  // Grab image ref of extra data based on addedBy
                  if (_data.addedBy == "character") {
                    // Grab from character
                    extraImageRef = _characterData[_data.addData].image;
                    extraAscensionRef = int.tryParse(_ascendTier) ?? 0;
                    extraTypeRef = _characterData[_data.addData].element;
                  } else if (_data.addedBy == "weapon") {
                    // Grab from weapon
                    extraImageRef = _weaponData[_data.addData].image;
                    extraAscensionRef = int.tryParse(_ascendTier) ?? 0;
                  } else if (_data.addedBy == "talent") {
                    // Grab from character talent
                    List<String> _cData = _data.addData.split("|");
                    extraImageRef = _characterData[_cData[0]]
                        .talent
                        .attack[_cData[1]]
                        .image;
                    extraAscensionRef = int.tryParse(_ascendTier) ?? 0;
                  }
                }

                return Card(
                  color: GridData.getRarityColor(_material.rarity),
                  child: InkWell(
                    onTap: () =>
                        UpdateMultiTracking(context, _materialData[_data.name])
                            .itemClickedAction(
                                _data,
                                _dataId,
                                {
                                  "img": extraImageRef,
                                  "asc": extraAscensionRef,
                                  "type": extraTypeRef
                                },
                                false),
                    onLongPress: () =>
                        UpdateMultiTracking(context, _materialData[_data.name])
                            .itemClickedAction(
                                _data,
                                _dataId,
                                {
                                  "img": extraImageRef,
                                  "asc": extraAscensionRef,
                                  "type": extraTypeRef
                                },
                                true),
                    child: Padding(
                      padding: const EdgeInsets.all(8),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.center,
                        children: [
                          GridData.getImageAssetFromFirebase(_material.image,
                              height: 48),
                          Container(
                            width: MediaQuery.of(context).size.width - 180,
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisAlignment: MainAxisAlignment.start,
                              children: [
                                Text(
                                  _material.name,
                                  style: TextStyle(
                                      fontSize: 20, color: Colors.white),
                                ),
                                RatingBar.builder(
                                  ignoreGestures: true,
                                  itemCount: 5,
                                  itemSize: 12,
                                  unratedColor: Colors.transparent,
                                  initialRating: double.tryParse(
                                      _material.rarity.toString()),
                                  itemBuilder: (context, _) =>
                                      Icon(Icons.star, color: Colors.amber),
                                  onRatingUpdate: (rating) {
                                    print(rating);
                                  },
                                ),
                                Text(
                                  _material.obtained.replaceAll("\\n", "\n"),
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
                                "${_data.current}/${_data.max}",
                                style: TextStyle(
                                    fontSize: 18,
                                    color: GridData.getCountColor(
                                        _data.current, _data.max)),
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
                                          TrackingData.decrementCount(_dataId,
                                              _data.type, _data.current),
                                      child: Icon(Icons.remove,
                                          color: Colors.white),
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
                                              _dataId,
                                              _data.type,
                                              _data.current,
                                              _data.max),
                                      child:
                                          Icon(Icons.add, color: Colors.white),
                                    ),
                                  ),
                                ],
                              ),
                              TrackingData.getSupportingWidget(extraImageRef,
                                  extraAscensionRef, extraTypeRef),
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

class PlannerPage extends StatefulWidget {
  @override
  _PlannerPageState createState() => _PlannerPageState();
}

class _PlannerPageState extends State<PlannerPage> {
  Map<String, MaterialDataCommon> _materialData;

  tz.TZDateTime _cDT, _beforeDT, _afterDT, _coffDT, _dbDT;

  String _location = "Asia";

  @override
  void initState() {
    super.initState();
    GridData.retrieveMaterialsMapData().then((value) => {
          setState(() {
            _materialData = value;
          })
        });

    SharedPreferences.getInstance().then((value) {
      _location = value.getString("location") ?? "Asia";
    });
    tz.initializeTimeZones();
  }

  String _getLoc() {
    switch (_location) {
      case "EU":
        return "Europe/Paris";
      case "NA":
        return "America/New_York";
      default:
        return "Asia/Singapore";
    }
  }

  String _getLocStr() {
    switch (_location) {
      case "EU":
        return "+1 (EU)";
      case "NA":
        return "-5 (NA)";
      default:
        return "+8 (Asia)";
    }
  }

  @override
  Widget build(BuildContext context) {
    var loc = tz.getLocation(_getLoc());
    _cDT = tz.TZDateTime.now(loc);
    _beforeDT = tz.TZDateTime(
        loc, _cDT.year, _cDT.month, _cDT.day, 0, 0, 0, 0); // This day at 12am
    _dbDT = _cDT.subtract(Duration(days: 1));
    _afterDT = _beforeDT.add(Duration(days: 1)); // Next day at 12am
    _coffDT = tz.TZDateTime(
        loc, _cDT.year, _cDT.month, _cDT.day, 4, 0, 0, 0); // This day at 4am

    CollectionReference ref = _db
        .collection("tracking")
        .doc(Util.getFirebaseUid())
        .collection("domain_material");
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
          List<String> _finalDomainMaterials = data.docs
              .map((snapshot) => snapshot.data()["name"].toString())
              .toSet()
              .toList();
          Map<int, Set<String>> _mappedData = {
            1: new Set(),
            2: new Set(),
            3: new Set(),
            4: new Set(),
            5: new Set(),
            6: new Set(),
            7: new Set(),
          };
          _finalDomainMaterials.forEach((domainMaterial) {
            if (!(_materialData[domainMaterial] is MaterialDataDomains)) return;

            List<int> _daysForMaterial =
                (_materialData[domainMaterial] as MaterialDataDomains).days;
            _daysForMaterial.forEach((day) {
              _mappedData[day].add(domainMaterial);
            });
          });

          return SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(8, 8, 8, 0),
                  child: Text(
                    "Day resets at 4am GMT${_getLocStr()}",
                    style: TextStyle(fontSize: 12),
                  ),
                ),
                ListView.separated(
                  shrinkWrap: true,
                  physics: NeverScrollableScrollPhysics(),
                  itemCount: _mappedData.length,
                  itemBuilder: (context, index) {
                    int key = _mappedData.keys.elementAt(index);
                    List<String> _curData = _mappedData[key].toList();
                    return ListTile(
                      tileColor: _getTileColorIfCurrentDay(key),
                      leading: Text(GridData.getDayString(key)),
                      title: _getGridMaterials(_curData),
                    );
                  },
                  separatorBuilder: (context, index) => Divider(height: 1),
                ),
              ],
            ),
          );
        });
  }

  Color _getTileColorIfCurrentDay(int key) {
    bool currentDay = false;
    if (_cDT.isAfter(_coffDT) && _cDT.isBefore(_afterDT) && _cDT.weekday == key)
      currentDay = true;
    else if (_cDT.isBefore(_coffDT) &&
        _cDT.isAfter(_beforeDT) &&
        _dbDT.weekday == key) currentDay = true;

    if (currentDay)
      return (Util.themeNotifier.isDarkMode())
          ? Colors.green
          : Colors.lightGreen;
    else
      return Colors.transparent;
  }

  Widget _getGridMaterials(List<String> _curData) {
    if (_curData.isEmpty)
      return Text("Not tracking any domain materials for this day");
    return GridView.count(
      shrinkWrap: true,
      physics: NeverScrollableScrollPhysics(),
      crossAxisCount:
          (MediaQuery.of(context).orientation == Orientation.portrait) ? 3 : 6,
      children: _curData.map((materialId) {
        return GestureDetector(
          onTap: () => Get.toNamed('/materials/$materialId'),
          child: GridData.getGridData(_materialData[materialId]),
        );
      }).toList(),
    );
  }
}
