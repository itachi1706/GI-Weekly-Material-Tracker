import 'package:gi_weekly_material_tracker/models/commondata.dart';

class OutfitData extends CommonData {
  List<String>? characters;
  String? gameImage;
  String? wishImage;
  String? model3D;
  String? obtained;
  String? lore;
  String? type;
  bool shop;
  int shopCost;
  int shopCostDiscounted;
  String? shopCostDiscountedTill;
  bool eventGiveFree;
  String? eventGiveFreeTill;
  double releasedVersion;

  OutfitData({
    this.characters,
    this.gameImage,
    this.wishImage,
    this.model3D,
    this.obtained,
    this.lore,
    this.type,
    this.shop = false,
    this.shopCost = 0,
    this.shopCostDiscounted = 0,
    this.shopCostDiscountedTill,
    this.eventGiveFree = false,
    this.eventGiveFreeTill,
    this.releasedVersion = 1.0,
    super.name,
    super.rarity,
    super.image,
    super.description,
    super.wiki,
    super.released,
  }) : super(
          crossover: false,
        );

  factory OutfitData.fromJson(Map<String, dynamic> json) {
    return OutfitData(
      characters: (json['characters'] != null)
          ? List<String>.from(json['characters'])
          : [],
      gameImage: json['image'],
      wishImage: json['wishimage'],
      model3D: json['3dmodel'],
      obtained: json['obtained'],
      lore: json['lore'],
      type: json['type'],
      shop: json['shop'],
      shopCost: json['shop_cost'],
      shopCostDiscounted: json['shop_cost_discounted'],
      shopCostDiscountedTill: json['shop_cost_discounted_till'],
      eventGiveFree: json['event_give_free'],
      eventGiveFreeTill: json['event_give_free_till'],
      name: json['name'],
      rarity: json['rarity'],
      image: json['thumbnail'],
      description: json['description'],
      wiki: json['wiki'],
      released: json['released'],
      releasedVersion: double.parse(json['released_version'].toString()),
    );
  }

  static Map<String, OutfitData> getList(Map<String, dynamic> listString) {
    var fin = <String, OutfitData>{};
    listString.forEach((key, value) {
      fin.putIfAbsent(key, () => OutfitData.fromJson(value));
    });

    return fin;
  }
}
