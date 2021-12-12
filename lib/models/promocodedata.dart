class PromoCode {
  int? datetime;
  String? date;
  String? euCode;
  String? asiaCode;
  String? naCode;
  String reward;
  String? url;
  String? expiryString;
  String? typeStr;
  bool isCode;
  bool expired;

  PromoCode({
    this.datetime,
    this.date,
    this.euCode,
    this.asiaCode,
    this.naCode,
    required this.reward,
    required this.expired,
    this.url,
    this.expiryString,
    this.typeStr,
    required this.isCode,
  });

  factory PromoCode.fromJson(Map<dynamic, dynamic> parsedJson) {
    return parsedJson['type'] == null || parsedJson['type'] == 'code'
        ? PromoCode(
            datetime: parsedJson['date'],
            date: parsedJson['dateString'],
            euCode: parsedJson['eu'],
            asiaCode: parsedJson['asia'],
            naCode: parsedJson['na'],
            isCode: true,
            reward: parsedJson['reward'] ?? 'Unknown',
            expired: parsedJson['expired'] ?? false,
          )
        : PromoCode(
            datetime: parsedJson['date'],
            date: parsedJson['dateString'],
            url: parsedJson['url'],
            expiryString: parsedJson['expiry'],
            typeStr: parsedJson['type'],
            isCode: false,
            reward: parsedJson['reward'] ?? 'Unknown',
            expired: parsedJson['expired'] ?? false,
          );
  }

  static List<PromoCode> fromDB(Map<String, dynamic> dbString) {
    var finalList = <PromoCode>[];
    dbString.forEach((key, value) =>
        finalList.add(PromoCode.fromJson(Map<String, dynamic>.from(value))));

    return finalList;
  }

  @override
  String toString() {
    return 'PromoCode{ date: $date, datetime: $datetime, asia: $asiaCode, eu: $euCode, na: $naCode, reward: $reward, expired: $expired, type: $typeStr, url: $url, expiry: $expiryString }';
  }
}
