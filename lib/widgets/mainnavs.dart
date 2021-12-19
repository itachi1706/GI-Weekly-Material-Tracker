import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:gi_weekly_material_tracker/helpers/grid.dart';
import 'package:gi_weekly_material_tracker/listeners/sorter.dart';
import 'package:gi_weekly_material_tracker/widgets/characters.dart';
import 'package:gi_weekly_material_tracker/widgets/drawer.dart';
import 'package:gi_weekly_material_tracker/widgets/materials.dart';
import 'package:gi_weekly_material_tracker/widgets/tracking.dart';
import 'package:gi_weekly_material_tracker/widgets/weapons.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

class TrackingPage extends StatefulWidget {
  final String? title;

  const TrackingPage({Key? key, this.title}) : super(key: key);

  @override
  _TrackingPageState createState() => _TrackingPageState();
}

class _TrackingPageState extends State<TrackingPage>
    with TickerProviderStateMixin {
  final List<Tab> _tabs = [
    const Tab(text: 'Boss'),
    const Tab(text: 'Domains'),
    const Tab(text: 'Monster'),
    const Tab(text: 'Local Speciality'),
    const Tab(text: 'Week Planner'),
  ];

  TabController? _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(vsync: this, length: _tabs.length);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.title!),
        bottom: _showAppBar() as PreferredSizeWidget?,
        actions: [
          IconButton(
            icon: const Icon(MdiIcons.fileDocument),
            tooltip: 'View Consolidated Material List',
            onPressed: () => Get.toNamed('/globalTracking'),
          ),
        ],
      ),
      drawer: const DrawerComponent(),
      body: TrackingTabController(tabController: _tabController),
    );
  }

  Widget _showAppBar() {
    return TabBar(
      controller: _tabController,
      indicatorColor: Theme.of(context).colorScheme.secondary,
      tabs: _tabs,
      isScrollable: true,
    );
  }
}

class DictionaryPage extends StatefulWidget {
  const DictionaryPage({Key? key}) : super(key: key);

  @override
  _DictionaryPageState createState() => _DictionaryPageState();
}

class _DictionaryPageState extends State<DictionaryPage>
    with TickerProviderStateMixin {
  int _currentIndex = 0;

  late List<Widget> _children;

  final Map<int, List<Tab>> _tabs = {
    0: [
      const Tab(text: 'All'),
      Tab(
        icon: Image.asset(
          GridData.getElementImageRef('Anemo')!,
          height: 20,
        ),
      ),
      Tab(
        icon: Image.asset(
          GridData.getElementImageRef('Cryo')!,
          height: 20,
        ),
      ),
      Tab(
        icon: Image.asset(
          GridData.getElementImageRef('Electro')!,
          height: 20,
        ),
      ),
      Tab(
        icon: Image.asset(
          GridData.getElementImageRef('Geo')!,
          height: 20,
        ),
      ),
      Tab(
        icon: Image.asset(
          GridData.getElementImageRef('Hydro')!,
          height: 20,
        ),
      ),
      Tab(
        icon: Image.asset(
          GridData.getElementImageRef('Pyro')!,
          height: 20,
        ),
      ),
    ],
    1: [
      const Tab(text: 'All'),
      const Tab(text: 'Bow'),
      const Tab(text: 'Catalyst'),
      const Tab(text: 'Claymore'),
      const Tab(text: 'Polearm'),
      const Tab(text: 'Sword'),
    ],
    2: [
      const Tab(text: 'All'),
      const Tab(text: 'Boss'),
      const Tab(text: 'Domains'),
      const Tab(text: 'Monster'),
      const Tab(text: 'Local Speciality'),
    ],
  };
  late Map<int, TabController> _tabControllers;

  SortNotifier? _notifier;
  late SortBy _sortList;

  @override
  void initState() {
    super.initState();
    _tabControllers = {
      0: TabController(vsync: this, length: _tabs[0]!.length),
      1: TabController(vsync: this, length: _tabs[1]!.length),
      2: TabController(vsync: this, length: _tabs[2]!.length),
    };
    _notifier = SortNotifier();
    _children = [
      CharacterTabController(
        tabController: _tabControllers[0],
        notifier: _notifier,
      ),
      WeaponTabController(
        tabController: _tabControllers[1],
        notifier: _notifier,
      ),
      MaterialTabController(
        tabController: _tabControllers[2],
        notifier: _notifier,
      ),
    ];
    _sortList = SortBy(_notifier);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Dictionary'),
        bottom: _showAppBar() as PreferredSizeWidget?,
        actions: [
          _showSortWidget(),
        ],
      ),
      drawer: const DrawerComponent(),
      body: _children[_currentIndex],
      bottomNavigationBar: BottomNavigationBar(
        selectedItemColor: Colors.deepOrange,
        unselectedItemColor: Colors.grey,
        currentIndex: _currentIndex,
        onTap: _onTabTapped,
        items: const [
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

  Widget? _showAppBar() {
    if (!_tabs.containsKey(_currentIndex)) return null;

    return TabBar(
      controller: _tabControllers[_currentIndex],
      tabs: _tabs[_currentIndex]!,
      indicatorColor: Theme.of(context).colorScheme.secondary,
      isScrollable: true,
    );
  }

  void _sortBy(dynamic sorter) {
    var descending = false;
    if (_notifier!.getSortKey() == sorter) {
      descending = !_notifier!.isDescending();
    }
    debugPrint(
      'Sorting by $sorter in ${(descending) ? 'Descending' : 'Ascending'} order',
    );
    _notifier!.updateSortKey(sorter, descending);
  }

  Widget _showSortWidget() {
    return PopupMenuButton(
      icon: const Icon(Icons.sort),
      elevation: 2.0,
      onSelected: _sortBy,
      itemBuilder: (context) => _sortList.getSortList(_currentIndex),
    );
  }

  void _onTabTapped(int index) {
    setState(() {
      _currentIndex = index;
    });
  }
}
