import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:gi_weekly_material_tracker/placeholder.dart';
import 'package:gi_weekly_material_tracker/util.dart';

final FirebaseFirestore _db = FirebaseFirestore.instance;
final FirebaseAuth _auth = FirebaseAuth.instance;

class TabControllerWidget extends StatefulWidget {
  TabControllerWidget({Key key, @required this.tabController})
      : super(key: key);

  final TabController tabController;

  @override
  _TabControllerWidgetState createState() => _TabControllerWidgetState();
}

class _TabControllerWidgetState extends State<TabControllerWidget> {
  final List<Widget> _children = [
    TrackerPage(path: "boss_drops"),
    TrackerPage(path: "domain_forgery"),
    TrackerPage(path: "mob_drops"),
    TrackerPage(path: "local_speciality"),
    PlaceholderWidgetContainer(Colors.pink),
  ];

  @override
  Widget build(BuildContext context) {
    return TabBarView(controller: widget.tabController, children: _children);
  }
}

class TrackerPage extends StatefulWidget {
  TrackerPage({Key key, @required this.path}) : super(key: key);

  final String path;

  @override
  _TrackerPageState createState() => _TrackerPageState();
}

class _TrackerPageState extends State<TrackerPage> {
  final String _uid = _auth.currentUser.uid;

  @override
  Widget build(BuildContext context) {
    CollectionReference ref =
        _db.collection("tracking").doc(_uid).collection(widget.path);
    return StreamBuilder(
        stream: ref.snapshots(),
        builder: (context, AsyncSnapshot<QuerySnapshot> snapshot) {
          if (snapshot.hasError) {
            return Text("Error occurred getting snapshot");
          }

          if (snapshot.connectionState == ConnectionState.waiting) {
            return Util.centerLoadingCircle("");
          }

          QuerySnapshot data = snapshot.data;
          final int _collectionLen = data.docs.length;

          if (_collectionLen > 0) {
            return ListView.builder(
              itemCount: _collectionLen,
              itemBuilder: (context, index) {
                return ListTile(
                  onTap: () =>
                      PlaceholderUtil.showUnimplementedSnackbar(context),
                  title: Text("YOLO $index"),
                );
              },
            );
          } else {
            return Center(
              child: Text("Not tracking any items for this category"),
            );
          }
        });
  }
}
