import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:flutter_rating_bar/flutter_rating_bar.dart';
import 'package:get/get.dart';
import 'package:gi_weekly_material_tracker/helpers/grid.dart';
import 'package:gi_weekly_material_tracker/helpers/tracker.dart';
import 'package:gi_weekly_material_tracker/listeners/sorter.dart';
import 'package:gi_weekly_material_tracker/models/materialdata.dart';
import 'package:gi_weekly_material_tracker/util.dart';
import 'package:shared_preferences/shared_preferences.dart';

final FirebaseFirestore _db = FirebaseFirestore.instance;

class MaterialTabController extends StatefulWidget {
  final TabController? tabController;
  final SortNotifier? notifier;

  const MaterialTabController({
    super.key,
    required this.tabController,
    this.notifier,
  });

  @override
  MaterialTabControllerState createState() => MaterialTabControllerState();
}

class MaterialTabControllerState extends State<MaterialTabController> {
  @override
  Widget build(BuildContext context) {
    return TabBarView(controller: widget.tabController, children: [
      MaterialListGrid(notifier: widget.notifier),
      MaterialListGrid(filter: 'boss_drops', notifier: widget.notifier),
      MaterialListGrid(filter: 'domain_material', notifier: widget.notifier),
      MaterialListGrid(filter: 'mob_drops', notifier: widget.notifier),
      MaterialListGrid(filter: 'local_speciality', notifier: widget.notifier),
    ]);
  }
}

class MaterialListGrid extends StatefulWidget {
  final String? filter;
  final SortNotifier? notifier;

  const MaterialListGrid({super.key, this.filter, this.notifier});

  @override
  MaterialListGridState createState() => MaterialListGridState();
}

class MaterialListGridState extends State<MaterialListGrid> {
  String? _sorter;
  bool _isDescending = false;

  @override
  void initState() {
    super.initState();
    // Initial sorting information
    if (widget.notifier?.checkMatchingType(2) ?? false) {
      _sorter = widget.notifier!.getSortKey();
      _isDescending = widget.notifier!.isDescending();
    }
    widget.notifier!.addListener(() {
      if (!mounted) return;
      setState(() {
        _sorter = widget.notifier!.getSortKey();
        _isDescending = widget.notifier!.isDescending();
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    var materialRef = _db.collection('materials');
    Query? queryRef;
    if (widget.filter != null) {
      queryRef = materialRef.where('innerType', isEqualTo: widget.filter);
    }
    if (_sorter != null && queryRef == null) {
      queryRef = materialRef
          .orderBy(_sorter!, descending: _isDescending)
          .orderBy(FieldPath.documentId);
    } else if (_sorter != null) {
      queryRef = queryRef!
          .orderBy(_sorter!, descending: _isDescending)
          .orderBy(FieldPath.documentId);
    }

    return StreamBuilder(
      stream:
          (queryRef == null) ? materialRef.snapshots() : queryRef.snapshots(),
      builder: (context, AsyncSnapshot<QuerySnapshot> snapshot) {
        if (snapshot.hasError) {
          return const Text('Error occurred getting snapshot');
        }

        if (snapshot.connectionState == ConnectionState.waiting) {
          return Util.centerLoadingCircle('');
        }

        if (widget.filter == null) {
          GridData.setStaticData('materials', snapshot.data);
        }

        var dt = GridData.getDataListFilteredRelease(snapshot.data!.docs);

        return GridView.count(
          crossAxisCount:
              (Get.context!.orientation == Orientation.portrait) ? 3 : 6,
          children: dt.map((document) {
            return GestureDetector(
              onTap: () => Get.toNamed('/materials/${document.id}'),
              child: GridData.getGridData(
                MaterialDataCommon.fromJson(
                  document.data() as Map<String, dynamic>,
                ),
              ),
            );
          }).toList(),
        );
      },
    );
  }
}

class MaterialInfoPage extends StatefulWidget {
  const MaterialInfoPage({super.key});

  @override
  MaterialInfoPageState createState() => MaterialInfoPageState();
}

class MaterialInfoPageState extends State<MaterialInfoPage> {
  MaterialDataCommon? _info;
  String? _infoId;

  Color? _rarityColor;

  bool _isAdded = false;
  bool _addCheckObtained = false;

  String _cntTrack = '';
  final TextEditingController _textEditingController = TextEditingController();
  late SharedPreferences _prefs;

  @override
  void initState() {
    super.initState();
    _infoId = Get.parameters['material'];
    _getStaticData();
  }

  void _getStaticData() async {
    var value = await GridData.retrieveMaterialsMapData();
    _prefs = await SharedPreferences.getInstance();

    setState(() {
      _info = value![_infoId!];
      if (_info == null) Get.offAndToNamed('/splash');
      _rarityColor = GridUtils.getRarityColor(_info!.rarity);
    });
    _refreshTrackingStatus();
  }

  Widget _getMaterialHeader() {
    return Row(
      children: [
        GridData.getImageAssetFromFirebase(_info!.image, height: 64),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              width: MediaQuery.of(context).size.width - 128,
              child: Text(
                _info!.type!,
                textAlign: TextAlign.start,
                style: const TextStyle(fontSize: 20),
              ),
            ),
            RatingBar.builder(
              ignoreGestures: true,
              itemCount: 5,
              itemSize: 30,
              initialRating: double.tryParse(_info!.rarity.toString())!,
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

  void _refreshTrackingStatus() {
    setState(() {
      if (!mounted) return;
      _addCheckObtained = false;
    });
    TrackingData.isBeingTracked('material', _infoId)
        .then((isTracked) => setState(() {
              if (!mounted) return;
              _isAdded = isTracked;
              _addCheckObtained = true;
            }));
  }

  Widget _getFabWidget() {
    if (!_addCheckObtained) return const CircularProgressIndicator();

    return _isAdded
        ? const Icon(Icons.remove, color: Colors.white)
        : const Icon(Icons.add, color: Colors.white);
  }

  void _trackMaterialAction() {
    var toTrack = int.tryParse(_cntTrack) ?? 0;
    TrackingData.addToRecord('material', _infoId).then((value) {
      _refreshTrackingStatus();
      Util.showSnackbarQuick(context, '${_info!.name} added to tracker!');
    });
    TrackingData.addToCollection(
      'Material_$_infoId',
      _infoId,
      toTrack,
      _info!.innerType,
      'material',
      null,
    );
    Navigator.of(context).pop();
  }

  void _untrackMaterialAction() {
    TrackingData.removeFromRecord('material', _infoId).then((value) {
      _refreshTrackingStatus();
      Util.showSnackbarQuick(context, '${_info!.name} removed from tracker!');
    });
    TrackingData.removeFromCollection('Material_$_infoId', _info!.innerType);
    Navigator.of(context).pop();
  }

  void _addOrRemoveMaterial() async {
    if (!_addCheckObtained) {
      Util.showSnackbarQuick(context, 'Checking tracking status');

      return;
    }

    if (_info == null || !_info!.released) {
      Util.showSnackbarQuick(context, 'Unable to track unreleased materials');

      return;
    }

    if (_isAdded) {
      await _removeMaterialDialog();
    } else {
      await _addMaterialDialog();
    }
  }

  Future<void> _addMaterialDialog() async {
    await showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: Text('Add ${_info!.name} to the tracker?'),
          content: SingleChildScrollView(
            child: ListBody(
              children: [
                GridData.getImageAssetFromFirebase(_info!.image, height: 64),
                TextField(
                  onChanged: (newValue) {
                    setState(() {
                      _cntTrack = newValue;
                    });
                  },
                  controller: _textEditingController,
                  decoration:
                      const InputDecoration(labelText: 'Quantity to track'),
                  keyboardType: TextInputType.number,
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Cancel'),
            ),
            TextButton(
              onPressed: _trackMaterialAction,
              child: const Text('Track'),
            ),
          ],
        );
      },
    );
  }

  Future<void> _removeMaterialDialog() async {
    await showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: Text('Remove ${_info!.name} from the tracker?'),
          content: SingleChildScrollView(
            child: ListBody(
              children: [
                GridData.getImageAssetFromFirebase(_info!.image, height: 64),
                const Text(
                  'This will remove the currently tracked data for this material from the tracker',
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Cancel'),
            ),
            TextButton(
              onPressed: _untrackMaterialAction,
              child: const Text('Untrack'),
            ),
          ],
        );
      },
    );
  }

  List<Widget> _generateUsageList() {
    var widgets = <Widget>[];

    if (_info?.usage == null) return widgets;

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

    var isPortrait = MediaQuery.of(context).orientation == Orientation.portrait;

    if (_info?.usage!.characters?.isNotEmpty ?? false) {
      widgets.addAll(GridData.generateCoWGridWidgets(
        'Characters',
        _info?.usage!.characters,
        'characters',
        _info?.name,
        isPortrait,
      ));
    }

    if (_info?.usage!.weapons?.isNotEmpty ?? false) {
      widgets.addAll(GridData.generateCoWGridWidgets(
        'Weapons',
        _info?.usage!.weapons,
        'weapons',
        _info?.name,
        isPortrait,
      ));
    }

    widgets.removeLast(); // Remove padding at the end

    return widgets;
  }

  @override
  Widget build(BuildContext context) {
    if (_info == null) return Util.loadingScreen();

    return Scaffold(
      appBar: AppBar(
        title: Text(_info!.name ?? 'Unknown Material'),
        backgroundColor: _rarityColor,
        foregroundColor: GridUtils.getHeaderColor(context),
        actions: [
          IconButton(
            icon: const Icon(Icons.info_outline),
            onPressed: () => GridData.launchWikiUrl(context, _info!, _prefs),
            tooltip: 'View Wiki',
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        backgroundColor: _rarityColor,
        onPressed: _addOrRemoveMaterial,
        child: _getFabWidget(),
      ),
      body: Padding(
        padding: const EdgeInsets.all(8),
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              _getMaterialHeader(),
              const Divider(),
              ...GridData.unreleasedCheck(_info!.released, 'Material'),
              ...GridData.generateInfoLine(
                _info!.obtained!.replaceAll('- ', ''),
                Icons.location_pin,
              ),
              ...GridData.generateInfoLine(
                _info!.description ?? 'Unknown Description',
                Icons.format_list_bulleted,
              ),
              ..._generateUsageList(),
            ],
          ),
        ),
      ),
    );
  }
}
