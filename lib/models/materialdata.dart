import 'package:gi_weekly_material_tracker/models/commondata.dart';

class MaterialDataCommon extends CommonData {
  String? type;
  String? innerType;
  String? obtained;

  MaterialDataUsage? usage;

  MaterialDataCommon({
    super.image,
    super.rarity,
    this.type,
    this.innerType,
    super.name,
    super.description,
    super.wiki,
    this.obtained,
    this.usage,
    super.released,
  }) : super();

  factory MaterialDataCommon.fromJson(Map<String, dynamic> parsedJson) {
    return MaterialDataCommon(
      image: parsedJson['image'],
      rarity: parsedJson['rarity'],
      type: parsedJson['type'],
      innerType: parsedJson['innerType'],
      name: parsedJson['name'],
      description: parsedJson['description'],
      wiki: parsedJson['wiki'],
      obtained: parsedJson['obtained'],
      released: parsedJson['released'],
      usage: parsedJson['usage'] != null
          ? MaterialDataUsage.fromJson(parsedJson['usage'])
          : null,
    );
  }

  static Map<String, MaterialDataCommon> getList(
    Map<String, dynamic> listString,
  ) {
    var fin = <String, MaterialDataCommon>{};
    listString.forEach((key, value) {
      switch (value['innerType']) {
        case 'mob_drops':
          fin.putIfAbsent(key, () => MaterialDataMob.fromJson(value));
          break;
        case 'domain_material':
          fin.putIfAbsent(key, () => MaterialDataDomains.fromJson(value));
          break;
        default:
          fin.putIfAbsent(key, () => MaterialDataCommon.fromJson(value));
          break;
      }
    });

    return fin;
  }
}

class MaterialDataMob extends MaterialDataCommon {
  List<String>? enemies;

  MaterialDataMob({
    super.image,
    super.rarity,
    super.type,
    super.innerType,
    super.name,
    super.description,
    super.obtained,
    super.wiki,
    this.enemies,
    super.usage,
    super.released,
  }) : super();

  factory MaterialDataMob.fromJson(Map<String, dynamic> parsedJson) {
    return MaterialDataMob(
      image: parsedJson['image'],
      rarity: parsedJson['rarity'],
      type: parsedJson['type'],
      innerType: parsedJson['innerType'],
      name: parsedJson['name'],
      description: parsedJson['description'],
      obtained: parsedJson['obtained'],
      wiki: parsedJson['wiki'],
      enemies: (parsedJson['enemies'] as List<dynamic>)
          .map((e) => e.toString())
          .toSet()
          .toList(),
      released: parsedJson['released'],
      usage: parsedJson['usage'] != null
          ? MaterialDataUsage.fromJson(parsedJson['usage'])
          : null,
    );
  }
}

class MaterialDataDomains extends MaterialDataCommon {
  List<int>? days;

  MaterialDataDomains({
    super.image,
    super.rarity,
    super.type,
    super.innerType,
    super.name,
    super.description,
    super.obtained,
    super.wiki,
    this.days,
    super.usage,
    super.released,
  }) : super();

  factory MaterialDataDomains.fromJson(Map<String, dynamic> parsedJson) {
    return MaterialDataDomains(
      image: parsedJson['image'],
      rarity: parsedJson['rarity'],
      type: parsedJson['type'],
      innerType: parsedJson['innerType'],
      name: parsedJson['name'],
      description: parsedJson['description'],
      obtained: parsedJson['obtained'],
      wiki: parsedJson['wiki'],
      days: (parsedJson['days'] as List<dynamic>)
          .map((e) => int.tryParse(e.toString()) ?? 0)
          .toSet()
          .toList(),
      released: parsedJson['released'],
      usage: parsedJson['usage'] != null
          ? MaterialDataUsage.fromJson(parsedJson['usage'])
          : null,
    );
  }
}

class MaterialDataUsage {
  List<String>? characters;
  List<String>? weapons;

  MaterialDataUsage({
    this.characters,
    this.weapons,
  });

  factory MaterialDataUsage.fromJson(Map<String, dynamic> parsedJson) {
    return MaterialDataUsage(
      characters: (parsedJson['characters'] as List<dynamic>)
          .map((e) => e.toString())
          .toSet()
          .toList(),
      weapons: (parsedJson['weapons'] as List<dynamic>)
          .map((e) => e.toString())
          .toSet()
          .toList(),
    );
  }
}
