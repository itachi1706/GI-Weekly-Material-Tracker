import 'dart:io';

import 'package:appcheck/appcheck.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:get/get.dart';
import 'package:gi_weekly_material_tracker/helpers/notifications.dart';
import 'package:gi_weekly_material_tracker/util.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import 'package:shared_preferences/shared_preferences.dart';

final FirebaseAuth _auth = FirebaseAuth.instance;

class DrawerComponent extends StatefulWidget {
  const DrawerComponent({super.key});

  @override
  DrawerComponentState createState() => DrawerComponentState();
}

class DrawerComponentState extends State<DrawerComponent> {
  final appChecker = AppCheck();

  @override
  void initState() {
    super.initState();
    _initDrawerWidgets();
  }

  var drawerWidgets = <DrawerModel>[];

  void _launchHoyoLabs() async {
    if (!kIsWeb && Platform.isAndroid) {
      var androidId = 'com.mihoyo.hoyolab';
      if (Platform.isAndroid) {
        var isInstalled = await appChecker.isAppInstalled(androidId);
        debugPrint('App Installed: $isInstalled');
        if (isInstalled) {
          await appChecker.launchApp(androidId);

          return;
        }
      }
    }
    var pref = await SharedPreferences.getInstance();

    // Launch the website otherwise
    await Util.launchWebPage(
      'https://www.hoyolab.com/genshin/',
      useDeepLink: pref.getBool('deeplinkEnabled') ?? false,
      deepLink:
          'hoyolab://openURL?url=https%3A%2F%2Fwww.hoyolab.com%2Fhome%3Futm_source%3DMweb%26utm_medium%3DOpenAppGuideModule%26utm_id%3D%26utm_campaign%3D&campaign=HoYoLAB-Web-InterestSelectPage&creative=icon',
    );
  }

  void _launchBattleChronicle() async => await Util.launchWebPage(
        'https://act.hoyolab.com/app/community-game-records-sea/index.html#/ys',
      );

  void _launchMap() async {
    var pref = await SharedPreferences.getInstance();
    await Util.launchWebPage(
      'https://webstatic-sea.mihoyo.com/app/ys-map-sea/index.html',
      webView: true,
      hideTopBars: GetPlatform.isAndroid,
      useDeepLink: pref.getBool('deeplinkEnabled') ?? false,
      deepLink:
          'hoyolab://webview?link=https%3A%2F%2Fact.hoyolab.com%2Fys%2Fapp%2Finteractive-map%2Findex.html%3Flang%3Den-us%23%2Fmap%2F2%3Fshown_types%3D410%2C521%26center%3D-86.00%2C-3052.00%26zoom%3D-3.00&campaign=Map&creative=icon',
    );
  }

  List<Widget> _addWebComponent() {
    return (kIsWeb)
        ? [
            const Divider(),
            _drawerItem(
              iconData: MdiIcons.refresh,
              title: 'Reload Page',
            ),
          ]
        : [];
  }

  List<DrawerModel> _addWebComponentDest() {
    return (kIsWeb)
        ? [
            DrawerModel(
              iconData: MdiIcons.refresh,
              title: 'Reload Page',
              route: '/splash',
            ),
          ]
        : [];
  }

  void _dailyLogin() async {
    var resp = const NotificationResponse(
      notificationResponseType: NotificationResponseType.selectedNotification,
      payload: 'forum-login',
    );
    await NotificationManager.getInstance()!.selectNotification(resp);
  }

  void _signOut() async {
    await _auth.signOut();
    await Get.offAllNamed('/'); // Go to login screem
  }

  Widget _drawerItem({
    IconData? iconData,
    String? iconAsset,
    String? title,
  }) {
    Widget icon = Icon(iconData);
    if (iconAsset != null) {
      icon = ImageIcon(AssetImage(iconAsset));
    }
    return NavigationDrawerDestination(icon: icon, label: Text(title!));
  }

  Widget _drawerHeader(BuildContext context) {
    var email = Util.getUserEmail()!;
    var name = Util.getUserName() ?? '';
    var photo = Util.getUserPhotoUrl();
    var photoMode = photo != null;

    return DrawerHeader(
      // margin: EdgeInsets.zero,
      // padding: EdgeInsets.zero,
      child: Stack(children: <Widget>[
        Positioned(
          bottom: 32.0,
          left: 16.0,
          child: Text(
            name,
            style: const TextStyle(
              // color: Colors.black,
              fontSize: 20.0,
              fontWeight: FontWeight.w500,
            ),
          ),
        ),
        Positioned(
          bottom: 12.0,
          left: 16.0,
          child: Text(
            email,
            style: const TextStyle(
              // color: Colors.black,
              fontSize: 14.0,
            ),
          ),
        ),
        Positioned(
          bottom: 64.0,
          left: 16.0,
          child: _getUserPhoto(photo, photoMode),
        ),
      ]),
    );
  }

  Widget _getUserPhoto(String? photo, bool isPhotoMode) {
    if (!isPhotoMode) {
      return const SizedBox.shrink();
    }

    return CircleAvatar(
      backgroundImage: CachedNetworkImageProvider(photo!),
    );
  }

  void _onDestinationSelected(int index) {
    debugPrint("Index: $index");

    var widget = drawerWidgets[index];
    if (widget.route != null) {
      var route = widget.route!;
      if (!widget.offPrev) {
        Get.toNamed(route);
      } else {
        Navigator.pop(Get.context!);
        setState(() {
          Util.currentDrawerIndex = index;
        });
        Future.delayed(
          const Duration(milliseconds: 10),
          () => Get.offAndToNamed(route),
        );
      }
    } else if (widget.onTap != null) {
      widget.onTap!();
    }
  }

  void _initDrawerWidgets() {
    drawerWidgets = <DrawerModel>[
      DrawerModel(
        iconData: Icons.home,
        title: 'Tracking',
        route: '/tracking',
      ),
      DrawerModel(
        iconData: Icons.menu_book_outlined,
        title: 'Dictionary',
        route: '/dictionary',
      ),
      DrawerModel(
        iconData: MdiIcons.compass,
        title: 'Parametric Transformer',
        route: '/parametric',
      ),
      DrawerModel(
        iconData: MdiIcons.ticket,
        title: 'Promo Codes',
        route: '/promos',
      ),
      DrawerModel(
        iconAsset: 'assets/images/items/Item_Primogem.png',
        title: 'Wish Banners',
        route: '/bannerinfo',
      ),
      DrawerModel(
        iconData: MdiIcons.tshirtCrew,
        title: 'View All Outfits',
        route: '/outfits',
        offPrev: false,
      ),
      DrawerModel(
        iconData: MdiIcons.alarm,
        title: 'Daily Forum Login',
        onTap: _dailyLogin,
        offPrev: false,
      ),
      DrawerModel(
        iconData: Icons.forum,
        title: 'HoYoLabs Forum',
        onTap: _launchHoyoLabs,
        offPrev: false,
      ),
      DrawerModel(
        iconData: MdiIcons.swordCross,
        title: 'Battle Chronicles',
        onTap: _launchBattleChronicle,
        offPrev: false,
      ),
      DrawerModel(
        iconData: Icons.map,
        title: 'Game Map',
        onTap: _launchMap,
        offPrev: false,
      ),
      ..._addWebComponentDest(),
      DrawerModel(
        iconData: Icons.settings,
        title: 'Settings',
        route: '/settings',
        offPrev: false,
      ),
      DrawerModel(
        iconData: Icons.logout,
        title: 'Logout',
        onTap: _signOut,
      ),
    ];
  }

  @override
  Widget build(BuildContext context) {
    return NavigationDrawer(
      onDestinationSelected: _onDestinationSelected,
      selectedIndex: Util.currentDrawerIndex,
      children: <Widget>[
        _drawerHeader(context),
        _drawerItem(iconData: Icons.home, title: 'Tracking'),
        _drawerItem(iconData: Icons.menu_book_outlined, title: 'Dictionary'),
        _drawerItem(
            iconData: MdiIcons.compass, title: 'Parametric Transformer'),
        _drawerItem(iconData: MdiIcons.ticket, title: 'Promo Codes'),
        _drawerItem(
            iconAsset: 'assets/images/items/Item_Primogem.png',
            title: 'Wish Banners'),
        _drawerItem(iconData: MdiIcons.tshirtCrew, title: 'View All Outfits'),
        const Divider(),
        _drawerItem(iconData: MdiIcons.alarm, title: 'Daily Forum Login'),
        _drawerItem(iconData: Icons.forum, title: 'HoYoLabs Forum'),
        _drawerItem(iconData: MdiIcons.swordCross, title: 'Battle Chronicles'),
        _drawerItem(iconData: Icons.map, title: 'Game Map'),
        ..._addWebComponent(),
        const Divider(),
        _drawerItem(iconData: Icons.settings, title: 'Settings'),
        _drawerItem(iconData: Icons.logout, title: 'Logout'),
      ],
    );
  }
}

class DrawerModel {
  IconData? iconData;
  String? iconAsset;
  String? title;
  GestureTapCallback? onTap;
  String? route;
  bool offPrev;

  DrawerModel(
      {this.iconData,
      this.iconAsset,
      this.onTap,
      this.route,
      this.title,
      this.offPrev = true});
}
