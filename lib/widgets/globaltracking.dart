import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:flutter_rating_bar/flutter_rating_bar.dart';
import 'package:get/get.dart';
import 'package:gi_weekly_material_tracker/helpers/grid.dart';
import 'package:gi_weekly_material_tracker/helpers/tracker.dart';
import 'package:gi_weekly_material_tracker/models/characterdata.dart';
import 'package:gi_weekly_material_tracker/models/commondata.dart';
import 'package:gi_weekly_material_tracker/models/materialdata.dart';
import 'package:gi_weekly_material_tracker/models/trackdata.dart';
import 'package:gi_weekly_material_tracker/models/weapondata.dart';
import 'package:gi_weekly_material_tracker/util.dart';

final FirebaseFirestore _db = FirebaseFirestore.instance;

class GlobalTrackingPage extends StatelessWidget {
  final List<Tab> _tabs = [
    Tab(text: 'Boss'),
    Tab(text: 'Domains'),
    Tab(text: 'Monster'),
    Tab(text: 'Local Speciality'),
  ];

  final List<Widget> _children = [
    GlobalTracker(path: 'boss_drops'),
    GlobalTracker(path: 'domain_material'),
    GlobalTracker(path: 'mob_drops'),
    GlobalTracker(path: 'local_speciality'),
  ];

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: _tabs.length,
      child: Scaffold(
        appBar: AppBar(
          title: Text('Consolidated Material List'),
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
  final String path;

  GlobalTracker({Key key, @required this.path}) : super(key: key);

  @override
  _GlobalTrackerState createState() => _GlobalTrackerState();
}

class _GlobalTrackerState extends State<GlobalTracker> {
  Map<String, MaterialDataCommon> _materialData;

  @override
  void initState() {
    super.initState();

    GridData.retrieveMaterialsMapData().then((value) => {
          setState(() {
            if (!mounted) return;
            _materialData = value;
          }),
        });
  }

  @override
  Widget build(BuildContext context) {
    var ref = _db
        .collection('tracking')
        .doc(Util.getFirebaseUid())
        .collection(widget.path);

    return StreamBuilder(
      stream: ref.snapshots(),
      builder: (context, AsyncSnapshot<QuerySnapshot> snapshot) {
        if (snapshot.hasError) {
          return Text('Error occurred getting snapshot');
        }

        if (snapshot.connectionState == ConnectionState.waiting ||
            _materialData == null) {
          return Util.centerLoadingCircle('');
        }

        var data = snapshot.data;
        final _collectionLen = data.docs.length;

        if (_collectionLen > 0) {
          // Consolidate stuff together
          var _conData = <String, CommonTracking>{};
          data.docs.forEach((snap) {
            var _tmp = TrackingUserData.fromJson(snap.data());
            if (_conData.containsKey(_tmp.name)) {
              // Append
              _conData[_tmp.name].current =
                  _conData[_tmp.name].current + _tmp.current;
              _conData[_tmp.name].max = _conData[_tmp.name].max + _tmp.max;
            } else {
              _conData.putIfAbsent(
                _tmp.name,
                () => CommonTracking(
                  current: _tmp.current,
                  max: _tmp.max,
                  name: _tmp.name,
                  type: _tmp.type,
                ),
              );
            }
          });

          return _getGlobalTrackingList(_conData);
        } else {
          return Center(
            child: Text('No items being tracked for this material category'),
          );
        }
      },
    );
  }

  Widget _getGlobalTrackingList(Map<String, CommonTracking> _conData) {
    return ListView.builder(
      itemCount: _conData.length,
      itemBuilder: (context, index) {
        var key = _conData.keys.elementAt(index);
        var _data = _conData[key];
        print(_data);
        var _material = _materialData[_data.name];

        return Card(
          color: GridData.getRarityColor(_material.rarity),
          child: InkWell(
            onTap: () => Get.toNamed('/globalMaterial/${_data.name}'),
            child: Padding(
              padding: const EdgeInsets.all(8),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  GridData.getImageAssetFromFirebase(
                    _material.image,
                    height: 48,
                  ),
                  _getMaterialInfo(_material),
                  Spacer(),
                  Column(
                    children: [
                      Text(
                        '${_data.current}/${_data.max}',
                        style: TextStyle(
                          fontSize: 18,
                          color: GridData.getCountColor(
                            _data.current,
                            _data.max,
                          ),
                        ),
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
  }

  Widget _getMaterialInfo(MaterialDataCommon _material) {
    return Container(
      width: MediaQuery.of(context).size.width - 180,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.start,
        children: [
          Text(
            _material.name,
            style: TextStyle(
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
              _material.rarity.toString(),
            ),
            itemBuilder: (context, _) => Icon(Icons.star, color: Colors.amber),
            onRatingUpdate: (rating) {
              print(rating);
            },
          ),
          Text(
            _material.obtained.replaceAll('\\n', '\n'),
            style: TextStyle(
              fontSize: 11,
              color: Colors.white,
            ),
          ),
        ],
      ),
    );
  }
}

class GlobalMaterialPage extends StatefulWidget {
  @override
  _GlobalMaterialPageState createState() => _GlobalMaterialPageState();
}

class _GlobalMaterialPageState extends State<GlobalMaterialPage> {
  String _materialKey;
  MaterialDataCommon _material;
  Map<String, WeaponData> _weaponData;
  Map<String, CharacterData> _characterData;

  Color _rarityColor;
  int _tapCount = 0;

  bool _firstLoad = false;

  ButtonStyle _flatButtonStyle;

  @override
  void initState() {
    super.initState();
    print(Get.parameters);
    _materialKey = Get.parameters['materialKey'];
    _getStaticData();
    _flatButtonStyle = TextButton.styleFrom(
      primary: (Util.themeNotifier.isDarkMode()) ? Colors.white : Colors.black,
      minimumSize: Size(0, 0),
      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
      padding: EdgeInsets.symmetric(horizontal: 8.0, vertical: 4.0),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.all(Radius.circular(2.0)),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_material == null) return Util.loadingScreen();

    return Scaffold(
      appBar: AppBar(
        title: Text(_material.name),
        backgroundColor: _rarityColor,
      ),
      body: Padding(
        padding: const EdgeInsets.all(8),
        child: SingleChildScrollView(
          child: Column(
            children: [
              _materialHeader(),
              Divider(),
              ...GridData.generateInfoLine(
                _material.obtained.replaceAll('- ', ''),
                Icons.location_pin,
              ),
              ...GridData.generateInfoLine(
                _material.description,
                Icons.format_list_bulleted,
              ),
              Padding(
                padding: const EdgeInsets.all(8),
                child: Row(
                  children: [
                    Text(
                      'Tracking For',
                      style: TextStyle(fontSize: 24),
                    ),
                  ],
                ),
              ),
              _getCharacterData(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _materialHeader() {
    return Row(
      children: [
        GridData.getImageAssetFromFirebase(
          _material.image,
          height: 64,
        ),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: MediaQuery.of(context).size.width - 128,
              child: Text(
                _material.type,
                textAlign: TextAlign.start,
                style: TextStyle(fontSize: 20),
              ),
            ),
            RatingBar.builder(
              ignoreGestures: true,
              itemCount: 5,
              itemSize: 30,
              initialRating: double.tryParse(_material.rarity.toString()),
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

  void _getStaticData() async {
    var characterData = await GridData.retrieveCharactersMapData();
    var weaponData = await GridData.retrieveWeaponsMapData();
    var materialData = await GridData.retrieveMaterialsMapData();
    setState(() {
      _characterData = characterData;
      _weaponData = weaponData;
      _material = materialData[_materialKey];
      if (_material == null) Get.offAndToNamed('/splash');
      _rarityColor = GridData.getRarityColor(_material.rarity);
    });
  }

  Widget _getCharacterData() {
    var ref = _db
        .collection('tracking')
        .doc(Util.getFirebaseUid())
        .collection(_material.innerType)
        .where('name', isEqualTo: _materialKey);

    return StreamBuilder(
      stream: ref.snapshots(),
      builder: (context, AsyncSnapshot<QuerySnapshot> snapshot) {
        if (_characterData == null ||
            _weaponData == null ||
            (snapshot.connectionState == ConnectionState.waiting &&
                !_firstLoad)) {
          return Padding(
            padding: const EdgeInsets.only(top: 16),
            child: CircularProgressIndicator(),
          );
        }

        _firstLoad = true;

        var qs = snapshot.data;
        var _trackerData = <String, TrackingUserData>{};
        qs.docs.forEach((data) => {
              _trackerData.putIfAbsent(
                data.id,
                () => TrackingUserData.fromJson(data.data()),
              ),
            });

        return _getCharacterDataList(_trackerData);
      },
    );
  }

  Widget _getCharacterDataList(Map<String, TrackingUserData> _trackerData) {
    return ListView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: _trackerData.length,
      itemBuilder: (context, index) {
        var key = _trackerData.keys.elementAt(index);
        var _data = _trackerData[key];
        var imageRef = _material.image;
        var extraAscensionRef = 0;
        String extraTypeRef;
        var name = _material.name;
        var override = false;
        print(key);
        var _splitKey = key.split('_');
        var _ascendTier = _splitKey[_splitKey.length - 1];
        print(_ascendTier);
        if (_data.addData != null) {
          // Grab image ref of extra data based on addedBy
          if (_data.addedBy == 'character') {
            // Grab from character
            name = _characterData[_data.addData].name;
            imageRef = _characterData[_data.addData].image;
            extraTypeRef = _characterData[_data.addData].element;
            extraAscensionRef = int.tryParse(_ascendTier) ?? 0;
          } else if (_data.addedBy == 'weapon') {
            // Grab from weapon
            imageRef = _weaponData[_data.addData].image;
            name = _weaponData[_data.addData].name;
            extraAscensionRef = int.tryParse(_ascendTier) ?? 0;
          } else if (_data.addedBy == 'talent') {
            // Grab from character talent
            var _cData = _data.addData.split('|');
            imageRef = _characterData[_cData[0]].talent.attack[_cData[1]].image;
            extraAscensionRef = int.tryParse(_ascendTier) ?? 0;
            name =
                "${_characterData[_cData[0]].name}'s ${_characterData[_cData[0]].talent.attack[_cData[1]].name} ${GridData.getRomanNumberArray(extraAscensionRef - 1)}";
            override = true;
          }
          if (!override) {
            name =
                '$name (Tier ${GridData.getRomanNumberArray(extraAscensionRef - 1)})';
          }
        }

        Widget typeWidget = SizedBox.shrink();
        if (extraTypeRef != null) {
          typeWidget = Image.asset(
            GridData.getElementImageRef(extraTypeRef),
            height: 20,
            width: 20,
          );
        }

        return _getCharacterDataContainer(
          imageRef,
          extraAscensionRef,
          extraTypeRef,
          typeWidget,
          key,
          _data,
          name,
        );
      },
    );
  }

  Widget _getCharacterDataImage(
    String imageRef,
    int extraAscensionRef,
    Widget typeWidget,
  ) {
    return Container(
      height: 64,
      width: 64,
      child: Stack(
        children: [
          GridData.getImageAssetFromFirebase(
            imageRef,
            height: 48,
          ),
          Align(
            alignment: FractionalOffset.bottomLeft,
            child: Text(GridData.getRomanNumberArray(
              extraAscensionRef - 1,
            ).toString()),
          ),
          Align(
            alignment: FractionalOffset.bottomRight,
            child: typeWidget,
          ),
        ],
      ),
    );
  }

  Widget _getCharacterDataControls(String key, TrackingUserData _data) {
    return Column(
      children: [
        Text(
          '${_data.current}/${_data.max}',
          style: TextStyle(
            fontSize: 18,
            color: GridData.getCountColorBW(_data.current, _data.max),
          ),
        ),
        Row(
          children: [
            TextButton(
              style: _flatButtonStyle,
              onPressed: () => TrackingData.decrementCount(
                key,
                _data.type,
                _data.current,
              ),
              child: Icon(Icons.remove),
            ),
            TextButton(
              style: _flatButtonStyle,
              onPressed: () => TrackingData.incrementCount(
                key,
                _data.type,
                _data.current,
                _data.max,
              ),
              child: Icon(Icons.add),
            ),
          ],
        ),
      ],
    );
  }

  Widget _getCharacterDataContainer(
    String imageRef,
    int extraAscensionRef,
    String extraTypeRef,
    Widget typeWidget,
    String key,
    TrackingUserData _data,
    String name,
  ) {
    return Container(
      child: Card(
        child: InkWell(
          onLongPress: () =>
              UpdateMultiTracking(context, _material).itemClickedAction(
            _data,
            key,
            {
              'img': imageRef,
              'asc': extraAscensionRef,
              'type': extraTypeRef,
            },
            true,
          ),
          onTap: () {
            _tapCount++;
            if (_tapCount > 5) {
              Util.showSnackbarQuick(
                context,
                'Long press to bulk update tracked materials',
              );
            }
          },
          child: Padding(
            padding: const EdgeInsets.all(8),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                _getCharacterDataImage(imageRef, extraAscensionRef, typeWidget),
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
                _getCharacterDataControls(key, _data),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
