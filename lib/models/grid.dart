import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:gi_weekly_material_tracker/util.dart';
import 'package:image_fade/image_fade.dart';
import 'package:transparent_image/transparent_image.dart';

class GridData {

  static Color getRarityColor(int rarity) {
    switch (rarity) {
      case 1: return Color(0xFF72778b);
      case 2: return Color(0xFF2a9072);
      case 3: return Color(0xFF5180cc);
      case 4: return Color(0xFFa256e1);
      case 5: return Color(0xFFbd6932);
      default: return Colors.black;
    }
  }

  static Widget getGridData(QueryDocumentSnapshot document) {
    return Card(
      color: getRarityColor(document.data()['rarity']),
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
        footer: Padding(
          padding: const EdgeInsets.all(2),
          child: Text(
            document.data()['name'],
            textAlign: TextAlign.center,
            style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.bold,
                color: Colors.white
            ),
          ),
        )
      ),
    );
  }
}
