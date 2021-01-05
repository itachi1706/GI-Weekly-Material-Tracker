import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:gi_weekly_material_tracker/models/grid.dart';
import 'package:gi_weekly_material_tracker/util.dart';

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
                onTap: () => Util.showSnackbarQuick(context,
                    "TODO: Show ${document.data()['name']} (${document.id}) info"),
                child: GridData.getGridData(document),
              );
            }).toList(),
          );
        });
  }
}
