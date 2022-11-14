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
    description,
    this.baseAtk,
    this.obtained,
    this.effect,
    this.effectName,
    image,
    name,
    rarity,
    wiki,
    this.maxBaseAtk,
    this.maxSecondaryStat,
    this.ascension,
    this.series,
    this.lastBannerCount,
    this.lastBannerEnd,
    this.lastBannerName,
    released,
  }) : super(
          image: image,
          name: name,
          rarity: rarity,
          description: description,
          wiki: wiki,
          released: released,
        );

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
      ascension: WeaponAscension.getFromMap(parsedJson['ascension']),
      effectName: parsedJson['effectName'],
      series: parsedJson['series'],
      released: parsedJson['released'],
      lastBannerCount: parsedJson['banners_since_last_appearance'],
      lastBannerEnd: parsedJson['date_since_last_appearance'] != null ? DateTime.parse(parsedJson['date_since_last_appearance']) : null,
      lastBannerName: parsedJson['banners_since_last_appearance_name'] ?? 'Unknown Banner',
    );
  }

  static Map<String, WeaponData> getList(Map<String, dynamic> listString) {
    var _fin = <String, WeaponData>{};
    listString.forEach((key, value) {
      _fin.putIfAbsent(key, () => WeaponData.fromJson(value));
    });

    return _fin;
  }
}

class WeaponAscension extends CommonAscension {
  WeaponAscension({
    level,
    material1,
    material1Qty,
    material2,
    material2Qty,
    material3,
    material3Qty,
    mora,
  }) : super(
          level: level,
          mora: mora,
          material1: material1,
          material1Qty: material1Qty,
          material2: material2,
          material2Qty: material2Qty,
          material3: material3,
          material3Qty: material3Qty,
        );

  factory WeaponAscension.fromJson(Map<String, dynamic> parsedJson) {
    return WeaponAscension(
      material2Qty: parsedJson['material2qty'],
      material1: parsedJson['material1'],
      material1Qty: parsedJson['material1qty'],
      mora: parsedJson['mora'],
      material2: parsedJson['material2'],
      level: parsedJson['level'],
      material3Qty: parsedJson['material3qty'],
      material3: parsedJson['material3'],
    );
  }

  static Map<String, WeaponAscension> getFromMap(Map<String, dynamic> ascend) {
    var _fin = <String, WeaponAscension>{};
    if (ascend.containsKey('1')) {
      _fin.putIfAbsent('1', () => WeaponAscension.fromJson(ascend['1']));
    }
    if (ascend.containsKey('2')) {
      _fin.putIfAbsent('2', () => WeaponAscension.fromJson(ascend['2']));
    }
    if (ascend.containsKey('3')) {
      _fin.putIfAbsent('3', () => WeaponAscension.fromJson(ascend['3']));
    }
    if (ascend.containsKey('4')) {
      _fin.putIfAbsent('4', () => WeaponAscension.fromJson(ascend['4']));
    }
    if (ascend.containsKey('5')) {
      _fin.putIfAbsent('5', () => WeaponAscension.fromJson(ascend['5']));
    }
    if (ascend.containsKey('6')) {
      _fin.putIfAbsent('6', () => WeaponAscension.fromJson(ascend['6']));
    }

    return _fin;
  }
}
