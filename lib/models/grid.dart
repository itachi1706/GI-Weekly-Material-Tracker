import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:gi_weekly_material_tracker/util.dart';
import 'package:image_fade/image_fade.dart';
import 'package:transparent_image/transparent_image.dart';

class GridData {
  static Widget getGridData(QueryDocumentSnapshot document) {
    return Card(
      child: GridTile(
        child: Padding(
          padding: const EdgeInsets.all(8.0),
          child: Stack(
            children: [
              FutureBuilder(
                future: Util.getFirebaseStorageUrl(document.data()['image']),
                builder: (context, snapshot) {
                  if (snapshot.hasData) {
                    return Center(
                      child: Padding(
                        padding: const EdgeInsets.all(8.0),
                        child: ImageFade(
                          image: NetworkImage(snapshot.data),
                          placeholder: Image.memory(kTransparentImage),
                          alignment: Alignment.center,
                          loadingBuilder: (context, child, event) {
                            if (event == null) return child;
                            return CircularProgressIndicator();
                          },
                        ),
                      ),
                    );
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
    );
  }
}
