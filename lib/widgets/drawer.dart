import 'dart:io';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:device_apps/device_apps.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:get/get.dart';
import 'package:gi_weekly_material_tracker/helpers/notifications.dart';
import 'package:gi_weekly_material_tracker/util.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

final FirebaseAuth _auth = FirebaseAuth.instance;

class DrawerComponent extends StatefulWidget {
  const DrawerComponent({Key? key}) : super(key: key);

  @override
  DrawerComponentState createState() => DrawerComponentState();
}

class DrawerComponentState extends State<DrawerComponent> {
  @override
  void initState() {
    super.initState();
    Util.currentRoute ??= '/tracking';
  }

  void _launchHoyoLabs() async {
    if (!kIsWeb && Platform.isAndroid) {
      var androidId = 'com.mihoyo.hoyolab';
      if (Platform.isAndroid) {
        // Returns a list of only those apps that have launch intent
        var apps = await DeviceApps.getInstalledApplications(
          onlyAppsWithLaunchIntent: true,
        );
        debugPrint(apps.toString());
        var isInstalled = await DeviceApps.isAppInstalled(androidId);
        debugPrint('App Installed: $isInstalled');
        if (isInstalled) {
          await DeviceApps.openApp(androidId);

          return;
        }
      }
    }

    // Launch the website otherwise
    await Util.launchWebPage('https://www.hoyolab.com/genshin/');
  }

  void _launchBattleChronicle() async => await Util.launchWebPage(
        'https://act.hoyolab.com/app/community-game-records-sea/index.html#/ys',
      );

  void _launchMap() async => await Util.launchWebPage(
        'https://webstatic-sea.mihoyo.com/app/ys-map-sea/index.html',
        webView: true,
        hideTopBars: GetPlatform.isAndroid,
      );

  List<Widget> _addWebComponent() {
    return (kIsWeb)
        ? [
            const Divider(),
            _drawerItem(
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
    GestureTapCallback? onTap,
    String? route,
    bool offPrev = true,
  }) {
    Widget icon = Icon(iconData);
    if (iconAsset != null) {
      icon = ImageIcon(AssetImage(iconAsset));
    }
    if (route != null) {
      return ListTile(
        title: Row(
          children: [
            icon,
            Padding(
              padding: const EdgeInsets.only(left: 8),
              child: Text(title!),
            ),
          ],
        ),
        selected: Util.currentRoute == route,
        onTap: () {
          if (!offPrev) {
            Get.toNamed(route);
          } else {
            Navigator.pop(Get.context!);
            setState(() {
              Util.currentRoute = route;
            });
            Future.delayed(
              const Duration(milliseconds: 10),
              () => Get.offAndToNamed(route),
            );
          }
        },
      );
    }

    return ListTile(
      title: Row(
        children: [
          icon,
          Padding(
            padding: const EdgeInsets.only(left: 8),
            child: Text(title!),
          ),
        ],
      ),
      onTap: onTap,
    );
  }

  Widget _drawerHeader(BuildContext context) {
    var email = Util.getUserEmail()!;
    var name = Util.getUserName() ?? '';
    var photo = Util.getUserPhotoUrl();
    var photoMode = photo != null;

    return DrawerHeader(
      margin: EdgeInsets.zero,
      padding: EdgeInsets.zero,
      decoration: BoxDecoration(
        color: Theme.of(context).primaryColor,
      ),
      child: Stack(children: <Widget>[
        Positioned(
          bottom: 32.0,
          left: 16.0,
          child: Text(
            name,
            style: const TextStyle(
              color: Colors.white,
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
              color: Colors.white,
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

  @override
  Widget build(BuildContext context) {
    return Drawer(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _drawerHeader(context),
          Expanded(
            child: ListView(
              padding: EdgeInsets.zero,
              children: [
                _drawerItem(
                  iconData: Icons.home,
                  title: 'Tracking',
                  route: '/tracking',
                ),
                _drawerItem(
                  iconData: Icons.menu_book_outlined,
                  title: 'Dictionary',
                  route: '/dictionary',
                ),
                _drawerItem(
                  iconData: MdiIcons.compass,
                  title: 'Parametric Transformer',
                  route: '/parametric',
                ),
                _drawerItem(
                  iconData: MdiIcons.ticket,
                  title: 'Promo Codes',
                  route: '/promos',
                ),
                _drawerItem(
                  iconAsset: 'assets/images/items/Item_Primogem.png',
                  title: 'Wish Banners',
                  route: '/bannerinfo',
                ),
                _drawerItem(
                  iconData: MdiIcons.tshirtCrew,
                  title: 'View All Outfits',
                  route: '/outfits',
                  offPrev: false,
                ),
                const Divider(),
                _drawerItem(
                  iconData: MdiIcons.alarm,
                  title: 'Daily Forum Login',
                  onTap: _dailyLogin,
                  offPrev: false,
                ),
                _drawerItem(
                  iconData: Icons.forum,
                  title: 'HoYoLabs Forum',
                  onTap: _launchHoyoLabs,
                  offPrev: false,
                ),
                _drawerItem(
                  iconData: MdiIcons.swordCross,
                  title: 'Battle Chronicles',
                  onTap: _launchBattleChronicle,
                  offPrev: false,
                ),
                _drawerItem(
                  iconData: Icons.map,
                  title: 'Game Map',
                  onTap: _launchMap,
                  offPrev: false,
                ),
                ..._addWebComponent(),
                const Divider(),
                _drawerItem(
                  iconData: Icons.settings,
                  title: 'Settings',
                  route: '/settings',
                  offPrev: false,
                ),
                _drawerItem(
                  iconData: Icons.logout,
                  title: 'Logout',
                  onTap: _signOut,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
