import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter/widgets.dart';
import 'package:get/get.dart';
import 'package:gi_weekly_material_tracker/helpers/grid.dart';
import 'package:gi_weekly_material_tracker/helpers/notifications.dart';
import 'package:gi_weekly_material_tracker/listeners/sorter.dart';
import 'package:gi_weekly_material_tracker/util.dart';
import 'package:gi_weekly_material_tracker/widgets/characters.dart';
import 'package:gi_weekly_material_tracker/widgets/drawer.dart';
import 'package:gi_weekly_material_tracker/widgets/materials.dart';
import 'package:gi_weekly_material_tracker/widgets/tracking.dart';
import 'package:gi_weekly_material_tracker/widgets/weapons.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

final FirebaseAuth _auth = FirebaseAuth.instance;

class MainNavigationPage extends StatefulWidget {
  final String title;

  MainNavigationPage({Key key, this.title}) : super(key: key);

  @override
  _MainNavigationPageState createState() => _MainNavigationPageState();
}

class _MainNavigationPageState extends State<MainNavigationPage>
    with TickerProviderStateMixin {
  int _currentIndex = 0;

  List<Widget> _children;

  final Map<int, List<Tab>> _tabs = {
    0: [
      Tab(text: 'Boss'),
      Tab(text: 'Domains'),
      Tab(text: 'Monster'),
      Tab(text: 'Local Speciality'),
      Tab(text: 'Week Planner'),
    ],
    1: [
      Tab(text: 'All'),
      Tab(
        icon: Image.asset(
          GridData.getElementImageRef('Anemo'),
          height: 20,
        ),
      ),
      Tab(
        icon: Image.asset(
          GridData.getElementImageRef('Cryo'),
          height: 20,
        ),
      ),
      Tab(
        icon: Image.asset(
          GridData.getElementImageRef('Electro'),
          height: 20,
        ),
      ),
      Tab(
        icon: Image.asset(
          GridData.getElementImageRef('Geo'),
          height: 20,
        ),
      ),
      Tab(
        icon: Image.asset(
          GridData.getElementImageRef('Hydro'),
          height: 20,
        ),
      ),
      Tab(
        icon: Image.asset(
          GridData.getElementImageRef('Pyro'),
          height: 20,
        ),
      ),
    ],
    2: [
      Tab(text: 'All'),
      Tab(text: 'Bow'),
      Tab(text: 'Catalyst'),
      Tab(text: 'Claymore'),
      Tab(text: 'Polearm'),
      Tab(text: 'Sword'),
    ],
    3: [
      Tab(text: 'All'),
      Tab(text: 'Boss'),
      Tab(text: 'Domains'),
      Tab(text: 'Monster'),
      Tab(text: 'Local Speciality'),
    ],
  };
  Map<int, TabController> _tabControllers;

  SortNotifier _notifier;
  SortBy _sortList;

  @override
  void initState() {
    super.initState();
    _tabControllers = {
      0: TabController(vsync: this, length: _tabs[0].length),
      1: TabController(vsync: this, length: _tabs[1].length),
      2: TabController(vsync: this, length: _tabs[2].length),
      3: TabController(vsync: this, length: _tabs[3].length),
    };
    _notifier = SortNotifier();
    _children = [
      TrackingTabController(tabController: _tabControllers[0]),
      CharacterTabController(
        tabController: _tabControllers[1],
        notifier: _notifier,
      ),
      WeaponTabController(
        tabController: _tabControllers[2],
        notifier: _notifier,
      ),
      MaterialTabController(
        tabController: _tabControllers[3],
        notifier: _notifier,
      ),
    ];
    _sortList = SortBy(_notifier);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.title),
        bottom: _showAppBar(),
        actions: [
          _showSortWidget(),
          IconButton(
            icon: Icon(MdiIcons.fileDocument),
            tooltip: 'View Consolidated Material List',
            onPressed: () => Get.toNamed('/globalTracking'),
          ),
          PopupMenuButton(
            onSelected: _overflowMenuSelection,
            elevation: 2.0,
            itemBuilder: (context) => _generatePopupMenuItems(),
          ),
        ],
      ),
      drawer: DrawerComponent(),
      body: _children[_currentIndex],
      bottomNavigationBar: BottomNavigationBar(
        selectedItemColor: Colors.deepOrange,
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
          ),
        ],
      ),
    );
  }

  List<PopupMenuEntry<String>> _generatePopupMenuItems() {
    return [
      PopupMenuItem(
        value: 'promo-code',
        child: Text('Promotion Codes'),
      ),
      PopupMenuItem(
        value: 'parametric-reminder',
        child: Text('Parametric Transformer'),
      ),
      PopupMenuItem(
        value: 'forum-login',
        child: Text('Daily Forum Login'),
      ),
      PopupMenuItem(
        value: 'exit',
        child: Text('Logout'),
      ),
      PopupMenuItem(
        value: 'settings',
        child: Text('Settings'),
      ),
    ];
  }

  Widget _showAppBar() {
    if (!_tabs.containsKey(_currentIndex)) return null;

    return TabBar(
      controller: _tabControllers[_currentIndex],
      tabs: _tabs[_currentIndex],
      isScrollable: true,
    );
  }

  void _sortBy(dynamic sorter) {
    var descending = false;
    if (_notifier.getSortKey() == sorter) {
      descending = !_notifier.isDescending();
    }
    print(
      'Sorting by $sorter in ${(descending) ? 'Descending' : 'Ascending'} order',
    );
    _notifier.updateSortKey(sorter, descending);
  }

  Widget _showSortWidget() {
    return _currentIndex > 0
        ? PopupMenuButton(
            icon: Icon(Icons.sort),
            elevation: 2.0,
            onSelected: _sortBy,
            itemBuilder: (context) => _sortList.getSortList(_currentIndex),
          )
        : SizedBox.shrink();
  }

  void _onTabTapped(int index) {
    setState(() {
      _currentIndex = index;
    });
  }

  void _overflowMenuSelection(String action) {
    print('Menu Overflow Action: $action');
    switch (action) {
      case 'exit':
        _signOut();
        break;
      case 'forum-login':
        NotificationManager.getInstance().selectNotification(action);
        break;
      case 'settings':
        Get.toNamed('/settings');
        break;
      case 'parametric-reminder':
        Get.toNamed('/parametric');
        break;
      case 'promo-code':
        Get.toNamed('/promos');
        break;
      default:
        Util.showSnackbarQuick(context, 'Undefined action ($action)');
        break;
    }
  }

  void _signOut() async {
    await _auth.signOut();
    await Get.offAllNamed('/'); // Go to login screem
  }
}

class TrackingPage extends StatefulWidget {
  final String title;

  TrackingPage({Key key, this.title}) : super(key: key);

  @override
  _TrackingPageState createState() => _TrackingPageState();
}

class _TrackingPageState extends State<TrackingPage>
    with TickerProviderStateMixin {

  final List<Tab> _tabs = [
    Tab(text: 'Boss'),
    Tab(text: 'Domains'),
    Tab(text: 'Monster'),
    Tab(text: 'Local Speciality'),
    Tab(text: 'Week Planner'),
  ];

  TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(vsync: this, length: _tabs.length);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.title),
        bottom: _showAppBar(),
        actions: [
          IconButton(
            icon: Icon(MdiIcons.fileDocument),
            tooltip: 'View Consolidated Material List',
            onPressed: () => Get.toNamed('/globalTracking'),
          ),
          PopupMenuButton(
            onSelected: _overflowMenuSelection,
            elevation: 2.0,
            itemBuilder: (context) => _generatePopupMenuItems(),
          ),
        ],
      ),
      drawer: DrawerComponent(),
      body: TrackingTabController(tabController: _tabController),
    );
  }

  List<PopupMenuEntry<String>> _generatePopupMenuItems() {
    return [
      PopupMenuItem(
        value: 'forum-login',
        child: Text('Daily Forum Login'),
      ),
    ];
  }

  Widget _showAppBar() {
    return TabBar(
      controller: _tabController,
      tabs: _tabs,
      isScrollable: true,
    );
  }

  void _overflowMenuSelection(String action) {
    print('Menu Overflow Action: $action');
    switch (action) {
      case 'forum-login':
        NotificationManager.getInstance().selectNotification(action);
        break;
      default:
        Util.showSnackbarQuick(context, 'Undefined action ($action)');
        break;
    }
  }
}