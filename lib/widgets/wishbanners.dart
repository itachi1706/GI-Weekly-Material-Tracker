import 'package:firebase_database/firebase_database.dart';
import 'package:flutter/material.dart';
import 'package:flutterfire_ui/database.dart';
import 'package:gi_weekly_material_tracker/placeholder.dart';
import 'package:gi_weekly_material_tracker/widgets/drawer.dart';

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
    const WishListPageContent(wishType: 'weapon', color: Colors.blue),
    const WishListPageContent(wishType: 'standard', color: Colors.green),
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
      body: TabBarView(controller: _tabController, children: _children,),
    );
  }
}

class WishListPageContent extends StatefulWidget {
  final String wishType;
  final Color? color; // TODO: To remove when placeholder completes

  const WishListPageContent({Key? key, required this.wishType, this.color}) : super(key: key);

  @override
  _WishListPageContentState createState() => _WishListPageContentState();
}

class _WishListPageContentState extends State<WishListPageContent> {
  @override
  Widget build(BuildContext context) {
    // TODO: To remove when placeholder completes
    if (widget.color != null) {
      return PlaceholderWidgetContainer(widget.color!);
    }

    final query = db.ref('banners').child(widget.wishType);

    return FirebaseDatabaseListView(query: query, itemBuilder: (context, snapshot) {
      var banner = snapshot.value as Map<dynamic, dynamic>;

      return Card(
        child: ListTile(
          title: banner['name'],
        ),
      );
    });
  }

}
