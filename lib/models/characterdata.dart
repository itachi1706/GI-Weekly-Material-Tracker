import 'package:gi_weekly_material_tracker/models/commondata.dart';

class CharacterData extends CommonData {
  String? affiliation;
  String? birthday;
  String? constellation;
  String? caption;
  String? element;
  String? fullName;
  String? gender;
  String? genshinGGPath;
  String? paimonMoePath;
  String? introduction;
  String? nation;
  String? weapon;
  Map<String, CharacterAscension>? ascension;
  Map<int, CharacterConstellations>? constellations;
  CharacterTalent? talent;

  CharacterData({
    this.affiliation,
    this.birthday,
    this.caption,
    this.constellation,
    description,
    this.element,
    this.gender,
    this.genshinGGPath,
    this.paimonMoePath,
    image,
    this.introduction,
    name,
    this.nation,
    rarity,
    this.weapon,
    this.ascension,
    this.talent,
    this.constellations,
    this.fullName,
    crossover,
    wiki,
    released,
  }) : super(
          image: image,
          name: name,
          rarity: rarity,
          description: description,
          wiki: wiki,
          crossover: crossover,
          released: released,
        );

  factory CharacterData.fromJson(Map<String, dynamic> parsedJson) {
    return CharacterData(
      image: parsedJson['image'],
      gender: parsedJson['gender'] ?? 'Unknown Gender',
      birthday: parsedJson['birthday'] ?? 'Unknown',
      name: parsedJson['name'],
      description: parsedJson['description'] ?? 'Unknown Description',
      nation: parsedJson['nation'] ?? 'Somewhere on Teyvat',
      weapon: parsedJson['weapon'] ?? 'Unknown Weapon',
      rarity: parsedJson['rarity'],
      affiliation: parsedJson['affiliation'] ?? 'Unknown Affiliation',
      constellation: parsedJson['constellation'] ?? 'Unknown Constellation',
      introduction: parsedJson['introduction'] ?? 'Unknown Introduction',
      genshinGGPath: parsedJson['genshinggpath'],
      paimonMoePath: parsedJson['paimonmoepath'],
      element: parsedJson['element'],
      wiki: parsedJson['wiki'],
      ascension: CharacterAscension.getFromMap(parsedJson['ascension']),
      talent: CharacterTalent.getFromMap(
        parsedJson['talents'],
      ),
      constellations: CharacterConstellations.getFromMap(
        parsedJson['constellations'],
      ),
      caption: parsedJson['caption'] ?? 'Unknown Caption',
      fullName: parsedJson['fullName'],
      crossover: parsedJson['crossover'] ?? false,
      released: parsedJson['released'],
    );
  }

  static Map<String, CharacterData> getList(Map<String, dynamic> listString) {
    var _fin = <String, CharacterData>{};
    listString.forEach((key, value) {
      _fin.putIfAbsent(key, () => CharacterData.fromJson(value));
    });

    return _fin;
  }
}

class CharacterAscension extends CommonAscension {
  String? material4;
  int? material4Qty;

  CharacterAscension({
    level,
    material1,
    material1Qty,
    material2,
    material2Qty,
    material3,
    material3Qty,
    this.material4,
    this.material4Qty,
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

  factory CharacterAscension.fromJson(Map<String, dynamic> parsedJson) {
    return CharacterAscension(
      material2Qty: parsedJson['material2qty'],
      material1: parsedJson['material1'],
      material1Qty: parsedJson['material1qty'],
      mora: parsedJson['mora'],
      material2: parsedJson['material2'],
      level: parsedJson['level'],
      material4: parsedJson['material4'],
      material4Qty: parsedJson['material4qty'],
      material3Qty: parsedJson['material3qty'],
      material3: parsedJson['material3'],
    );
  }

  static Map<String, CharacterAscension> getFromMap(
    Map<String, dynamic> ascend,
  ) {
    var _fin = <String, CharacterAscension>{};
    if (ascend.containsKey('1')) {
      _fin.putIfAbsent('1', () => CharacterAscension.fromJson(ascend['1']));
    }
    if (ascend.containsKey('2')) {
      _fin.putIfAbsent('2', () => CharacterAscension.fromJson(ascend['2']));
    }
    if (ascend.containsKey('3')) {
      _fin.putIfAbsent('3', () => CharacterAscension.fromJson(ascend['3']));
    }
    if (ascend.containsKey('4')) {
      _fin.putIfAbsent('4', () => CharacterAscension.fromJson(ascend['4']));
    }
    if (ascend.containsKey('5')) {
      _fin.putIfAbsent('5', () => CharacterAscension.fromJson(ascend['5']));
    }
    if (ascend.containsKey('6')) {
      _fin.putIfAbsent('6', () => CharacterAscension.fromJson(ascend['6']));
    }

    return _fin;
  }
}

class CharacterTalent {
  Map<String, CharacterAscension>? ascension;
  Map<String, TalentInfo>? attack;
  Map<String, TalentInfo>? passive;

  CharacterTalent({this.ascension, this.attack, this.passive});

  static CharacterTalent getFromMap(Map<String, dynamic> ascend) {
    return CharacterTalent(
      ascension: getAscensionFromMap(ascend['ascension']),
      attack: TalentInfo.getFromMap(ascend['attack']),
      passive: TalentInfo.getFromMap(ascend['passives']),
    );
  }

  static Map<String, CharacterAscension> getAscensionFromMap(
    Map<String, dynamic> ascend,
  ) {
    var _fin = <String, CharacterAscension>{};
    if (ascend.containsKey('2')) {
      _fin.putIfAbsent('2', () => CharacterAscension.fromJson(ascend['2']));
    }
    if (ascend.containsKey('3')) {
      _fin.putIfAbsent('3', () => CharacterAscension.fromJson(ascend['3']));
    }
    if (ascend.containsKey('4')) {
      _fin.putIfAbsent('4', () => CharacterAscension.fromJson(ascend['4']));
    }
    if (ascend.containsKey('5')) {
      _fin.putIfAbsent('5', () => CharacterAscension.fromJson(ascend['5']));
    }
    if (ascend.containsKey('6')) {
      _fin.putIfAbsent('6', () => CharacterAscension.fromJson(ascend['6']));
    }
    if (ascend.containsKey('7')) {
      _fin.putIfAbsent('7', () => CharacterAscension.fromJson(ascend['7']));
    }
    if (ascend.containsKey('8')) {
      _fin.putIfAbsent('8', () => CharacterAscension.fromJson(ascend['8']));
    }
    if (ascend.containsKey('9')) {
      _fin.putIfAbsent('9', () => CharacterAscension.fromJson(ascend['9']));
    }
    if (ascend.containsKey('10')) {
      _fin.putIfAbsent(
        '10',
        () => CharacterAscension.fromJson(ascend['10']),
      );
    }

    return _fin;
  }
}

class TalentInfo {
  String? name;
  String? effect;
  String? image;
  String? type;
  int? order;

  TalentInfo({this.name, this.effect, this.image, this.type, this.order});

  factory TalentInfo.fromJson(Map<String, dynamic> parsedJson) {
    return TalentInfo(
      name: parsedJson['name'] ?? 'Unknown Talent Name',
      effect: parsedJson['effect'] ?? 'Unknown Talent Effect',
      image: parsedJson['image'],
      type: parsedJson['type'],
      order: parsedJson['order'],
    );
  }

  static Map<String, TalentInfo> getFromMap(Map<String, dynamic> data) {
    var _fin = <String, TalentInfo>{};
    data.forEach((key, value) =>
        _fin.putIfAbsent(key, () => TalentInfo.fromJson(value)));

    return _fin;
  }
}

class CharacterConstellations {
  String? name;
  String? image;
  String? effect;

  CharacterConstellations({this.name, this.image, this.effect});

  factory CharacterConstellations.fromJson(Map<String, dynamic> parsedJson) {
    return CharacterConstellations(
      name: parsedJson['name'] ?? 'Unknown Constellation',
      image: parsedJson['image'],
      effect: parsedJson['effect'] ?? 'Unknown Effect',
    );
  }

  static Map<int, CharacterConstellations> getFromMap(
    Map<String, dynamic> data,
  ) {
    var _fin = <int, CharacterConstellations>{};
    data.forEach((key, value) {
      _fin.putIfAbsent(
        int.tryParse(key) ?? 0,
        () => CharacterConstellations.fromJson(value),
      );
    });

    return _fin;
  }
}
