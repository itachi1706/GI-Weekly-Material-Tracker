import 'package:cached_network_image/cached_network_image.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'package:firebase_image/firebase_image.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:gi_weekly_material_tracker/models/characterdata.dart';
import 'package:gi_weekly_material_tracker/models/commondata.dart';
import 'package:gi_weekly_material_tracker/models/materialdata.dart';
import 'package:gi_weekly_material_tracker/models/weapondata.dart';
import 'package:gi_weekly_material_tracker/util.dart';
import 'package:octo_image/octo_image.dart';

final FirebaseFirestore _db = FirebaseFirestore.instance;

class GridData {
  static final Map<String, Map<String, CommonData>> _staticData = {};
  static final Map<String, bool> _downloading = {};

  static Widget getAscensionImage(
    String? itemKey,
    Map<String, MaterialDataCommon>? data,
  ) {
    if (itemKey == null) {
      return Image.memory(Util.kTransparentImage, height: 16);
    }
    // debugPrint('getAscensionImage: $itemKey');

    return getImageAssetFromFirebase(
      data![itemKey]?.image ?? '',
      height: 16,
    );
  }

  static Color getCountColor(int? current, int? max, {bw = false}) {
    if (bw) {
      return (current! >= max!)
          ? Colors.green
          : (Util.themeNotifier.isDarkMode())
              ? Colors.white
              : Colors.black;
    }

    return (current! >= max!) ? Colors.greenAccent : Colors.white;
  }

  static List<QueryDocumentSnapshot> getDataListFilteredRelease(
    List<QueryDocumentSnapshot> snapshot,
  ) {
    var data = <QueryDocumentSnapshot>[];
    for (var element in snapshot) {
      var dt = element.data() as Map<String, dynamic>;
      if (dt['released']) {
        data.add(element);
      } else {
        debugPrint("Skipping ${dt['name']}");
      }
    }

    return data;
  }

  static void setStaticData(String type, QuerySnapshot? snapshot) {
    if (snapshot == null) return;
    debugPrint('Updating $type static data in memory');
    var snapData = getDataListFilteredRelease(snapshot.docs);
    var data = <String, dynamic>{};

    for (var element in snapData) {
      var dt = element.data() as Map<String, dynamic>;
      if (dt['released']) {
        data.putIfAbsent(element.id, () => dt);
      } else {
        debugPrint("Skipping ${dt['name']}");
      }
    }
    switch (type) {
      case 'characters':
        _staticData[type] = CharacterData.getList(data);
        break;
      case 'weapons':
        _staticData[type] = WeaponData.getList(data);
        break;
      case 'materials':
        _staticData[type] = MaterialDataCommon.getList(data);
        break;
    }
  }

  static Future<Map<String, MaterialDataCommon>?>
      retrieveMaterialsMapData() async =>
          (await _retrieveStaticData('materials'))
              as Map<String, MaterialDataCommon>?;

  static Future<Map<String, WeaponData>?> retrieveWeaponsMapData() async =>
      (await _retrieveStaticData('weapons')) as Map<String, WeaponData>?;

  static Future<Map<String, CharacterData>?>
      retrieveCharactersMapData() async =>
          (await _retrieveStaticData('characters'))
              as Map<String, CharacterData>?;

  static Widget getImageAssetFromFirebase(
    imageRef, {
    double? height,
    double? width,
    double padding = 8.0,
  }) {
    if (imageRef == null) return Image.memory(Util.kTransparentImage);
    width = width ?? height;

    return FutureBuilder(
      future: Util.getFirebaseStorageUrl(imageRef),
      builder: (context, snapshot) {
        if (snapshot.hasData) {
          return Center(
            child: Padding(
              padding: EdgeInsets.all(padding),
              child: SizedBox(
                height: height,
                width: width,
                child: OctoImage(
                  placeholderBuilder: (context) => SizedBox(
                    height: height,
                    width: width,
                    child: const CircularProgressIndicator(),
                  ),
                  errorBuilder: (context, obj, trace) =>
                      const Icon(Icons.error),
                  image: _getFirebaseImage(snapshot.data.toString()),
                  fit: BoxFit.fitWidth,
                  placeholderFadeInDuration: const Duration(seconds: 2),
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
                  height: height,
                  width: width,
                  child: const CircularProgressIndicator(),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(8),
              child: Image.memory(
                Util.kTransparentImage,
                height: height,
              ),
            ),
          ],
        );
      },
    );
  }

  static Widget getGridData(CommonData data) {
    return Card(
      color: GridUtils.getRarityColor(data.rarity, crossover: data.crossover),
      child: GridTile(
        footer: Padding(
          padding: const EdgeInsets.all(2),
          child: Text(
            data.name ?? 'Unknown',
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.bold,
              color: Colors.white,
            ),
          ),
        ),
        child: Padding(
          padding: const EdgeInsets.all(8.0),
          child: Stack(
            children: [
              getImageAssetFromFirebase(data.image),
            ],
          ),
        ),
      ),
    );
  }

  static void launchWikiUrl(BuildContext context, CommonData data) async {
    if (!await Util.launchWebPage(
      data.wiki,
      rarityColor:
          GridUtils.getRarityColor(data.rarity, crossover: data.crossover),
    )) {
      Util.showSnackbarQuick(
        context,
        'Wiki Page not available for ${data.name ?? 'Unknown'}',
      );
    }
  }

  static List<Widget> generateHeaderInfoLine(
    String header,
    String description,
    IconData icon,
  ) {
    return [
      Padding(
        padding: const EdgeInsets.all(8),
        child: Row(
          children: [
            Icon(icon),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.only(left: 8, right: 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      header,
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        decoration: TextDecoration.underline,
                        fontSize: 16,
                      ),
                    ),
                    GridData.generateElementalColoredLine(
                      description..replaceAll('\\n', '\n'),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
      const Divider(),
    ];
  }

  static List<Widget> generateInfoLine(String textData, IconData icon) {
    return [
      Padding(
        padding: const EdgeInsets.all(8),
        child: Row(
          children: [
            Icon(icon),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.only(left: 8, right: 8),
                child: Text(textData.replaceAll('\\n', '\n')),
              ),
            ),
          ],
        ),
      ),
      const Divider(),
    ];
  }

  static List<Widget> unreleasedCheck(bool released, String type) {
    if (released) return [const SizedBox.shrink()];

    return GridData.generateInfoLine(
      'This is an unreleased $type. Tracking is disabled and data is incomplete and subjected to change',
      Icons.warning_amber,
    );
  }

  static Widget generateElementalColoredLine(String textData) {
    debugPrint("Before: $textData");
    // Do the replacement here so that we know exactly how we are going to replace it with
    textData = GridUtils.replaceToElementColor(textData);
    debugPrint("After: $textData");

    var textSplit = textData.split('§');
    var textElements = <TextSpan>[];

    for (var i = 0; i < textSplit.length; i++) {
      var txt = textSplit[i];
      if (i == 0) {
        textElements.add(
          TextSpan(text: txt.replaceAll('\\n', '\n')),
        ); // Presume default
      } else {
        var effect = txt[0];
        if (effect.toLowerCase() == 'r') {
          textElements
              .add(TextSpan(text: txt.substring(1).replaceAll('\\n', '\n')));
        } else {
          textElements.add(TextSpan(
            text: txt.substring(1).replaceAll('\\n', '\n'),
            style: TextStyle(
              color: GridUtils.getElementalColor(effect),
              fontFamily: 'Product-Sans-Bold',
            ),
          ));
        }
      }
    }

    return Text.rich(TextSpan(children: textElements));
  }

  static List<Widget> getAscensionMaterialDataWidgets(
    int? qty,
    String? name,
    Map<String, MaterialDataCommon>? data,
  ) {
    return [
      getAscensionImage(name, data),
      Text((qty == 0) ? '' : qty.toString()),
      const Spacer(),
    ];
  }

  static List<Widget> generateCoWGridWidgets(
    String title,
    List<String>? names,
    String type,
    String? name,
    bool isPortrait,
  ) {
    var widgets = <Widget>[];
    widgets.add(
      Padding(
        padding: const EdgeInsets.only(left: 8),
        child: Text(
          title.toString(),
          style: const TextStyle(fontSize: 20),
        ),
      ),
    );
    var wid = GridData._getCharacterOrWeaponGrid(
      names,
      type,
      name,
      isPortrait,
    );
    if (wid == null) {
      widgets.removeLast(); // Remove title and skip
    } else {
      widgets.add(wid);
      widgets.add(const Padding(padding: EdgeInsets.only(top: 10)));
    }

    return widgets;
  }

  static Widget? _getCharacterOrWeaponGrid(
    List<String>? names,
    String type,
    String? name,
    bool isPortrait,
  ) {
    if (names == null || names.isEmpty) {
      return const SizedBox.shrink();
    }

    var characterData = _retrieveStaticDataQuick('characters') as Map<String, CharacterData>?;
    var weaponData = _retrieveStaticDataQuick('weapons') as Map<String, WeaponData>?;

    List<MapEntry<String, CommonData?>> gridEntries = [];
    gridEntries = type == 'characters'
        ? names.map((e) => MapEntry(e, characterData![e])).toList()
        : names.map((e) => MapEntry(e, weaponData![e])).toList();

    var oldCnt = gridEntries.length;
    gridEntries.removeWhere(
      (element) => element.value == null,
    ); // Remove null characters
    var newCnt = gridEntries.length;

    debugPrint('Removed ${oldCnt - newCnt} null entries');

    if (oldCnt != newCnt) {
      FirebaseCrashlytics.instance.printError(
        info:
            "ERR: Mismatched length for $name. Please check list here: $gridEntries",
      );
    }

    debugPrint("GridLen: ${gridEntries.length}");

    if (gridEntries.isEmpty) {
      // Nothing, return nothing
      return null;
    }

    return Flexible(
      child: GridView.count(
        physics: const NeverScrollableScrollPhysics(),
        shrinkWrap: true,
        crossAxisCount: (isPortrait) ? 3 : 6,
        children: gridEntries.map((entry) {
          return GestureDetector(
            onTap: () => Get.toNamed('/$type/${entry.key}'),
            child: GridData.getGridData(entry.value!),
          );
        }).toList(),
      ),
    );
  }

  static Future<Map<String, CommonData>?> _retrieveStaticData(
    String type,
  ) async {
    if (_downloading.containsKey(type) && _downloading[type]!) {
      // Wait for processing to end
      return Future.delayed(
        const Duration(seconds: 1),
        () => _retrieveStaticData(type),
      );
    }
    if (!_staticData.containsKey(type)) {
      _downloading[type] = true;
      debugPrint('Retrieving $type static data from Firestore');
      var snapshot = await _db.collection(type).get();
      _downloading[type] = false;
      setStaticData(type, snapshot);
    }

    return _staticData[type];
  }

  static Map<String, CommonData>? _retrieveStaticDataQuick(String type) {
    return _staticData[type];
  }

  static ImageProvider _getFirebaseImage(String? url) {
    return ((kIsWeb) ? CachedNetworkImageProvider(url!) : FirebaseImage(url!))
        as ImageProvider<Object>;
  }
}

class GridUtils {
  static Color getRarityColor(int? rarity, {crossover = false}) {
    if (crossover) {
      return const Color(0xFFb73b47);
    }
    switch (rarity) {
      case 1:
        return const Color(0xFF72778b);
      case 2:
        return const Color(0xFF2a9072);
      case 3:
        return const Color(0xFF5180cc);
      case 4:
        return const Color(0xFFa256e1);
      case 5:
        return const Color(0xFFbd6932);
      default:
        return Colors.black;
    }
  }

  static String? getElementImageRef(String element) {
    switch (element.toLowerCase()) {
      case 'geo':
        return 'assets/images/elements/Element_Geo.svg';
      case 'anemo':
        return 'assets/images/elements/Element_Anemo.svg';
      case 'cryo':
        return 'assets/images/elements/Element_Cryo.svg';
      case 'dendro':
        return 'assets/images/elements/Element_Dendro.svg';
      case 'electro':
        return 'assets/images/elements/Element_Electro.svg';
      case 'hydro':
        return 'assets/images/elements/Element_Hydro.svg';
      case 'pyro':
        return 'assets/images/elements/Element_Pyro.svg';
    }

    return null;
  }

  static String getDayString(int day) {
    switch (day) {
      case 1:
        return 'Mon';
      case 2:
        return 'Tue';
      case 3:
        return 'Wed';
      case 4:
        return 'Thu';
      case 5:
        return 'Fri';
      case 6:
        return 'Sat';
      case 7:
        return 'Sun';
    }

    return 'Unknown';
  }

  static String getRomanNumberArray(int number) {
    switch (number) {
      case 0:
        return 'I';
      case 1:
        return 'II';
      case 2:
        return 'III';
      case 3:
        return 'IV';
      case 4:
        return 'V';
      case 5:
        return 'VI';
      case 6:
        return 'VII';
      case 7:
        return 'VIII';
      case 8:
        return 'IX';
      case 9:
        return 'X';
      case 10:
        return 'XI';
      case -1:
        return ''; // Disabled
      default:
        return (number + 1).toString();
    }
  }

  static Color getElementalColor(String colorChar) {
    var color = Colors.white;
    var isDarkMode = Util.themeNotifier.isDarkMode();
    switch (colorChar.toLowerCase()) {
      case 'a':
        color =
            (isDarkMode) ? const Color(0xFF6addbe) : const Color(0xFF26A684);
        break;
      case 'c':
        color =
            (isDarkMode) ? const Color(0xFF8eaece) : const Color(0xFF4878a8);
        break;
      case 'd':
        color =
            (isDarkMode) ? const Color(0xFFa0e938) : const Color(0xFF51810e);
        break;
      case 'e':
        color =
            (isDarkMode) ? const Color(0xFFc27ed8) : const Color(0xFF9336b0);
        break;
      case 'g':
        color =
            (isDarkMode) ? const Color(0xFFf8b746) : const Color(0xFFb67607);
        break;
      case 'h':
        color =
            (isDarkMode) ? const Color(0xFF5e8ff7) : const Color(0xFF0b4dda);
        break;
      case 'p':
        color =
            (isDarkMode) ? const Color(0xFFeb6f62) : const Color(0xFFbf2818);
        break;
      default:
        color = (isDarkMode) ? Colors.white : Colors.black;
        break;
    }

    return color;
  }

  static String replaceToElementColor(String textData) {
    // Effects
    textData = textData.replaceAll('Vaporize', '§pVaporize§r');
    textData = textData.replaceAll('Overloaded', '§pOverloaded§r');
    textData = textData.replaceAll('Melt', '§pMelt§r');
    textData = textData.replaceAll('Burning', '§pBurning§r');
    textData = textData.replaceAll('Frozen', '§cFrozen§r');
    textData = textData.replaceAll('Bloom', '§dBloom§r');
    textData = textData.replaceAll('Superconduct', '§eSuperconduct§r');
    textData = textData.replaceAll('Aggravate', '§eAggravate§r');
    textData = textData.replaceAll('Hyperbloom', '§eHyperbloom§r');
    textData = textData.replaceAll('Super-conduct', '§eSuper-conduct§r');
    textData = textData.replaceAll('Quicken', '§dQuicken§r');
    textData = textData.replaceAll('Swirl', '§aSwirl§r');
    textData = textData.replaceAll('Crystallize', '§gCrystallize§r');

    // Elements
    textData = textData.replaceAll('Anemo', '§aAnemo§r');
    textData = textData.replaceAll('Cryo', '§cCryo§r');
    textData = textData.replaceAll('Dendro', '§dDendro§r');
    textData = textData.replaceAll('Electro', '§eElectro§r');
    textData = textData.replaceAll('Geo', '§gGeo§r');
    textData = textData.replaceAll('Hydro', '§hHydro§r');
    textData = textData.replaceAll('Pyro', '§pPyro§r');

    // Specials
    textData = textData.replaceAll('§hHydro§r-infused', '§hHydro-infused§r');
    textData =
        textData.replaceAll('§eElectro§r-Charged', '§eElectro-Charged§r');

    // DMG
    textData = textData.replaceAll('§aAnemo§r DMG', '§aAnemo DMG§r');
    textData = textData.replaceAll('§cCryo§r DMG', '§cCryo DMG§r');
    textData = textData.replaceAll('§dDendro§r DMG', '§dDendro DMG§r');
    textData = textData.replaceAll('§eElectro§r DMG', '§eElectro DMG§r');
    textData = textData.replaceAll('§gGeo§r DMG', '§gGeo DMG§r');
    textData = textData.replaceAll('§hHydro§r DMG', '§hHydro DMG§r');
    textData = textData.replaceAll('§pPyro§r DMG', '§pPyro DMG§r');

    textData = textData.replaceAll('AoE §aAnemo DMG§r', '§aAoE Anemo DMG§r');
    textData = textData.replaceAll('AoE §cCryo DMG§r', '§cAoE Cryo DMG§r');
    textData = textData.replaceAll('AoE §dDendro DMG§r', '§dAoE Dendro DMG§r');
    textData =
        textData.replaceAll('AoE §eElectro DMG§r', '§eAoE Electro DMG§r');
    textData = textData.replaceAll('AoE §gGeo DMG§r', '§gAoE Geo DMG§r');
    textData = textData.replaceAll('AoE §hHydro DMG§r', '§hAoE Hydro DMG§r');
    textData = textData.replaceAll('AoE §pPyro DMG§r', '§pAoE Pyro DMG§r');

    return textData;
  }
}
