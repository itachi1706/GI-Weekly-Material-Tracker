import 'package:firebase_database/firebase_database.dart';
import 'package:flutter/material.dart';
import 'package:flutter_countdown_timer/current_remaining_time.dart';
import 'package:flutter_countdown_timer/flutter_countdown_timer.dart';
import 'package:flutterfire_ui/database.dart';
import 'package:gi_weekly_material_tracker/extensions/string_extensions.dart';
import 'package:gi_weekly_material_tracker/helpers/grid.dart';
import 'package:gi_weekly_material_tracker/models/bannerdata.dart';
import 'package:gi_weekly_material_tracker/models/characterdata.dart';
import 'package:gi_weekly_material_tracker/models/weapondata.dart';
import 'package:gi_weekly_material_tracker/placeholder.dart';
import 'package:gi_weekly_material_tracker/util.dart';
import 'package:gi_weekly_material_tracker/widgets/drawer.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import 'package:timezone/data/latest.dart' as tz;

final FirebaseDatabase db = FirebaseDatabase.instance;

class WishListPage extends StatefulWidget {
  const WishListPage({Key? key}) : super(key: key);

  @override
  _WishListPageState createState() => _WishListPageState();
}

class _WishListPageState extends State<WishListPage>
    with TickerProviderStateMixin {
  final List<Tab> _tabs = [
    const Tab(text: 'Current'),
    const Tab(text: 'Character'),
    const Tab(text: 'Weapon'),
    const Tab(text: 'Standard'),
  ];

  TabController? _tabController;

  final List<Widget> _children = [
    const CurrentWishListPageContent(),
    const WishListPageContent(wishType: 'character'),
    const WishListPageContent(wishType: 'weapon'),
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
          isScrollable: false,
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
  _WishListPageContentState createState() => _WishListPageContentState();
}

class _WishListPageContentState extends State<WishListPageContent> {
  Map<String, WeaponData>? _weaponData;
  Map<String, CharacterData>? _characterData;

  @override
  void initState() {
    super.initState();
    _getStaticData();
    tz.initializeTimeZones();
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
        var banner = BannerData.fromJson(bannerRaw);

        return WishPageCard(banner, _characterData!, _weaponData!);
      },
    );
  }

  void _getStaticData() async {
    var characterData = await GridData.retrieveCharactersMapData();
    var weaponData = await GridData.retrieveWeaponsMapData();
    setState(() {
      _characterData = characterData;
      _weaponData = weaponData;
    });
  }
}

class WishPageCard extends StatelessWidget {
  final BannerData data;

  final Map<String, CharacterData> characterInfo;
  final Map<String, WeaponData> weaponInfo;

  const WishPageCard(this.data, this.characterInfo, this.weaponInfo, {Key? key})
      : super(key: key);

  @override
  Widget build(BuildContext context) {
    Color color = Colors.red;
    if (data.status == BannerStatus.upcoming) {
      color = Colors.grey;
    } else if (data.status == BannerStatus.current) {
      color = Colors.green;
    }

    return Card(
      clipBehavior: Clip.antiAlias,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      child: InkWell(
        onTap: () => PlaceholderUtil.showUnimplementedSnackbar(context),
        child: Column(
          children: <Widget>[
            Column(
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
                        '${data.start.toLocal().toString()} - ${data.end.toLocal().toString()}',
                      ),
                      ..._getCountdown(),
                      ..._getRateUps(),
                    ],
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  List<Widget> _getCountdown() {
    if (data.type.toLowerCase() == "standard") {
      return <Widget>[const Text('Permenant Banner')];
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

    finalWidgets.add(Row(
      children: rowChild,
    ));

    return finalWidgets;
  }

  Widget _getRateUpStack(String? imageUrl) {
    return Stack(
      alignment: Alignment.bottomRight,
      children: [
        GridData.getImageAssetFromFirebase(
          imageUrl,
          height: 32,
        ),
        const Icon(
          MdiIcons.arrowUpBold,
          color: Colors.green,
          size: 20,
        ),
      ],
    );
  }
}

class CurrentWishListPageContent extends StatefulWidget {
  const CurrentWishListPageContent({Key? key}) : super(key: key);

  @override
  _CurrentWishListPageContentState createState() =>
      _CurrentWishListPageContentState();
}

class _CurrentWishListPageContentState
    extends State<CurrentWishListPageContent> {
  Map<String, WeaponData>? _weaponData;
  Map<String, CharacterData>? _characterData;

  @override
  void initState() {
    super.initState();
    _getStaticData();
    tz.initializeTimeZones();
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
              .map((e) => BannerData.fromJson(e))
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

  void _getStaticData() async {
    var characterData = await GridData.retrieveCharactersMapData();
    var weaponData = await GridData.retrieveWeaponsMapData();
    setState(() {
      _characterData = characterData;
      _weaponData = weaponData;
    });
  }
}
