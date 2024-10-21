import 'package:gi_weekly_material_tracker/models/commondata.dart';

class WeaponData extends CommonData {
  String? secondaryStat;
  String? secondaryStatType;
  String? type;
  int? baseAtk;
  String? obtained;
  String? effectName;
  String? effect;
  int? maxBaseAtk;
  String? maxSecondaryStat;
  String? series;
  Map<String, WeaponAscension>? ascension;

  // Time since last banner
  int? lastBannerCount;
  DateTime? lastBannerEnd;
  String? lastBannerName;

  WeaponData({
    this.secondaryStat,
    this.secondaryStatType,
    this.type,
    super.description,
    this.baseAtk,
    this.obtained,
    this.effect,
    this.effectName,
    super.image,
    super.name,
    super.rarity,
    super.wiki,
    this.maxBaseAtk,
    this.maxSecondaryStat,
    this.ascension,
    this.series,
    this.lastBannerCount,
    this.lastBannerEnd,
    this.lastBannerName,
    super.released,
  }) : super();

  factory WeaponData.fromJson(Map<String, dynamic> parsedJson) {
    return WeaponData(
      image: parsedJson['image'],
      name: parsedJson['name'],
      description: parsedJson['description'] ?? 'Unknown Description',
      secondaryStatType: parsedJson['secondary_stat_type'],
      secondaryStat: parsedJson['secondary_stat'],
      type: parsedJson['type'],
      baseAtk: parsedJson['base_atk'],
      obtained: parsedJson['obtained'],
      effect: parsedJson['effect'] ?? 'Unknown Effect',
      rarity: parsedJson['rarity'],
      wiki: parsedJson['wiki'],
      maxBaseAtk: parsedJson['max_base_atk'],
      maxSecondaryStat: parsedJson['max_secondary_stat'],
      ascension: WeaponAscension.getFromMap(parsedJson['ascension'], parsedJson['materials']),
      effectName: parsedJson['effectName'],
      series: parsedJson['series'],
      released: parsedJson['released'],
      lastBannerCount: parsedJson['banners_since_last_appearance'],
      lastBannerEnd: parsedJson['date_since_last_appearance'] != null
          ? DateTime.parse(parsedJson['date_since_last_appearance'])
          : null,
      lastBannerName:
          parsedJson['banners_since_last_appearance_name'] ?? 'Unknown Banner',
    );
  }

  static Map<String, WeaponData> getList(Map<String, dynamic> listString) {
    var fin = <String, WeaponData>{};
    listString.forEach((key, value) {
      fin.putIfAbsent(key, () => WeaponData.fromJson(value));
    });

    return fin;
  }
}

class WeaponAscension extends CommonAscension {
  WeaponAscension({
    super.level,
    super.material1,
    super.material1Qty,
    super.material2,
    super.material2Qty,
    super.material3,
    super.material3Qty,
    super.mora,
  }) : super();

  factory WeaponAscension.fromJson(Map<String, dynamic> parsedJson, Map<String, dynamic> materialJson) {
    return WeaponAscension(
      material2Qty: parsedJson['material2qty'],
      material1: materialJson[parsedJson['material1type']],
      material1Qty: parsedJson['material1qty'],
      mora: parsedJson['mora'],
      material2: materialJson[parsedJson['material2type']],
      level: parsedJson['level'],
      material3Qty: parsedJson['material3qty'],
      material3: materialJson[parsedJson['material3type']],
    );
  }

  static Map<String, WeaponAscension> getFromMap(Map<String, dynamic> ascend, Map<String, dynamic> materials) {
    var fin = <String, WeaponAscension>{};
    // Iterate through all ascend keys
    for (var key in ascend.keys) {
      fin.putIfAbsent(key, () => WeaponAscension.fromJson(ascend[key], materials['ascension']));
    }

    return fin;
  }
}
