

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_rating_bar/flutter_rating_bar.dart';
import 'package:gi_weekly_material_tracker/models/grid.dart';
import 'package:gi_weekly_material_tracker/placeholder.dart';
import 'package:gi_weekly_material_tracker/util.dart';

final FirebaseFirestore _db = FirebaseFirestore.instance;
final FirebaseAuth _auth = FirebaseAuth.instance;

class GlobalTrackingPage extends StatelessWidget {
  final List<Tab> _tabs = [
    Tab(text: "Boss"),
    Tab(text: "Domains"),
    Tab(text: "Monster"),
    Tab(text: "Local Speciality")
  ];

  final List<Widget> _children = [
    GlobalTracker(path: "boss_drops"),
    GlobalTracker(path: "domain_forgery"),
    GlobalTracker(path: "mob_drops"),
    GlobalTracker(path: "local_speciality"),
  ];

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: _tabs.length,
      child: Scaffold(
        appBar: AppBar(
          title: Text("Consolidated Material List"),
          bottom: TabBar(
            tabs: _tabs,
          ),
        ),
        body: TabBarView(
          children: _children,
        ),
      ),
    );
  }
}

class GlobalTracker extends StatefulWidget {
  GlobalTracker({Key key, @required this.path}) : super(key: key);

  final String path;

  @override
  _GlobalTrackerState createState() => _GlobalTrackerState();
}

class _GlobalTrackerState extends State<GlobalTracker> {
  final String _uid = _auth.currentUser.uid;
  Map<String, dynamic> _materialData;


  @override
  void initState() {
    super.initState();

    GridData.retrieveMaterialsMapData().then((value) => {
      setState(() {
        _materialData = value;
      })
    });
  }

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

          if (snapshot.connectionState == ConnectionState.waiting ||
              _materialData == null) {
            return Util.centerLoadingCircle("");
          }

          QuerySnapshot data = snapshot.data;
          final int _collectionLen = data.docs.length;

          if (_collectionLen > 0) {
            // Consolidate stuff together
            Map<String, Map<String, dynamic>> _conData = new Map();
            data.docs.forEach((snap) {
              Map<String, dynamic> _tmp = snap.data();
              if (_conData.containsKey(_tmp["name"])) {
                // Append
                _conData[_tmp["name"]]["current"] = _conData[_tmp["name"]]["current"] + _tmp["current"];
                _conData[_tmp["name"]]["max"] = _conData[_tmp["name"]]["max"] + _tmp["max"];
              } else {
                _conData.putIfAbsent(_tmp["name"], () => {
                  "current": _tmp["current"],
                  "max": _tmp["max"],
                  "name": _tmp["name"],
                  "type": _tmp["type"]
                });
              }
            });


            return ListView.builder(
              itemCount: _conData.length,
              itemBuilder: (context, index) {
                String key = _conData.keys.elementAt(index);
                Map<String, dynamic> _data = _conData[key];
                print(_data);
                Map<String, dynamic> _material = _materialData[_data["name"]];

                return Card(
                  color: GridData.getRarityColor(_material["rarity"]),
                  child: InkWell(
                    onTap: () => PlaceholderUtil.showUnimplementedSnackbar(context),
                    child: Padding(
                      padding: const EdgeInsets.all(8),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.center,
                        children: [
                          GridData.getImageAssetFromFirebase(_material["image"],
                              height: 48),
                          Container(
                            width: MediaQuery.of(context).size.width - 180,
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisAlignment: MainAxisAlignment.start,
                              children: [
                                Text(
                                  _material["name"],
                                  style: TextStyle(
                                      fontSize: 20, color: Colors.white),
                                ),
                                RatingBar.builder(
                                  ignoreGestures: true,
                                  itemCount: 5,
                                  itemSize: 12,
                                  unratedColor: Colors.transparent,
                                  initialRating: double.tryParse(
                                      _material['rarity'].toString()),
                                  itemBuilder: (context, _) =>
                                      Icon(Icons.star, color: Colors.amber),
                                  onRatingUpdate: (rating) {
                                    print(rating);
                                  },
                                ),
                                Text(
                                  _material["obtained"]
                                      .toString()
                                      .replaceAll("\\n", "\n"),
                                  style: TextStyle(
                                      fontSize: 11, color: Colors.white),
                                ),
                              ],
                            ),
                          ),
                          Spacer(),
                          Column(
                            children: [
                              Text(
                                "${_data["current"]}/${_data["max"]}",
                                style: TextStyle(
                                    fontSize: 18, color: Colors.white),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              },
            );
          } else {
            return Center(
              child: Text("No items being tracked for this material category"),
            );
          }
        });
  }


}