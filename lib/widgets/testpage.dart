
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:gi_weekly_material_tracker/helpers/grid.dart';
import 'package:gi_weekly_material_tracker/models/outfitdata.dart';
import 'package:gi_weekly_material_tracker/util.dart';
import 'package:model_viewer_plus/model_viewer_plus.dart';

class TestPage extends StatelessWidget {
  const TestPage({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Outfits (ALPHA)'),
      ),
      body: FutureBuilder(
        future: GridData.retrieveOutfitsMapData(),
        builder: (context, snapshot) {
          debugPrint("HARROW: ${snapshot.hasData}");
          if (snapshot.hasData) {

            debugPrint("snapshot.data: ${snapshot.data}");


            Map<String, OutfitData>? outfitsMap = snapshot.data as Map<String, OutfitData>?;
            if (outfitsMap == null || outfitsMap.isEmpty) {
              return const Center(child: Text("No outfits found"));
            }

            debugPrint("outfitsMap Size: ${outfitsMap.length}");

            // Filter out all values without model3d
            outfitsMap.removeWhere((key, value) => value.model3D == null || value.model3D!.isEmpty);

            debugPrint("outfitsMap trimmed Size: ${outfitsMap.length}");

            return ListView.separated(
              shrinkWrap: true,
              itemCount: outfitsMap.length,
              itemBuilder: (context, index) {
                var key = outfitsMap.keys.elementAt(index);
                var value = outfitsMap[key];

                return ListTile(
                  onTap: () => Get.toNamed("/test3d/$key"),
                  title: Text(value?.name ?? "Unknown Outfit (Key: $key)"),
                );
              },
              separatorBuilder: (context, index) => const Divider(height: 1),
            );
          } else if (snapshot.hasError) {
            printError(info: snapshot.error?.toString() ?? "Unknown Error");

            return Center(child: Text("Error: ${snapshot.error}"));
          } else {
            return Util.centerLoadingCircle("Getting Outfits List...");
          }

        },
      ),
    );
  }
}

class ThreeDViewerPage extends StatefulWidget {
  const ThreeDViewerPage({Key? key}) : super(key: key);

  @override
  ThreeDViewerPageState createState() => ThreeDViewerPageState();
}

class ThreeDViewerPageState extends State<ThreeDViewerPage> {

  OutfitData? _outfitData;

  @override
  void initState() {
    super.initState();
    String? costumeString = Get.parameters['costume'];
    _getData(costumeString ?? "");
  }

  void _getData(String key) async {
    var outfitData = await GridData.retrieveOutfitsMapData();
    setState(() {
      _outfitData = outfitData![key];
    });

    debugPrint("Processing ${_outfitData?.name}");
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
        environmentImage: "https://storage.googleapis.com/gi-weekly-material-tracker-glb-models/music_hall_01_1k.hdr",
        shadowIntensity: 1,
        exposure: 1,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    var appname = "";
    if (_outfitData != null) appname = _outfitData?.name?? "Unknown";
    debugPrint("Processing: ${_outfitData?.model3D}");

    return Scaffold(
      appBar: AppBar(
        title: Text("3D Model - $appname (ALPHA)"),
      ),
      body: _buildModel(),
    );
  }
}