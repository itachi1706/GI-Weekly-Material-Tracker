import 'package:cached_network_image/cached_network_image.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_image/firebase_image.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:gi_weekly_material_tracker/util.dart';
import 'package:octo_image/octo_image.dart';
import 'package:transparent_image/transparent_image.dart';

final FirebaseFirestore _db = FirebaseFirestore.instance;

class GridData {
  static Color getRarityColor(int rarity) {
    switch (rarity) {
      case 1:
        return Color(0xFF72778b);
      case 2:
        return Color(0xFF2a9072);
      case 3:
        return Color(0xFF5180cc);
      case 4:
        return Color(0xFFa256e1);
      case 5:
        return Color(0xFFbd6932);
      default:
        return Colors.black;
    }
  }

  static String getElementImageRef(String element) {
    switch (element.toLowerCase()) {
      case "geo":
        return "assets/images/elements/Element_Geo.png";
      case "anemo":
        return "assets/images/elements/Element_Anemo.png";
      case "cryo":
        return "assets/images/elements/Element_Cryo.png";
      case "dendro":
        return "assets/images/elements/Element_Dendro.png";
      case "electro":
        return "assets/images/elements/Element_Electro.png";
      case "hydro":
        return "assets/images/elements/Element_Hydro.png";
      case "pyro":
        return "assets/images/elements/Element_Pyro.png";
    }
    return null;
  }

  static Future<Map<String, dynamic>> retrieveMaterialsMapData() async {
    QuerySnapshot snapshot = await _db.collection("materials").get();
    Map<String, dynamic> data = new Map();
    snapshot.docs.forEach((element) {
      data.putIfAbsent(element.id, () => element.data());
    });
    return data;
  }

  static Future<Map<String, dynamic>> retrieveWeaponsMapData() async {
    QuerySnapshot snapshot = await _db.collection("weapons").get();
    Map<String, dynamic> data = new Map();
    snapshot.docs.forEach((element) {
      data.putIfAbsent(element.id, () => element.data());
    });
    return data;
  }

  static Future<Map<String, dynamic>> retrieveCharactersMapData() async {
    QuerySnapshot snapshot = await _db.collection("characters").get();
    Map<String, dynamic> data = new Map();
    snapshot.docs.forEach((element) {
      data.putIfAbsent(element.id, () => element.data());
    });
    return data;
  }

  static String getDayString(int day) {
    switch (day) {
      case 1: return "Mon";
      case 2: return "Tue";
      case 3: return "Wed";
      case 4: return "Thu";
      case 5: return "Fri";
      case 6: return "Sat";
      case 7: return "Sun";
    }
    return "Unknown";
  }

  static String getRomanNumberArray(int number) {
    switch (number) {
      case 0:
        return "I";
      case 1:
        return "II";
      case 2:
        return "III";
      case 3:
        return "IV";
      case 4:
        return "V";
      case 5:
        return "VI";
      case 6:
        return "VII";
      case -1:
        return ""; // Disabled
      default:
        return (number + 1).toString();
    }
  }
  
  static ImageProvider _getFirebaseImage(String url) {
    if (kIsWeb) return CachedNetworkImageProvider(url);
    return FirebaseImage(url);
  }

  static Widget getImageAssetFromFirebase(imageRef, {double height}) {
    if (imageRef == null) return Image.memory(kTransparentImage);
    return FutureBuilder(
      future: Util.getFirebaseStorageUrl(imageRef),
      builder: (context, snapshot) {
        if (snapshot.hasData) {
          return Center(
            child: Padding(
              padding: const EdgeInsets.all(8.0),
              child: SizedBox(
                height: height,
                width: height,
                child: OctoImage(
                  placeholderBuilder: (context) => SizedBox(
                    child: CircularProgressIndicator(),
                    height: height,
                    width: height,
                  ),
                  errorBuilder: (context, obj, trace) => Icon(Icons.error),
                  image: _getFirebaseImage(snapshot.data),
                  placeholderFadeInDuration: Duration(seconds: 2),
                ),
              ),
            ),
          );
        }
        return Stack(
          children: [
            Padding(
              padding: const EdgeInsets.all(8),
              child: Center(
                child: SizedBox(
                  child: CircularProgressIndicator(),
                  height: height,
                  width: height,
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(8),
              child: Image.memory(
                kTransparentImage,
                height: height,
              ),
            ),
          ],
        );
      },
    );
  }

  static Widget getGridData(Map<String, dynamic> data) {
    return Card(
      color: getRarityColor(data['rarity']),
      child: GridTile(
          child: Padding(
            padding: const EdgeInsets.all(8.0),
            child: Stack(
              children: [
                getImageAssetFromFirebase(data['image']),
              ],
            ),
          ),
          footer: Padding(
            padding: const EdgeInsets.all(2),
            child: Text(
              data['name'],
              textAlign: TextAlign.center,
              style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  color: Colors.white),
            ),
          )),
    );
  }
}
