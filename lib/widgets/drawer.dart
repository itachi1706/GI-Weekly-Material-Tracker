import 'package:cached_network_image/cached_network_image.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:gi_weekly_material_tracker/util.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

final FirebaseAuth _auth = FirebaseAuth.instance;

class DrawerComponent extends StatefulWidget {
  @override
  _DrawerComponentState createState() => _DrawerComponentState();
}

class _DrawerComponentState extends State<DrawerComponent> {

  @override
  void initState() {
    Util.currentRoute ??= '/menu';
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
                _drawerItem(icon: Icons.home, title: 'Legacy (Deprecated)', route: '/menu'), // TODO: Remove when done
                _drawerItem(icon: Icons.home, title: 'Tracking', route: '/tracking'), // TODO: Only tracking
                // _drawerItem(icon: MdiIcons.fileDocument, title: 'Consolidated Tracking', route: '/globalTracking', offPrev: false),
                _drawerItem(icon: Icons.menu_book_outlined, title: 'Dictionary', route: '/dictionary'), // TODO: Only dictionary
                _drawerItem(icon: MdiIcons.compass, title: 'Parametric Transformer', route: '/parametric'),
                _drawerItem(icon: MdiIcons.ticket, title: 'Promo Codes', route: '/promos'),
                Divider(),
                _drawerItem(icon: Icons.settings, title: 'Settings', route: '/settings', offPrev: false),
                _drawerItem(icon: Icons.logout, title: 'Logout', onTap: _signOut),
              ],
            ),
          ),
        ],
      ),
    );
  }

  void _signOut() async {
    await _auth.signOut();
    await Get.offAllNamed('/'); // Go to login screem
  }

  Widget _drawerItem({IconData icon, String title, GestureTapCallback onTap, String route, bool offPrev = true}) {
    if (route != null) {
      return ListTile(
        title: Row(
          children: [
            Icon(icon),
            Padding(
              padding: const EdgeInsets.only(left: 8),
              child: Text(title),
            ),
          ],
        ),
        selected: Util.currentRoute == route,
        onTap: () {
          if (!offPrev) {
            Get.toNamed(route);
          } else {
            Navigator.pop(Get.context);
            setState(() {
              Util.currentRoute = route;
            });
            Future.delayed(Duration(milliseconds: 10), () => Get.offAndToNamed(route));
          }
        },
      );
    }

    return ListTile(
      title: Row(
        children: [
          Icon(icon),
          Padding(
            padding: const EdgeInsets.only(left: 8),
            child: Text(title),
          ),
        ],
      ),
      onTap: onTap,
    );
  }

  Widget _drawerHeader(BuildContext context) {
    var email = Util.getUserEmail();
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
            style: TextStyle(
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
            style: TextStyle(
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

  Widget _getUserPhoto(String photo, bool isPhotoMode) {
    if (!isPhotoMode) {
      return SizedBox.shrink();
    }

    return CircleAvatar(
      backgroundImage: CachedNetworkImageProvider(photo),
    );
  }
}
