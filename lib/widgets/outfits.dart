import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:flutter_rating_bar/flutter_rating_bar.dart';
import 'package:get/get.dart';
import 'package:gi_weekly_material_tracker/helpers/grid.dart';
import 'package:gi_weekly_material_tracker/models/outfitdata.dart';
import 'package:gi_weekly_material_tracker/util.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import 'package:model_viewer_plus/model_viewer_plus.dart';

final FirebaseFirestore _db = FirebaseFirestore.instance;

class AllOutfitsPage extends StatelessWidget {
  const AllOutfitsPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('View All Outfits (ALPHA)')),
      body: const OutfitListGrid(),
    );
  }
}

class OutfitListGrid extends StatefulWidget {
  final String? character;

  const OutfitListGrid({super.key, this.character});

  @override
  OutfitListGridState createState() => OutfitListGridState();
}

class OutfitListGridState extends State<OutfitListGrid> {
  @override
  void initState() {
    super.initState();
  }

  @override
  Widget build(BuildContext context) {
    var outfitRef = _db.collection('outfits');
    Query? queryRef;
    if (widget.character != null) {
      // Get all outfits
      queryRef = outfitRef.where('character', isEqualTo: widget.character);
    }

    return StreamBuilder(
      stream: (queryRef == null) ? outfitRef.snapshots() : queryRef.snapshots(),
      builder: (context, AsyncSnapshot<QuerySnapshot> snapshot) {
        if (snapshot.hasError) {
          return const Text('Error occurred getting outfits');
        }

        if (snapshot.connectionState == ConnectionState.waiting) {
          return Util.centerLoadingCircle('Getting Outfits...');
        }

        if (widget.character == null) {
          GridData.setStaticData('outfits', snapshot.data);
        }

        var dt = GridData.getDataListFilteredRelease(snapshot.data!.docs);

        if (dt.isEmpty) {
          return Center(
            child: Text(
              'No outfits found ${(widget.character != null) ? 'for ${widget.character}' : ''}',
            ),
          );
        }

        return GridView.count(
          crossAxisCount:
              (MediaQuery.of(context).orientation == Orientation.portrait)
                  ? 3
                  : 6,
          children: dt.map((doc) {
            return GestureDetector(
              onTap: () => Get.toNamed('/outfits/${doc.id}'),
              child: GridData.getGridData(
                OutfitData.fromJson(doc.data() as Map<String, dynamic>),
              ),
            );
          }).toList(),
        );
      },
    );
  }
}

class OutfitInfoMainPage extends StatefulWidget {
  const OutfitInfoMainPage({super.key});

  @override
  OutfitInfoMainPageState createState() => OutfitInfoMainPageState();
}

class OutfitInfoMainPageState extends State<OutfitInfoMainPage> {
  OutfitData? _info;
  String? _infoId;
  Color? _rarityColor;

  @override
  void initState() {
    super.initState();
    _infoId = Get.parameters['outfit'];
    _getStaticData();
  }

  void _getStaticData() async {
    var outfitData = await GridData.retrieveOutfitsMapData();
    debugPrint("OutfitDataKey: ${outfitData?.keys}");
    debugPrint("Finding $_infoId");
    setState(() {
      _info = outfitData![_infoId!];
      debugPrint("Found $_info");
      _rarityColor = GridUtils.getRarityColor(_info!.rarity);
    });
  }

  Widget? _showFab() {
    if (_info == null) return null;

    if (_info!.model3D == null || _info!.model3D!.isEmpty) return null;

    return FloatingActionButton(
      onPressed: () => Get.toNamed("/outfits/$_infoId/model"),
      tooltip: 'View 3D Model (ALPHA)',
      backgroundColor: _rarityColor,
      child: Icon(MdiIcons.tshirtCrew),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_info == null) return Util.loadingScreen();

    return DefaultTabController(
      length: 3,
      child: Scaffold(
        appBar: AppBar(
          title: Text(_info!.name ?? 'Unknown Outfit'),
          backgroundColor: _rarityColor,
          bottom: const TabBar(tabs: [
            Tab(text: 'General'),
            Tab(text: 'Wish'),
            Tab(text: 'In-Game'),
          ]),
          actions: [
            IconButton(
              icon: const Icon(Icons.info_outline),
              onPressed: () => GridData.launchWikiUrl(context, _info!),
              tooltip: 'View Wiki',
            ),
          ],
        ),
        body: TabBarView(
          children: [
            OutfitInfoGeneralPage(info: _info),
            OutfitInfoImagePage(imagePath: _info!.wishImage),
            OutfitInfoImagePage(imagePath: _info!.gameImage),
          ],
        ),
        floatingActionButton: _showFab(),
      ),
    );
  }
}

class OutfitInfoGeneralPage extends StatelessWidget {
  final OutfitData? info;

  const OutfitInfoGeneralPage({super.key, required this.info});

  Widget _getOutfitHeader(BuildContext context) {
    return Row(
      children: [
        GridData.getImageAssetFromFirebase(info!.image, height: 64),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              width: MediaQuery.of(context).size.width - 128,
              child: Text(
                "${info!.type!} Outfit",
                textAlign: TextAlign.start,
                style: const TextStyle(fontSize: 20),
              ),
            ),
            RatingBar.builder(
              ignoreGestures: true,
              itemCount: 5,
              itemSize: 30,
              initialRating: double.tryParse(info!.rarity.toString())!,
              itemBuilder: (context, _) =>
                  const Icon(Icons.star, color: Colors.amber),
              onRatingUpdate: (rating) {
                debugPrint(rating.toString());
              },
            ),
          ],
        ),
      ],
    );
  }

  List<Widget> _generateCharList(BuildContext context) {
    var widgets = <Widget>[];

    widgets.add(const Padding(padding: EdgeInsets.only(top: 10)));
    widgets.add(
      const Padding(
        padding: EdgeInsets.only(left: 8),
        child: Text(
          "Used By",
          style: TextStyle(fontSize: 24),
        ),
      ),
    );
    widgets.add(const Padding(padding: EdgeInsets.only(top: 10)));

    if (info?.character?.isNotEmpty ?? false) {
      widgets.addAll(GridData.generateCoWGridWidgets(
        'Characters',
        [info!.character!],
        'characters',
        info?.name,
        MediaQuery.of(context).orientation == Orientation.portrait,
      ));
    }
    widgets.removeLast(); // Remove padding at the end

    return widgets;
  }

  List<Widget> _generateShopInfo() {
    List<Widget> widgets = [];

    if (!(info?.shop ?? false)) {
      return widgets;
    }

    var textVal = "${info?.shopCost ?? 0} Genesis Crystals";

    if ((info?.shopCostDiscounted ?? 0) > 0) {
      textVal +=
          "\n(${info?.shopCostDiscounted ?? 0} Genesis Crystals until ${info?.shopCostDiscountedTill ?? 'Unknown'})";
    }

    return GridData.generateInfoLine(textVal, Icons.monetization_on);
  }

  List<Widget> _generateEventInfo() {
    List<Widget> widgets = [];

    if (!(info?.eventGiveFree ?? false)) {
      return widgets;
    }

    var textVal =
        "Outfit free during event till ${info!.eventGiveFreeTill ?? 'Unknown'}";

    return GridData.generateInfoLine(textVal, Icons.event);
  }

  @override
  Widget build(BuildContext context) {
    if (info == null) return Util.loadingScreen();

    return Padding(
      padding: const EdgeInsets.all(8),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            _getOutfitHeader(context),
            const Divider(),
            ...GridData.unreleasedCheck(
              info!.released,
              'Outfit',
              hasTracking: false,
            ),
            ...GridData.generateInfoLine(
              "Version ${info!.releasedVersion.toString()}",
              Icons.new_releases,
            ),
            ...GridData.generateInfoLine(
              info!.description,
              Icons.format_list_bulleted,
            ),
            ...GridData.generateInfoLine(
              info!.obtained!.replaceAll('- ', ''),
              Icons.location_pin,
            ),
            ..._generateShopInfo(),
            ..._generateEventInfo(),
            ...GridData.generateInfoLine(info!.lore, Icons.book),
            ..._generateCharList(context),
          ],
        ),
      ),
    );
  }
}

class OutfitInfoImagePage extends StatelessWidget {
  final String? imagePath;

  const OutfitInfoImagePage({super.key, required this.imagePath});

  @override
  Widget build(BuildContext context) {
    if (imagePath == null) return const Center(child: Text('No image found'));

    return Padding(
      padding: const EdgeInsets.all(8),
      child: GridData.getImageAssetFromFirebase(imagePath),
    );
  }
}

class OutfitModelViewerPage extends StatefulWidget {
  const OutfitModelViewerPage({super.key});

  @override
  OutfitModelViewerPageState createState() => OutfitModelViewerPageState();
}

class OutfitModelViewerPageState extends State<OutfitModelViewerPage> {
  OutfitData? _outfitData;
  String? _outfitId;

  @override
  void initState() {
    super.initState();
    _outfitId = Get.parameters['outfit'];
    _getData();
  }

  void _getData() async {
    var outfitData = await GridData.retrieveOutfitsMapData();
    setState(() {
      _outfitData = outfitData![_outfitId!];
    });
  }

  Widget _buildModel() {
    if (_outfitData == null) {
      return const Center(
        child: Text('No Outfit Found'),
      );
    } else {
      var gsUrl = Util.costumeGsUrl + _outfitData!.model3D!;
      debugPrint("gsUrl: $gsUrl");

      return ModelViewer(
        src: gsUrl,
        alt: _outfitData!.name,
        autoRotate: true,
        cameraControls: true,
        disablePan: false,
        ar: true,
        arModes: const ['scene-viewer', 'webxr', 'quick-look'],
        environmentImage: "${Util.costumeGsUrl}music_hall_01_1k.hdr",
        shadowIntensity: 1,
        exposure: 1,
      );
    }
  }

  void _showAlphaAlert() {
    showDialog(
      context: context,
      builder: (BuildContext context) {
        return AlertDialog(
          title: const Text("Alpha Feature"),
          content: const Text(
            "This feature is current in alpha and may crash or not work as expected. AR mode is experimental and currently not supported on iOS",
          ),
          actions: [
            TextButton(
              onPressed: () {
                Navigator.of(context).pop();
              },
              child: const Text("OK"),
            ),
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    var outfitName = "";
    if (_outfitData != null) outfitName = _outfitData?.name ?? "Unknown";
    var rarityColor = GridUtils.getRarityColor(_outfitData?.rarity ?? 1);
    debugPrint("Processing: ${_outfitData?.model3D}");

    return Scaffold(
      appBar: AppBar(
        title: Text("3D - $outfitName"),
        backgroundColor: rarityColor,
        actions: [
          IconButton(
            icon: const Icon(Icons.new_releases_outlined),
            onPressed: () => _showAlphaAlert(),
          ),
        ],
      ),
      body: _buildModel(),
    );
  }
}
