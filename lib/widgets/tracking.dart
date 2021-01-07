import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:gi_weekly_material_tracker/placeholder.dart';
import 'package:gi_weekly_material_tracker/util.dart';

FirebaseFirestore db = FirebaseFirestore.instance;

class TabControllerWidget extends StatefulWidget {
  TabControllerWidget({Key key, @required this.tabController}) : super(key: key);

  final TabController tabController;

  @override
  _TabControllerWidgetState createState() => _TabControllerWidgetState();
}

class _TabControllerWidgetState extends State<TabControllerWidget> {

  final List<Widget> _children = [
    PlaceholderWidgetContainer(Colors.red),
    PlaceholderWidgetContainer(Colors.blue),
    PlaceholderWidgetContainer(Colors.green),
    PlaceholderWidgetContainer(Colors.yellow),
    PlaceholderWidgetContainer(Colors.pink),
  ];

  @override
  Widget build(BuildContext context) {
    return TabBarView(
      controller: widget.tabController,
      children: _children
    );
  }
}