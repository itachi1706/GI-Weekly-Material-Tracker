import 'package:firebase_database/firebase_database.dart';
import 'package:firebase_ui_database/firebase_ui_database.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_countdown_timer/current_remaining_time.dart';
import 'package:flutter_countdown_timer/flutter_countdown_timer.dart';
import 'package:get/get.dart';
import 'package:gi_weekly_material_tracker/extensions/string_extensions.dart';
import 'package:gi_weekly_material_tracker/helpers/grid.dart';
import 'package:gi_weekly_material_tracker/models/bannerdata.dart';
import 'package:gi_weekly_material_tracker/models/characterdata.dart';
import 'package:gi_weekly_material_tracker/models/weapondata.dart';
import 'package:gi_weekly_material_tracker/util.dart';
import 'package:gi_weekly_material_tracker/widgets/drawer.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import 'package:timezone/data/latest.dart' as tz;

final FirebaseDatabase db = FirebaseDatabase.instance;

class WishListPage extends StatefulWidget {
  const WishListPage({Key? key}) : super(key: key);

  @override
  WishListPageState createState() => WishListPageState();
}

class WishListPageState extends State<WishListPage>
    with TickerProviderStateMixin {
  final List<Tab> _tabs = [
    const Tab(text: 'Current'),
    const Tab(text: 'Character'),
    const Tab(text: 'Weapon'),
    const Tab(text: 'Chronicled'),
    const Tab(text: 'Standard'),
  ];

  TabController? _tabController;

  final List<Widget> _children = [
    const CurrentWishListPageContent(),
    const WishListPageContent(wishType: 'character'),
    const WishListPageContent(wishType: 'weapon'),
    const WishListPageContent(wishType: 'chronicled'),
    const WishListPageContent(wishType: 'standard'),
  ];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: _tabs.length, vsync: this);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Wish Banners Info'),
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: Theme.of(context).colorScheme.secondary,
          tabs: _tabs,
          isScrollable: true,
        ),
      ),
      drawer: const DrawerComponent(),
      body: TabBarView(
        controller: _tabController,
        children: _children,
      ),
    );
  }
}

class WishListPageContent extends StatefulWidget {
  final String wishType;

  const WishListPageContent({Key? key, required this.wishType})
      : super(key: key);

  @override
  WishListPageContentState createState() => WishListPageContentState();
}

class WishListPageContentState extends State<WishListPageContent> {
  Map<String, WeaponData>? _weaponData;
  Map<String, CharacterData>? _characterData;

  @override
  void initState() {
    super.initState();
    _getStaticData();
    tz.initializeTimeZones();
  }

  void _getStaticData() async {
    var characterData = await GridData.retrieveCharactersMapData();
    var weaponData = await GridData.retrieveWeaponsMapData();
    setState(() {
      _characterData = characterData;
      _weaponData = weaponData;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_characterData == null || _weaponData == null) {
      return Util.centerLoadingCircle("Getting Banners...");
    }

    final query = db.ref('banners').child(widget.wishType);

    return FirebaseDatabaseListView(
      query: query,
      loadingBuilder: (context) {
        return Util.centerLoadingCircle("Getting banners...");
      },
      itemBuilder: (context, snapshot) {
        var bannerRaw = snapshot.value as Map<dynamic, dynamic>;
        var banner = BannerData.fromJson(bannerRaw, snapshot.key!);

        return WishPageCard(banner, _characterData!, _weaponData!);
      },
    );
  }
}

class WishPageCard extends StatelessWidget {
  final BannerData data;

  final Map<String, CharacterData> characterInfo;
  final Map<String, WeaponData> weaponInfo;

  const WishPageCard(this.data, this.characterInfo, this.weaponInfo, {Key? key})
      : super(key: key);

  List<Widget> _getCountdown() {
    if (data.type.toLowerCase() == "standard") {
      return <Widget>[const Text('Permanent Banner')];
    }

    var list = <Widget>[];
    switch (data.status) {
      case BannerStatus.upcoming:
        list.add(CountdownTimer(
          endTime: data.start.millisecondsSinceEpoch,
          endWidget: const Text('The banner is now available!'),
          widgetBuilder: (_, CurrentRemainingTime? time) {
            if (time == null) {
              return const Text('Unknown Time');
            }

            return Text(
              '${_getRemainingTimeString(time)} to release',
            );
          },
        ));
        break;
      case BannerStatus.current:
        list.add(CountdownTimer(
          endTime: data.end.millisecondsSinceEpoch,
          endWidget: const Text('The banner is now over!'),
          widgetBuilder: (_, CurrentRemainingTime? time) {
            if (time == null) {
              return const Text('Unknown Time');
            }

            return Text(
              '${_getRemainingTimeString(time)} remaining',
            );
          },
        ));
        break;
      case BannerStatus.ended:
        list.add(const Text('The banner has ended'));
        break;
      default:
        list.add(const Text('Unknown Banner Status'));
        break;
    }

    return list;
  }

  String _getRemainingTimeString(CurrentRemainingTime time) {
    String craft = '';
    if (time.days != null && time.days! > 0) {
      craft += '${time.days} days, ';
    }
    if (time.hours != null && time.hours! > 0) {
      craft += '${time.hours} hours, ';
    }
    if (time.min != null && time.min! > 0) {
      craft += '${time.min} mins, ';
    }
    if (time.sec != null) {
      craft += '${time.sec! > 0 ? time.sec : 0} secs';
    }

    return craft;
  }

  List<Widget> _getRateUps() {
    List<Widget> finalWidgets = [];

    if (data.rateUpCharacters.isNotEmpty || data.rateUpWeapons.isNotEmpty) {
      finalWidgets.add(const Padding(padding: EdgeInsets.only(top: 10)));
      finalWidgets.add(const Text(
        "Rate Up",
        style: TextStyle(fontSize: 18),
      ));
    }

    List<Widget> rowChild = [];
    if (data.rateUpCharacters.isNotEmpty) {
      for (var character in data.rateUpCharacters) {
        rowChild.add(_getRateUpStack(characterInfo[character]?.image));
      }
    }

    if (data.rateUpWeapons.isNotEmpty) {
      for (var weapon in data.rateUpWeapons) {
        rowChild.add(_getRateUpStack(weaponInfo[weapon]?.image));
      }
    }

    finalWidgets.add(Wrap(
      direction: Axis.horizontal,
      crossAxisAlignment: WrapCrossAlignment.start,
      alignment: WrapAlignment.start,
      children: rowChild,
    ));

    if (kDebugMode) {
      finalWidgets.add(Text('Debug Index: ${data.type}/${data.key}'));
    }

    return finalWidgets;
  }

  Widget _getRateUpStack(String? imageUrl) {
    return SizedBox(
      height: 48,
      width: 48,
      child: Stack(
        alignment: Alignment.bottomRight,
        children: [
          GridData.getImageAssetFromFirebase(
            imageUrl,
            height: 32,
          ),
          Icon(
            MdiIcons.arrowUpBold,
            color: Colors.green,
            size: 20,
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    Color color = Colors.red;
    if (data.status == BannerStatus.upcoming) {
      color = Colors.grey;
    } else if (data.status == BannerStatus.current) {
      color = Colors.green;
    }

    var df = Util.defaultDateFormat;

    return Card(
      clipBehavior: Clip.antiAlias,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      child: InkWell(
        onTap: () => Get.toNamed('/bannerinfo/${data.type}/${data.key}'),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.start,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Stack(
              children: [
                GridData.getImageAssetFromFirebase(data.image),
                Align(
                  alignment: FractionalOffset.topRight,
                  child: Container(
                    margin: const EdgeInsets.all(16),
                    padding: const EdgeInsets.all(4),
                    color: color.withOpacity(0.75),
                    child: Text(data.status.name.capitalized()),
                  ),
                ),
              ],
            ),
            Padding(
              padding: const EdgeInsets.all(8),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.start,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    data.name,
                    style: const TextStyle(fontSize: 18),
                  ),
                  Text(
                    '${df.format(data.start.toLocal())} - ${df.format(data.end.toLocal())}',
                  ),
                  ..._getCountdown(),
                  ..._getRateUps(),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class CurrentWishListPageContent extends StatefulWidget {
  const CurrentWishListPageContent({Key? key}) : super(key: key);

  @override
  CurrentWishListPageContentState createState() =>
      CurrentWishListPageContentState();
}

class CurrentWishListPageContentState
    extends State<CurrentWishListPageContent> {
  Map<String, WeaponData>? _weaponData;
  Map<String, CharacterData>? _characterData;

  @override
  void initState() {
    super.initState();
    _getStaticData();
    tz.initializeTimeZones();
  }

  void _getStaticData() async {
    var characterData = await GridData.retrieveCharactersMapData();
    var weaponData = await GridData.retrieveWeaponsMapData();
    setState(() {
      _characterData = characterData;
      _weaponData = weaponData;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_characterData == null || _weaponData == null) {
      return Util.centerLoadingCircle("Getting Banners...");
    }
    final query = db.ref('banners');

    return FirebaseDatabaseQueryBuilder(
      query: query,
      builder: (context, snapshot, _) {
        if (snapshot.isFetching) {
          return Util.centerLoadingCircle('Getting current banners...');
        } else if (snapshot.hasError) {
          return Text('Error getting banners ${snapshot.error}');
        }

        var data = <BannerData>[];
        for (var element in snapshot.docs) {
          data.addAll((element.value as List<dynamic>)
              .asMap()
              .map((i, e) => MapEntry(i, BannerData.fromJson(e, i.toString())))
              .values
              .where((v) => v.status == BannerStatus.current)
              .toList());
        }

        // Sort permanent banner to the back
        data.sort((a, b) {
          if (a.type.toLowerCase() == "standard" &&
              b.type.toLowerCase() != "standard") {
            return 1;
          }

          return 0;
        });

        if (data.isEmpty) {
          return const Center(
            child: Text(
              'No banners currently active',
              style: TextStyle(fontSize: 24),
            ),
          );
        }

        return ListView.builder(
          itemCount: data.length,
          itemBuilder: (context, i) {
            var banner = data[i];

            return WishPageCard(banner, _characterData!, _weaponData!);
          },
        );
      },
    );
  }
}

class BannerInfoPage extends StatefulWidget {
  const BannerInfoPage({Key? key}) : super(key: key);

  @override
  BannerInfoPageState createState() => BannerInfoPageState();
}

class BannerInfoPageState extends State<BannerInfoPage> {
  String? _type, _index;

  BannerData? _bannerInfo;

  @override
  void initState() {
    super.initState();
    _type = Get.parameters["type"];
    _index = Get.parameters["index"];
    _getStaticData();
  }

  Widget _get4PityWidget() {
    return const IntrinsicHeight(
      child: Row(
        children: [
          Padding(
            padding: EdgeInsets.fromLTRB(12, 8, 12, 8),
            child: Row(
              children: [
                Text(
                  '4* RATES',
                  style: TextStyle(fontWeight: FontWeight.bold),
                ),
                Padding(
                  padding: EdgeInsets.only(left: 8),
                  child: Text("- 0.6% for 0-9 rolls\n- 100% at roll 10"),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _get5PityWidget() {
    return IntrinsicHeight(
      child: Row(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
            child: Row(
              children: [
                const Text(
                  '5* RATES',
                  style: TextStyle(fontWeight: FontWeight.bold),
                ),
                Padding(
                  padding: const EdgeInsets.only(left: 8),
                  child: Text(
                    "- 0.6% for 0-${_bannerInfo!.softPity - 1} rolls\n- Rates increased from roll ${_bannerInfo!.softPity} (Soft Pity)\n- 100% at roll ${_bannerInfo!.hardPity} (Hard Pity)",
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  List<Widget> _generateLists() {
    var finalWidgets = <Widget>[];

    finalWidgets.add(const Padding(padding: EdgeInsets.only(top: 10)));
    var isPortrait = MediaQuery.of(context).orientation == Orientation.portrait;

    if (_bannerInfo!.rateUpCharacters.isNotEmpty) {
      finalWidgets.addAll(GridData.generateCoWGridWidgets(
        'Rate Up Characters',
        _bannerInfo!.rateUpCharacters,
        'characters',
        _bannerInfo?.name,
        isPortrait,
      ));
    }

    if (_bannerInfo!.rateUpWeapons.isNotEmpty) {
      finalWidgets.addAll(GridData.generateCoWGridWidgets(
        'Rate Up Weapons',
        _bannerInfo!.rateUpWeapons,
        'weapons',
        _bannerInfo?.name,
        isPortrait,
      ));
    }

    if (_bannerInfo!.characters.isNotEmpty) {
      finalWidgets.addAll(GridData.generateCoWGridWidgets(
        'Characters',
        _bannerInfo!.characters,
        'characters',
        _bannerInfo?.name,
        isPortrait,
      ));
    }

    if (_bannerInfo!.weapons.isNotEmpty) {
      finalWidgets.addAll(GridData.generateCoWGridWidgets(
        'Weapons',
        _bannerInfo!.weapons,
        'weapons',
        _bannerInfo?.name,
        isPortrait,
      ));
    }

    finalWidgets.removeLast(); // Remove padding at the end

    return finalWidgets;
  }

  Widget _unknownBanner() {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Unknown Banner'),
      ),
      body: const Center(child: Text('Cannot find banner information')),
    );
  }

  List<Widget> _getCountdown() {
    if (_bannerInfo!.type.toLowerCase() == "standard") {
      return GridData.generateInfoLine(
        'Permanent Banner',
        Icons.hourglass_bottom,
      );
    }

    var list = <Widget>[];
    switch (_bannerInfo!.status) {
      case BannerStatus.upcoming:
        list.add(CountdownTimer(
          endTime: _bannerInfo!.start.millisecondsSinceEpoch,
          endWidget: const Text('The banner is now available!'),
          widgetBuilder: (_, CurrentRemainingTime? time) {
            if (time == null) {
              return const Text('Unknown Time');
            }

            return _getTimeStringWidget(
              '${_getRemainingTimeString(time)} to release',
            );
          },
        ));
        list.add(const Divider());
        break;
      case BannerStatus.current:
        list.add(CountdownTimer(
          endTime: _bannerInfo!.end.millisecondsSinceEpoch,
          endWidget: const Text('The banner is now over!'),
          widgetBuilder: (_, CurrentRemainingTime? time) {
            if (time == null) {
              return const Text('Unknown Time');
            }

            return _getTimeStringWidget(
              '${_getRemainingTimeString(time)} remaining',
            );
          },
        ));
        list.add(const Divider());
        break;
      case BannerStatus.ended:
        list.addAll(GridData.generateInfoLine(
          'The banner has ended',
          Icons.hourglass_bottom,
        ));
        break;
      default:
        list.addAll(GridData.generateInfoLine(
          'Unknown Banner Status',
          Icons.hourglass_bottom,
        ));
        break;
    }

    return list;
  }

  Widget _getTimeStringWidget(String text) {
    return Padding(
      padding: const EdgeInsets.all(8),
      child: Row(
        children: [
          const Icon(Icons.hourglass_bottom),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(left: 8, right: 8),
              child: Text(text),
            ),
          ),
        ],
      ),
    );
  }

  String _getRemainingTimeString(CurrentRemainingTime time) {
    String craft = '';
    if (time.days != null && time.days! > 0) {
      craft += '${time.days} days, ';
    }
    if (time.hours != null && time.hours! > 0) {
      craft += '${time.hours} hours, ';
    }
    if (time.min != null && time.min! > 0) {
      craft += '${time.min} mins, ';
    }
    if (time.sec != null) {
      craft += '${time.sec! > 0 ? time.sec : 0} secs';
    }

    return craft;
  }

  void _getStaticData() async {
    final bannerQuery = db.ref('banners').child(_type!).child(_index!);
    BannerData? ban;
    var evt = await bannerQuery.once();
    if (evt.snapshot.exists) {
      var tmp = evt.snapshot.value as Map<dynamic, dynamic>;
      ban = BannerData.fromJson(tmp, evt.snapshot.key!);
    }

    setState(() {
      _bannerInfo = ban;
    });
  }

  List<Widget> _checkIfChronicled() {
    if (_type?.toLowerCase() == "chronicled") {
      return GridData.generateInfoLine(
        'This is a unique banner that changes based on your chartered type, your rate up is ONLY for the selected type (so if you chart a character, you will only have rate up characters in the banner. The rate up weapons will not be available).',
        Icons.warning,
      );
    }

    return [];
  }

  @override
  Widget build(BuildContext context) {
    if (_type == null || _index == null) {
      return _unknownBanner();
    }

    if (_bannerInfo == null) {
      return Util.loadingScreen();
    }

    var df = Util.defaultDateFormat;

    return Scaffold(
      appBar: AppBar(
        title: Text(_bannerInfo!.name),
      ),
      body: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            GridData.getImageAssetFromFirebase(_bannerInfo!.image),
            ..._checkIfChronicled(),
            ...GridData.generateInfoLine(
              '${df.format(_bannerInfo!.start.toLocal())} - ${df.format(_bannerInfo!.end.toLocal())}',
              Icons.timer,
            ),
            ..._getCountdown(),
            ...GridData.generateInfoLine(
              _bannerInfo!.description,
              Icons.format_list_bulleted,
            ),
            _get5PityWidget(),
            const Divider(),
            _get4PityWidget(),
            const Divider(),
            ..._generateLists(),
          ],
        ),
      ),
    );
  }
}
