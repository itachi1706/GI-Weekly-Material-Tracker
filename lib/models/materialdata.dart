class MaterialDataCommon {
  String image;
  int rarity;
  String type;
  String innerType;
  String description;
  String obtained;
  String name;

  MaterialDataCommon(
      {this.image,
      this.rarity,
      this.type,
      this.innerType,
      this.name,
      this.description,
      this.obtained});

  factory MaterialDataCommon.fromJson(Map<String, dynamic> parsedJson) {
    return MaterialDataCommon(
      image: parsedJson['image'],
      rarity: parsedJson['rarity'],
      type: parsedJson['type'],
      innerType: parsedJson['innerType'],
      name: parsedJson['name'],
      description: parsedJson['description'],
      obtained: parsedJson['obtained']
    );
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
      this.enemies})
      : super(
            image: image,
            rarity: rarity,
            type: type,
            innerType: innerType,
            name: name,
            description: description,
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
        enemies: parsedJson['enemies']
    );
  }
}

class MaterialDataDomains extends MaterialDataCommon {
  List<int> days;

  MaterialDataDomains(
      {image, rarity, type, innerType, name, description, obtained, this.days})
      : super(
            image: image,
            rarity: rarity,
            type: type,
            innerType: innerType,
            name: name,
            description: description,
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
        days: parsedJson['days']
    );
  }
}
