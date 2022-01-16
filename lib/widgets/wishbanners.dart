import 'package:firebase_database/firebase_database.dart';
import 'package:flutter/material.dart';
import 'package:flutterfire_ui/database.dart';
import 'package:gi_weekly_material_tracker/helpers/grid.dart';
import 'package:gi_weekly_material_tracker/models/bannerdata.dart';
import 'package:gi_weekly_material_tracker/models/characterdata.dart';
import 'package:gi_weekly_material_tracker/models/weapondata.dart';
import 'package:gi_weekly_material_tracker/placeholder.dart';
import 'package:gi_weekly_material_tracker/util.dart';
import 'package:gi_weekly_material_tracker/widgets/drawer.dart';
import 'package:timezone/data/latest.dart' as tz;
import 'package:timezone/timezone.dart' as tz;

final FirebaseDatabase db = FirebaseDatabase.instance;

class WishListPage extends StatefulWidget {
  const WishListPage({Key? key}) : super(key: key);

  @override
  _WishListPageState createState() => _WishListPageState();
}

class _WishListPageState extends State<WishListPage>
    with TickerProviderStateMixin {
  final List<Tab> _tabs = [
    const Tab(text: 'Character'),
    const Tab(text: 'Weapon'),
    const Tab(text: 'Standard'),
  ];

  TabController? _tabController;

  final List<Widget> _children = [
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
  final Color? color; // TODO: To remove when placeholder completes

  const WishListPageContent({Key? key, required this.wishType, this.color})
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
    // TODO: To remove when placeholder completes
    if (widget.color != null) {
      return PlaceholderWidgetContainer(widget.color!);
    }

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
    var start = DateTime.parse(data.start);
    var end = DateTime.parse(data.end);
    var curDt = tz.TZDateTime.now(tz.getLocation('Asia/Singapore')).toUtc();

    // TODO: Check if expired
    // TODO: Check if upcoming


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
                GridData.getImageAssetFromFirebase(data.image),
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
                      Text('${start.toLocal().toString()} - ${end.toLocal().toString()}'),
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
        rowChild.add(GridData.getImageAssetFromFirebase(
          characterInfo[character]?.image,
          height: 32,
        ));
      }
    }

    if (data.rateUpWeapons.isNotEmpty) {
      for (var weapon in data.rateUpWeapons) {
        rowChild.add(GridData.getImageAssetFromFirebase(
          weaponInfo[weapon]?.image,
          height: 32,
        ));
      }
    }

    finalWidgets.add(Row(
      children: rowChild,
    ));

    return finalWidgets;
  }
}
