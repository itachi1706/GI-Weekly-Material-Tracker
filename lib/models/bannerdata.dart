import 'package:timezone/data/latest.dart' as tz;
import 'package:timezone/timezone.dart' as tz;

class BannerData {
  String name;
  DateTime start;
  DateTime end;
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
  String key;

  BannerStatus status = BannerStatus.unknown;

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
    required this.status,
    required this.key,
    this.wiki,
    this.image,
  });

  factory BannerData.fromJson(Map<dynamic, dynamic> parsedJson, String key) {
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

    var start = DateTime.parse(parsedJson['start']);
    var end = DateTime.parse(parsedJson['end']);
    var curDt = tz.TZDateTime.now(tz.getLocation('Asia/Singapore')).toUtc();
    BannerStatus status = BannerStatus.unknown;
    if (curDt.isBefore(start)) {
      // Upcoming as current time is before start time
      status = BannerStatus.upcoming;
    } else if (curDt.isAfter(end)) {
      // Expired as current time is after start time and end time
      status = BannerStatus.ended;
    } else {
      // Present as current time is after start time and before end time
      status = BannerStatus.current;
    }

    return BannerData(
      name: parsedJson['name'],
      start: DateTime.parse(parsedJson['start']),
      end: DateTime.parse(parsedJson['end']),
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
      key: key,
      status: status,
    );
  }
}

enum BannerStatus {
  upcoming,
  current,
  ended,
  unknown,
}