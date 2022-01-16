class BannerData {
  String name;
  String start;
  String end;
  String description;
  String type;
  List<String> characters;
  List<String> weapons;
  List<String> rateUpCharacters;
  List<String> rateUpWeapons;
  int softPity;
  int hardPity;
  String? wiki;
  String? image;

  BannerData({
    required this.name,
    required this.start,
    required this.end,
    required this.description,
    required this.type,
    required this.characters,
    required this.weapons,
    required this.rateUpCharacters,
    required this.rateUpWeapons,
    required this.softPity,
    required this.hardPity,
    this.wiki,
    this.image,
  });

  factory BannerData.fromJson(Map<dynamic, dynamic> parsedJson) {
    List<String> char = parsedJson['characters']
            ?.map((s) => s.toString())
            .toList()
            .cast<String>() ??
        [];
    List<String> weap = parsedJson['weapons']
            ?.map((s) => s.toString())
            .toList()
            .cast<String>() ??
        [];
    List<String> ruChar = parsedJson['rateupcharacters']
            ?.map((s) => s.toString())
            .toList()
            .cast<String>() ??
        [];
    List<String> ruWeap = parsedJson['rateupweapon']
            ?.map((s) => s.toString())
            .toList()
            .cast<String>() ??
        [];

    return BannerData(
      name: parsedJson['name'],
      start: parsedJson['start'],
      end: parsedJson['end'],
      description: parsedJson['description'],
      type: parsedJson['type'],
      characters: char,
      weapons: weap,
      rateUpCharacters: ruChar,
      rateUpWeapons: ruWeap,
      softPity: parsedJson['softpity'],
      hardPity: parsedJson['hardpity'],
      wiki: parsedJson['wiki'],
      image: parsedJson['image'],
    );
  }
}
