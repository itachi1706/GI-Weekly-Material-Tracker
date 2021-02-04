import 'package:gi_weekly_material_tracker/models/commondata.dart';

class MaterialDataCommon extends CommonData {
  String type;
  String innerType;
  String obtained;

  MaterialDataCommon(
      {image,
      rarity,
      this.type,
      this.innerType,
      name,
      description,
      wiki,
      this.obtained})
      : super(
            name: name,
            rarity: rarity,
            image: image,
            description: description,
            wiki: wiki);

  factory MaterialDataCommon.fromJson(Map<String, dynamic> parsedJson) {
    return MaterialDataCommon(
        image: parsedJson['image'],
        rarity: parsedJson['rarity'],
        type: parsedJson['type'],
        innerType: parsedJson['innerType'],
        name: parsedJson['name'],
        description: parsedJson['description'],
        wiki: parsedJson['wiki'],
        obtained: parsedJson['obtained']);
  }

  static Map<String, MaterialDataCommon> getList(
      Map<String, dynamic> listString) {
    Map<String, MaterialDataCommon> _fin = new Map();
    listString.forEach((key, value) {
      switch (value["innerType"]) {
        case "mob_drops":
          _fin.putIfAbsent(key, () => MaterialDataMob.fromJson(value));
          break;
        case "domain_material":
          _fin.putIfAbsent(key, () => MaterialDataDomains.fromJson(value));
          break;
        default:
          _fin.putIfAbsent(key, () => MaterialDataCommon.fromJson(value));
          break;
      }
    });
    return _fin;
  }
}

class MaterialDataMob extends MaterialDataCommon {
  List<String> enemies;

  MaterialDataMob(
      {image,
      rarity,
      type,
      innerType,
      name,
      description,
      obtained,
      wiki,
      this.enemies})
      : super(
            image: image,
            rarity: rarity,
            type: type,
            innerType: innerType,
            name: name,
            description: description,
            wiki: wiki,
            obtained: obtained);

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
            .toList());
  }
}

class MaterialDataDomains extends MaterialDataCommon {
  List<int> days;

  MaterialDataDomains(
      {image,
      rarity,
      type,
      innerType,
      name,
      description,
      obtained,
      wiki,
      this.days})
      : super(
            image: image,
            rarity: rarity,
            type: type,
            innerType: innerType,
            name: name,
            description: description,
            wiki: wiki,
            obtained: obtained);

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
            .toList());
  }
}
