import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:gi_weekly_material_tracker/placeholder.dart';
import 'package:gi_weekly_material_tracker/util.dart';
import 'package:image_fade/image_fade.dart';
import 'package:transparent_image/transparent_image.dart';

FirebaseFirestore db = FirebaseFirestore.instance;
FirebaseStorage storage = FirebaseStorage.instance;

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
                onTap: () => Util.showSnackbarQuick(context, "TODO: Show ${document.data()['name']} (${document.id}) info"),
                child: Card(
                  child: GridTile(
                    child: Padding(
                      padding: const EdgeInsets.all(8.0),
                      child: Stack(
                        children: [
                          FutureBuilder(
                            future: _getFirebaseStorageImageUrl(
                                document.data()['image']),
                            builder: (context, snapshot) {
                              if (snapshot.hasData) {
                                return Center(
                                    child: ImageFade(
                                      image: NetworkImage(snapshot.data),
                                      placeholder: Image.memory(kTransparentImage),
                                      alignment: Alignment.center,
                                      loadingBuilder: (context, child, event) {
                                        if (event == null) return child;
                                        return CircularProgressIndicator();
                                      },
                                    ));
                              }
                              return Stack(
                                children: [
                                  Center(
                                    child: CircularProgressIndicator(),
                                  ),
                                  Image.memory(kTransparentImage),
                                ],
                              );
                            },
                          ),
                        ],
                      ),
                    ),
                    footer: Text(
                      document.data()['name'],
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ),
              );
            }).toList(),
          );
        });
  }

  Future<String> _getFirebaseStorageImageUrl(String ref) async {
    return await storage.ref(ref).getDownloadURL();
  }
}
