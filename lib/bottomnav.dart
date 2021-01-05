import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:gi_weekly_material_tracker/characters.dart';
import 'package:gi_weekly_material_tracker/materials.dart';
import 'package:gi_weekly_material_tracker/placeholder.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

final FirebaseAuth _auth = FirebaseAuth.instance;

class MainNavigationPage extends StatefulWidget {
  MainNavigationPage({Key key, this.title}) : super(key: key);

  final String title;

  @override
  _MainNavigationPageState createState() => _MainNavigationPageState();
}

class _MainNavigationPageState extends State<MainNavigationPage> {
  int _currentIndex = 0;
  final List<Widget> _children = [
    PlaceholderWidgetContainer(Colors.red),
    CharacterListGrid(),
    PlaceholderWidgetContainer(Colors.indigo),
    MaterialListGrid(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
        appBar: AppBar(
          title: Text(widget.title),
          actions: [
            IconButton(
              icon: Icon(Icons.refresh),
              onPressed: () =>
                  PlaceholderUtil.showUnimplementedSnackbar(context),
            ),
            PopupMenuButton(
              onSelected: _overflowMenuSelection,
              elevation: 2.0,
              itemBuilder: (context) => [
                PopupMenuItem(
                  value: "exit",
                  child: Text('Logout'),
                ),
                PopupMenuItem(
                  value: "settings",
                  child: Text('Settings'),
                )
              ],
            )
          ],
        ),
        body: _children[_currentIndex],
        bottomNavigationBar: BottomNavigationBar(
          selectedItemColor: Colors.green,
          unselectedItemColor: Colors.grey,
          currentIndex: _currentIndex,
          onTap: _onTabTapped,
          items: [
            BottomNavigationBarItem(
              icon: Icon(Icons.home),
              label: 'Tracker',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.account_circle),
              label: 'Characters',
            ),
            BottomNavigationBarItem(
              icon: Icon(MdiIcons.sword),
              label: 'Weapons',
            ),
            BottomNavigationBarItem(
              icon: Icon(MdiIcons.diamondStone),
              label: 'Materials',
            )
          ],
        ));
  }

  void _onTabTapped(int index) {
    setState(() {
      _currentIndex = index;
    });
  }

  void _overflowMenuSelection(String action) {
    print("Menu Overflow Action: ${action}");
    switch (action) {
      case 'exit':
        _signOut();
        break;
      default:
        PlaceholderUtil.showUnimplementedSnackbar(context);
        break;
    }
  }

  void _signOut() async {
    await _auth.signOut();
    Get.offAllNamed('/'); // Go to login screem
  }
}
