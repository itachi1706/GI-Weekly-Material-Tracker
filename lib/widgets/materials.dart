import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
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
                onTap: () => Get.toNamed('/materials', arguments: [document.id, document.data()]),
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

  @override
  void initState() {
    _infoData = Get.arguments[1];
    _infoId = Get.arguments[0];
  }

  @override
  Widget build(BuildContext context) {
    // TODO: implement build
    print(_infoId);
    //throw UnimplementedError();
    return PlaceholderPage();
  }

}
