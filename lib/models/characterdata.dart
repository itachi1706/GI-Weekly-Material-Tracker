class CharacterData {
  String affiliation;
  String birthday;
  String constellation;
  String description;
  String element;
  String gender;
  String genshinGGPath;
  String image;
  String introduction;
  String name;
  String nation;
  int rarity;
  String weapon;
  Map<String, CharacterAscension> ascension;

  CharacterData(
      {this.affiliation,
      this.birthday,
      this.constellation,
      this.description,
      this.element,
      this.gender,
      this.genshinGGPath,
      this.image,
      this.introduction,
      this.name,
      this.nation,
      this.rarity,
      this.weapon,
      this.ascension});

  factory CharacterData.fromJson(Map<String, dynamic> parsedJson) {
    return CharacterData(
      image: parsedJson['image'],
      gender: parsedJson['gender'],
      birthday: parsedJson['birthday'],
      name: parsedJson['name'],
      description: parsedJson['description'],
      nation: parsedJson['nation'],
      weapon: parsedJson['weapon'],
      rarity: parsedJson['rarity'],
      affiliation: parsedJson['affiliation'],
      constellation: parsedJson['constellation'],
      introduction: parsedJson['introduction'],
      genshinGGPath: parsedJson['genshinggpath'],
      element: parsedJson['element'],
      ascension: CharacterAscension.getFromMap(parsedJson['ascension']),
    );
  }
}

class CharacterAscension {
  int level;
  String material1;
  int material1Qty;
  String material2;
  int material2Qty;
  String material3;
  int material3Qty;
  String material4;
  int material4Qty;
  int mora;

  CharacterAscension(
      {this.level,
      this.material1,
      this.material1Qty,
      this.material2,
      this.material2Qty,
      this.material3,
      this.material3Qty,
      this.material4,
      this.material4Qty,
      this.mora});

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
      Map<String, dynamic> ascend) {
    Map<String, CharacterAscension> _fin = new Map();
    if (ascend.containsKey("1"))
      _fin.putIfAbsent("1", () => new CharacterAscension.fromJson(ascend['1']));
    if (ascend.containsKey("2"))
      _fin.putIfAbsent("2", () => new CharacterAscension.fromJson(ascend['2']));
    if (ascend.containsKey("3"))
      _fin.putIfAbsent("3", () => new CharacterAscension.fromJson(ascend['3']));
    if (ascend.containsKey("4"))
      _fin.putIfAbsent("4", () => new CharacterAscension.fromJson(ascend['4']));
    if (ascend.containsKey("5"))
      _fin.putIfAbsent("5", () => new CharacterAscension.fromJson(ascend['5']));
    if (ascend.containsKey("6"))
      _fin.putIfAbsent("6", () => new CharacterAscension.fromJson(ascend['6']));
    return _fin;
  }
}
