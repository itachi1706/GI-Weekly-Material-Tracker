import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:flutter_rating_bar/flutter_rating_bar.dart';
import 'package:get/get.dart';
import 'package:gi_weekly_material_tracker/models/grid.dart';
import 'package:gi_weekly_material_tracker/placeholder.dart';
import 'package:gi_weekly_material_tracker/util.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import 'package:transparent_image/transparent_image.dart';

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

  Map<String, dynamic> _materialData;

  @override
  void initState() {
    _infoData = Get.arguments[1];
    _infoId = Get.arguments[0];
    _rarityColor = GridData.getRarityColor(_infoData['rarity']);
    GridData.retrieveMaterialsMapData(db).then((value) => {
      setState(() {_materialData = value;})
    });
  }

  Widget _getAscenionImage(String itemKey) {
    if (itemKey == null) return Image.memory(kTransparentImage);
    
    return GridData.getImageAssetFromFirebase(_materialData[itemKey]['image'], height: 16);
  }

  Widget _generateAscensionData() {
    if (_materialData == null) {
      return Padding(
        padding: const EdgeInsets.only(top: 16),
        child: CircularProgressIndicator(),
      );
    }

    Map<String, dynamic> dataMap = _infoData['ascension'];
    List<MapEntry<String, dynamic>> data = dataMap.entries.map((e) => e).toList();
    return ListView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: data.length,
      itemBuilder: (context, index) {
        Map<String, dynamic> curData = data[index].value;
        return Container(
          child: Card(
            child: InkWell(
              onTap: () => PlaceholderUtil.showUnimplementedSnackbar(context),
              child: Padding(
                padding: const EdgeInsets.all(8),
                child: Row(
                  children: [
                    Text(GridData.getRomanNumberArray(index), style: TextStyle(fontSize: 24),),
                    Spacer(),
                    Icon(Icons.show_chart),
                    Text(curData['level'].toString()),
                    Spacer(),
                    Image.asset("assets/images/items/Icon_Mora.png", height: 16),
                    Text(curData['mora'].toString()),
                    Spacer(),
                    _getAscenionImage(curData['material2']),
                    Text((curData['material2qty'] == 0) ? "" : curData['material2qty'].toString()),
                    Spacer(),
                    _getAscenionImage(curData['material1']),
                    Text(curData['material1qty'].toString()),
                    Spacer(),
                    _getAscenionImage(curData['material3']),
                    Text(curData['material3qty'].toString()),
                    Spacer(),
                    _getAscenionImage(curData['material4']),
                    Text(curData['material4qty'].toString()),
                    Spacer(),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
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
                      Container(
                        width: 200,
                        child: Text(
                          _infoData['affiliation'].toString(),
                          textAlign: TextAlign.start,
                          style: TextStyle(fontSize: 20),
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
                  Spacer(),
                  Image.asset(GridData.getElementImageRef(_infoData['element']))
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
                        child: Text(_infoData['description'].toString().replaceAll('\\n', "\n")),
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
                        child: Text(_infoData['introduction'].toString().replaceAll('\\n', "\n")),
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
              _generateAscensionData(),
            ],
          ),
        ),
      ),
    );
  }
}
