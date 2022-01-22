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
    const Tab(text: 'Boss'),
    const Tab(text: 'Domains'),
    const Tab(text: 'Monster'),
    const Tab(text: 'Local Speciality'),
  ];

  final List<Widget> _children = [
    const GlobalTracker(path: 'boss_drops'),
    const GlobalTracker(path: 'domain_material'),
    const GlobalTracker(path: 'mob_drops'),
    const GlobalTracker(path: 'local_speciality'),
  ];

  GlobalTrackingPage({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: _tabs.length,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Consolidated Material List'),
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

  const GlobalTracker({Key? key, required this.path}) : super(key: key);

  @override
  _GlobalTrackerState createState() => _GlobalTrackerState();
}

class _GlobalTrackerState extends State<GlobalTracker> {
  Map<String, MaterialDataCommon>? _materialData;

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
          return const Text('Error occurred getting snapshot');
        }

        if (snapshot.connectionState == ConnectionState.waiting ||
            _materialData == null) {
          return Util.centerLoadingCircle('');
        }

        var data = snapshot.data!;
        final _collectionLen = data.docs.length;

        if (_collectionLen > 0) {
          // Consolidate stuff together
          var _conData = <String?, CommonTracking>{};
          for (var snap in data.docs) {
            var _tmp = TrackingUserData.fromJson(snap.data() as Map<String, dynamic>);
            if (_conData.containsKey(_tmp.name)) {
              // Append
              _conData[_tmp.name]!.current =
                  _conData[_tmp.name]!.current! + _tmp.current!;
              _conData[_tmp.name]!.max = _conData[_tmp.name]!.max! + _tmp.max!;
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
          }

          return _getGlobalTrackingList(_conData);
        } else {
          return const Center(
            child: Text('No items being tracked for this material category'),
          );
        }
      },
    );
  }

  Widget _getGlobalTrackingList(Map<String?, CommonTracking> _conData) {
    return ListView.builder(
      itemCount: _conData.length,
      itemBuilder: (context, index) {
        var key = _conData.keys.elementAt(index);
        var _data = _conData[key]!;
        debugPrint(_data.toString());
        var _material = _materialData![_data.name!]!;

        return Card(
          color: GridUtils.getRarityColor(_material.rarity),
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
                  const Spacer(),
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
    return SizedBox(
      width: MediaQuery.of(context).size.width - 180,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.start,
        children: [
          Text(
            _material.name!,
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
              _material.rarity.toString(),
            )!,
            itemBuilder: (context, _) => const Icon(Icons.star, color: Colors.amber),
            onRatingUpdate: (rating) {
              debugPrint(rating.toString());
            },
          ),
          Text(
            _material.obtained!.replaceAll('\\n', '\n'),
            style: const TextStyle(
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
  const GlobalMaterialPage({Key? key}) : super(key: key);

  @override
  _GlobalMaterialPageState createState() => _GlobalMaterialPageState();
}

class _GlobalMaterialPageState extends State<GlobalMaterialPage> {
  String? _materialKey;
  MaterialDataCommon? _material;
  Map<String, WeaponData>? _weaponData;
  Map<String, CharacterData>? _characterData;

  Color? _rarityColor;
  int _tapCount = 0;

  bool _firstLoad = false;

  ButtonStyle? _flatButtonStyle;

  @override
  void initState() {
    super.initState();
    debugPrint(Get.parameters.toString());
    _materialKey = Get.parameters['materialKey'];
    _getStaticData();
    _flatButtonStyle = TextButton.styleFrom(
      primary: (Util.themeNotifier.isDarkMode()) ? Colors.white : Colors.black,
      minimumSize: const Size(0, 0),
      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
      padding: const EdgeInsets.symmetric(horizontal: 8.0, vertical: 4.0),
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
        title: Text(_material!.name!),
        backgroundColor: _rarityColor,
      ),
      body: Padding(
        padding: const EdgeInsets.all(8),
        child: SingleChildScrollView(
          child: Column(
            children: [
              _materialHeader(),
              const Divider(),
              ...GridData.generateInfoLine(
                _material!.obtained!.replaceAll('- ', ''),
                Icons.location_pin,
              ),
              ...GridData.generateInfoLine(
                _material!.description!,
                Icons.format_list_bulleted,
              ),
              Padding(
                padding: const EdgeInsets.all(8),
                child: Row(
                  children: const [
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
          _material!.image,
          height: 64,
        ),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              width: MediaQuery.of(context).size.width - 128,
              child: Text(
                _material!.type!,
                textAlign: TextAlign.start,
                style: const TextStyle(fontSize: 20),
              ),
            ),
            RatingBar.builder(
              ignoreGestures: true,
              itemCount: 5,
              itemSize: 30,
              initialRating: double.tryParse(_material!.rarity.toString())!,
              itemBuilder: (context, _) =>
                  const Icon(Icons.star, color: Colors.amber),
              onRatingUpdate: (rating) {
                debugPrint(rating.toString());
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
      _material = materialData![_materialKey!];
      if (_material == null) Get.offAndToNamed('/splash');
      _rarityColor = GridUtils.getRarityColor(_material!.rarity);
    });
  }

  Widget _getCharacterData() {
    var ref = _db
        .collection('tracking')
        .doc(Util.getFirebaseUid())
        .collection(_material!.innerType!)
        .where('name', isEqualTo: _materialKey);

    return StreamBuilder(
      stream: ref.snapshots(),
      builder: (context, AsyncSnapshot<QuerySnapshot> snapshot) {
        if (_characterData == null ||
            _weaponData == null ||
            (snapshot.connectionState == ConnectionState.waiting &&
                !_firstLoad)) {
          return const Padding(
            padding: EdgeInsets.only(top: 16),
            child: CircularProgressIndicator(),
          );
        }

        _firstLoad = true;

        var qs = snapshot.data!;
        var _trackerData = <String, TrackingUserData>{};
        for (var data in qs.docs) {
          _trackerData.putIfAbsent(
            data.id,
            () => TrackingUserData.fromJson(data.data() as Map<String, dynamic>),
          );
        }

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
        var _data = _trackerData[key]!;
        var imageRef = _material!.image;
        var extraAscensionRef = 0;
        String? extraTypeRef;
        var name = _material!.name;
        var override = false;
        debugPrint(key);
        var _splitKey = key.split('_');
        var _ascendTier = _splitKey[_splitKey.length - 1];
        debugPrint(_ascendTier);
        if (_data.addData != null) {
          // Grab image ref of extra data based on addedBy
          if (_data.addedBy == 'character') {
            // Grab from character
            name = _characterData![_data.addData!]!.name;
            imageRef = _characterData![_data.addData!]!.image;
            extraTypeRef = _characterData![_data.addData!]!.element;
            extraAscensionRef = int.tryParse(_ascendTier) ?? 0;
          } else if (_data.addedBy == 'weapon') {
            // Grab from weapon
            imageRef = _weaponData![_data.addData!]!.image;
            name = _weaponData![_data.addData!]!.name;
            extraAscensionRef = int.tryParse(_ascendTier) ?? 0;
          } else if (_data.addedBy == 'talent') {
            // Grab from character talent
            var _cData = _data.addData!.split('|');
            imageRef = _characterData![_cData[0]]!.talent!.attack![_cData[1]]!.image;
            extraAscensionRef = int.tryParse(_ascendTier) ?? 0;
            name =
                "${_characterData![_cData[0]]!.name}'s ${_characterData![_cData[0]]!.talent!.attack![_cData[1]]!.name} ${GridUtils.getRomanNumberArray(extraAscensionRef - 1)}";
            override = true;
          }
          if (!override) {
            name =
                '$name (Tier ${GridUtils.getRomanNumberArray(extraAscensionRef - 1)})';
          }
        }

        Widget typeWidget = const SizedBox.shrink();
        if (extraTypeRef != null) {
          typeWidget = Image.asset(
            GridUtils.getElementImageRef(extraTypeRef)!,
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
          name!,
        );
      },
    );
  }

  Widget _getCharacterDataImage(
    String? imageRef,
    int extraAscensionRef,
    Widget typeWidget,
  ) {
    return SizedBox(
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
            child: Text(GridUtils.getRomanNumberArray(
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
            color: GridData.getCountColor(_data.current, _data.max, bw: true),
          ),
        ),
        Row(
          children: [
            TextButton(
              style: _flatButtonStyle,
              onPressed: () => TrackingData.decrementCount(
                key,
                _data.type,
                _data.current!,
              ),
              child: const Icon(Icons.remove),
            ),
            TextButton(
              style: _flatButtonStyle,
              onPressed: () => TrackingData.incrementCount(
                key,
                _data.type,
                _data.current!,
                _data.max!,
              ),
              child: const Icon(Icons.add),
            ),
          ],
        ),
      ],
    );
  }

  Widget _getCharacterDataContainer(
    String? imageRef,
    int extraAscensionRef,
    String? extraTypeRef,
    Widget typeWidget,
    String key,
    TrackingUserData _data,
    String name,
  ) {
    return Card(
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
              SizedBox(
                width: MediaQuery.of(context).size.width - 200,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.start,
                  children: [
                    Text(
                      name,
                      style: const TextStyle(fontSize: 20),
                    ),
                  ],
                ),
              ),
              const Spacer(),
              _getCharacterDataControls(key, _data),
            ],
          ),
        ),
      ),
    );
  }
}
