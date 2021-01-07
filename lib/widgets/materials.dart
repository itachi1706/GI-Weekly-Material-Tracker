import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:flutter_rating_bar/flutter_rating_bar.dart';
import 'package:get/get.dart';
import 'package:gi_weekly_material_tracker/models/grid.dart';
import 'package:gi_weekly_material_tracker/placeholder.dart';
import 'package:gi_weekly_material_tracker/util.dart';

FirebaseFirestore db = FirebaseFirestore.instance;

class MaterialListGrid extends StatefulWidget {
  @override
  _MaterialListGridState createState() => _MaterialListGridState();
}

class _MaterialListGridState extends State<MaterialListGrid> {
  @override
  Widget build(BuildContext context) {
    CollectionReference materialRef = db.collection('materials');
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
                onTap: () => Get.toNamed('/materials',
                    arguments: [document.id, document.data()]),
                child: GridData.getGridData(document),
              );
            }).toList(),
          );
        });
  }
}

class MaterialInfoPage extends StatefulWidget {
  @override
  _MaterialInfoPageState createState() => _MaterialInfoPageState();
}

class _MaterialInfoPageState extends State<MaterialInfoPage> {
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
      floatingActionButton: FloatingActionButton(
        child: Icon(Icons.add),
        backgroundColor: _rarityColor,
        onPressed: () => PlaceholderUtil.showUnimplementedSnackbar(context),
      ),
      body: Padding(
        padding: const EdgeInsets.all(8),
        child: Column(
          children: [
            Row(
              children: [
                GridData.getImageAssetFromFirebase(_infoData['image'],
                    height: 64),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: MediaQuery.of(context).size.width - 128,
                      child: Text(
                        _infoData['type'],
                        textAlign: TextAlign.start,
                        style: TextStyle(
                            fontSize: 20
                        ),
                      ),
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
                      child: Text(_infoData['obtained'].toString().replaceAll('\\n', "\n").replaceAll("- ", "")),
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
                      child: Text(_infoData['description'].toString().replaceAll('\\n', "\n")),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
