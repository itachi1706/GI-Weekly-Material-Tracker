import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:flutter_rating_bar/flutter_rating_bar.dart';
import 'package:get/get.dart';
import 'package:gi_weekly_material_tracker/models/grid.dart';
import 'package:gi_weekly_material_tracker/util.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

FirebaseFirestore db = FirebaseFirestore.instance;

class CharacterListGrid extends StatefulWidget {
  @override
  _CharacterListGridState createState() => _CharacterListGridState();
}

class _CharacterListGridState extends State<CharacterListGrid> {
  @override
  Widget build(BuildContext context) {
    CollectionReference materialRef = db.collection('characters');
    return StreamBuilder(
        stream: materialRef.snapshots(),
        builder: (context, AsyncSnapshot<QuerySnapshot> snapshot) {
          if (snapshot.hasError) {
            return Text("Error occurred getting snapshot");
          }

          if (snapshot.connectionState == ConnectionState.waiting) {
            return Util.centerLoadingCircle("");
          }

          return GridView.count(
            crossAxisCount: 3,
            children: snapshot.data.docs.map((document) {
              return GestureDetector(
                onTap: () => Get.toNamed('/characters',
                    arguments: [document.id, document.data()]),
                child: GridData.getGridData(document),
              );
            }).toList(),
          );
        });
  }
}

class CharacterInfoPage extends StatefulWidget {
  @override
  _CharacterInfoPageState createState() => _CharacterInfoPageState();
}

class _CharacterInfoPageState extends State<CharacterInfoPage> {
  Map<String, dynamic> _infoData;
  String _infoId;

  Color _rarityColor;

  @override
  void initState() {
    _infoData = Get.arguments[1];
    _infoId = Get.arguments[0];
    _rarityColor = GridData.getRarityColor(_infoData['rarity']);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_infoData['name']),
        backgroundColor: _rarityColor,
      ),
      body: Padding(
        padding: const EdgeInsets.all(8),
        child: SingleChildScrollView(
          child: Column(
            children: [
              Row(
                children: [
                  GridData.getImageAssetFromFirebase(_infoData['image'],
                      height: 64),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _infoData['affiliation'],
                        textAlign: TextAlign.start,
                        style: TextStyle(fontSize: 20),
                      ),
                      RatingBar.builder(
                        ignoreGestures: true,
                        itemCount: 5,
                        itemSize: 30,
                        initialRating:
                        double.tryParse(_infoData['rarity'].toString()),
                        itemBuilder: (context, _) =>
                            Icon(Icons.star, color: Colors.amber),
                        onRatingUpdate: (rating) {
                          print(rating);
                        },
                      ),
                    ],
                  ),
                  Spacer(),
                  GridData.getImageAssetFromFirebase(
                      GridData.getElementImageRef(_infoData['element']))
                ],
              ),
              Divider(),
              Padding(
                padding: const EdgeInsets.all(8),
                child: Row(
                  children: [
                    Icon(Icons.location_pin),
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.only(left: 8, right: 8),
                        child: Text(_infoData['nation']),
                      ),
                    ),
                  ],
                ),
              ),
              Divider(),
              Padding(
                padding: const EdgeInsets.all(8),
                child: Row(
                  children: [
                    Icon(Icons.format_list_bulleted),
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.only(left: 8, right: 8),
                        child: Text(_infoData['description']),
                      ),
                    ),
                  ],
                ),
              ),
              Divider(),
              Padding(
                padding: const EdgeInsets.all(8),
                child: Row(
                  children: [
                    Icon(Icons.book),
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.only(left: 8, right: 8),
                        child: Text(_infoData['introduction']),
                      ),
                    ),
                  ],
                ),
              ),
              Divider(),
              Padding(
                padding: const EdgeInsets.all(8),
                child: Row(
                  children: [
                    Icon(MdiIcons.weatherNight),
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.only(left: 8, right: 8),
                        child: Text(_infoData['constellation']),
                      ),
                    ),
                  ],
                ),
              ),
              Divider(),
              Padding(
                padding: const EdgeInsets.all(8),
                child: Row(
                  children: [
                    Icon(MdiIcons.swordCross),
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.only(left: 8, right: 8),
                        child: Text(_infoData['weapon']),
                      ),
                    ),
                  ],
                ),
              ),
              Divider(),
              IntrinsicHeight(
                child: Row(
                  children: [
                    Padding(
                      padding: const EdgeInsets.all(8),
                      child: Row(
                        children: [
                          Icon(MdiIcons.genderMaleFemale),
                          Padding(
                            padding: const EdgeInsets.only(left: 8, right: 8),
                            child: Text(_infoData['gender']),
                          ),
                        ],
                      ),
                    ),
                    Spacer(),
                    VerticalDivider(),
                    Padding(
                      padding: const EdgeInsets.all(8),
                      child: Row(
                        children: [
                          Icon(Icons.cake),
                          Padding(
                            padding: const EdgeInsets.only(left: 8, right: 8),
                            child: Text(_infoData['birthday']),
                          ),
                        ],
                      ),
                    ),
                    Spacer(),
                  ],
                ),
              ),
              Divider(),
              Padding(
                  padding: const EdgeInsets.all(8),
                  child: Row(
                    children: [
                      Text(
                        "Ascension Materials",
                        style: TextStyle(fontSize: 24),
                      ),
                    ],
                  )),
              Text("Coming Soon"),
            ],
          ),
        ),
      ),
    );
  }
}
