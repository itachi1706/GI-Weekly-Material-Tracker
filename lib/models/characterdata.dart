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
  List<String>? titles;
  List<String>? outfits;

  // Time since last banner
  int? lastBannerCount;
  DateTime? lastBannerEnd;
  String? lastBannerName;

  CharacterData({
    this.affiliation,
    this.birthday,
    this.caption,
    this.constellation,
    super.description,
    this.element,
    this.gender,
    this.genshinGGPath,
    this.paimonMoePath,
    super.image,
    this.introduction,
    super.name,
    this.nation,
    super.rarity,
    this.weapon,
    this.ascension,
    this.talent,
    this.constellations,
    this.fullName,
    this.titles,
    this.outfits,
    this.lastBannerCount,
    this.lastBannerEnd,
    this.lastBannerName,
    super.crossover,
    super.wiki,
    super.released,
  }) : super();

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
      ascension: CharacterAscension.getFromMap(
        parsedJson['ascension'],
        parsedJson['materials'],
      ),
      talent: CharacterTalent.getFromMap(
        parsedJson['talents'],
        parsedJson['materials'],
      ),
      constellations: CharacterConstellations.getFromMap(
        parsedJson['constellations'],
      ),
      caption: parsedJson['caption'] ?? 'Unknown Caption',
      fullName: parsedJson['fullName'],
      crossover: parsedJson['crossover'] ?? false,
      released: parsedJson['released'],
      titles: parsedJson['titles'] != null
          ? List<String>.from(parsedJson['titles'])
          : null,
      outfits: parsedJson['outfits'] != null
          ? List<String>.from(parsedJson['outfits'])
          : null,
      lastBannerCount: parsedJson['banners_since_last_appearance'],
      lastBannerEnd: parsedJson['date_since_last_appearance'] != null
          ? DateTime.parse(parsedJson['date_since_last_appearance'])
          : null,
      lastBannerName:
          parsedJson['banners_since_last_appearance_name'] ?? 'Unknown Banner',
    );
  }

  static Map<String, CharacterData> getList(Map<String, dynamic> listString) {
    var fin = <String, CharacterData>{};
    listString.forEach((key, value) {
      fin.putIfAbsent(key, () => CharacterData.fromJson(value));
    });

    return fin;
  }
}

class CharacterAscension extends CommonAscension {
  String? material4;
  int? material4Qty;

  CharacterAscension({
    super.level,
    super.material1,
    super.material1Qty,
    super.material2,
    super.material2Qty,
    super.material3,
    super.material3Qty,
    this.material4,
    this.material4Qty,
    super.mora,
  }) : super();

  factory CharacterAscension.fromJson(
    Map<String, dynamic> parsedJson,
    Map<String, dynamic> materialJson,
  ) {
    return CharacterAscension(
      material2Qty: parsedJson['material2qty'],
      material1: materialJson[parsedJson['material1type']],
      material1Qty: parsedJson['material1qty'],
      mora: parsedJson['mora'],
      material2: materialJson[parsedJson['material2type']],
      level: parsedJson['level'],
      material4: materialJson[parsedJson['material4type']],
      material4Qty: parsedJson['material4qty'],
      material3Qty: parsedJson['material3qty'],
      material3: materialJson[parsedJson['material3type']],
    );
  }

  static Map<String, CharacterAscension> getFromMap(
    Map<String, dynamic> ascend,
    Map<String, dynamic> materials,
  ) {
    var fin = <String, CharacterAscension>{};
    for (var key in ascend.keys) {
      fin.putIfAbsent(
        key,
        () => CharacterAscension.fromJson(ascend[key], materials['ascension']),
      );
    }

    return fin;
  }
}

class CharacterTalent {
  Map<String, CharacterAscension>? ascension;
  Map<String, TalentInfo>? attack;
  Map<String, TalentInfo>? passive;

  CharacterTalent({this.ascension, this.attack, this.passive});

  static CharacterTalent getFromMap(
    Map<String, dynamic> ascend,
    Map<String, dynamic> materials,
  ) {
    return CharacterTalent(
      ascension: getAscensionFromMap(ascend['ascension'], materials),
      attack: TalentInfo.getFromMap(ascend['attack']),
      passive: TalentInfo.getFromMap(ascend['passives']),
    );
  }

  static Map<String, CharacterAscension> getAscensionFromMap(
    Map<String, dynamic> ascend,
    Map<String, dynamic> materials,
  ) {
    var fin = <String, CharacterAscension>{};
    for (var key in ascend.keys) {
      fin.putIfAbsent(
        key,
        () => CharacterAscension.fromJson(ascend[key], materials['talents']),
      );
    }

    return fin;
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
    var fin = <String, TalentInfo>{};
    data.forEach(
      (key, value) => fin.putIfAbsent(key, () => TalentInfo.fromJson(value)),
    );

    return fin;
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
    var fin = <int, CharacterConstellations>{};
    data.forEach((key, value) {
      fin.putIfAbsent(
        int.tryParse(key) ?? 0,
        () => CharacterConstellations.fromJson(value),
      );
    });

    return fin;
  }
}
