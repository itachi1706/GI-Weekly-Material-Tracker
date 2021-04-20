class PromoCode {
  int datetime;
  String date;
  String euCode;
  String asiaCode;
  String naCode;
  String reward;
  bool expired;

  PromoCode({
    this.datetime,
    this.date,
    this.euCode,
    this.asiaCode,
    this.naCode,
    this.reward,
    this.expired,
  });

  factory PromoCode.fromJson(Map<String, dynamic> parsedJson) {
    return PromoCode(
      datetime: parsedJson['date'],
      date: parsedJson['dateString'],
      euCode: parsedJson['eu'],
      asiaCode: parsedJson['asia'],
      naCode: parsedJson['na'],
      reward: parsedJson['reward'],
      expired: parsedJson['expired'],
    );
  }

  static List<PromoCode> fromDB(Map<String, dynamic> dbString) {
    var finalList = <PromoCode>[];
    dbString.forEach((key, value) => finalList.add(PromoCode.fromJson(Map<String, dynamic>.from(value))));

    return finalList;
  }

  @override
  String toString() {
    return 'PromoCode{ date: $date, datetime: $datetime, asia: $asiaCode, eu: $euCode, na: $naCode, reward: $reward, expired: $expired }';
  }
}
