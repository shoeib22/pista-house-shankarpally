import 'package:pista_core/pista_core.dart';
import 'package:pista_ui/pista_ui.dart';
import 'heritage_menu.dart';
import 'reference_artwork.dart';

class ReferenceHome extends StatefulWidget {
  final CustomerModel model;
  final VoidCallback openMenu, checkout, seeAll;
  final ValueChanged<String> category;
  const ReferenceHome({
    super.key,
    required this.model,
    required this.openMenu,
    required this.checkout,
    required this.seeAll,
    required this.category,
  });
  @override
  State<ReferenceHome> createState() => _ReferenceHomeState();
}

class _ReferenceHomeState extends State<ReferenceHome> {
  String query = '';
  Set<String> saved = {};
  @override
  void initState() {
    super.initState();
    DeviceDishSaves.load().then((value) {
      if (mounted) setState(() => saved = value);
    });
  }

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, constraints) {
      final s = constraints.maxWidth / 560, m = widget.model;
      final dishes = m.products
          .where((p) => p.name.toLowerCase().contains(query.toLowerCase()))
          .toList();
      final favourites = dishes
          .where((p) => p.category.toLowerCase() == 'biryani')
          .toList();
      final visible = favourites.isNotEmpty ? favourites : dishes;
      return SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        child: SizedBox(
          height: 1120 * s + 150,
          child: Stack(
            children: [
              Positioned.fill(
                child: DecoratedBox(
                  decoration: const BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [
                        Color(0xFFF8EBDD),
                        Color(0xFFF7EBDD),
                        Color(0xFFF5EBDF),
                      ],
                    ),
                  ),
                ),
              ),
              Positioned(
                left: 0,
                right: 0,
                top: 0,
                height: 153 * s,
                child: ClipPath(
                  clipper: ReferencePatternClip(),
                  child: const ReferenceArtwork(
                    source: Rect.fromLTRB(34, 49, 588, 202),
                  ),
                ),
              ),
              Positioned(
                left: 30 * s,
                top: 116 * s,
                width: 66 * s,
                height: 62 * s,
                child: IconButton(
                  tooltip: 'Open menu',
                  onPressed: widget.openMenu,
                  icon: Icon(
                    Icons.menu_rounded,
                    color: heritageGreen,
                    size: 36 * s,
                  ),
                ),
              ),
              Positioned(
                left: 164 * s,
                top: 111 * s,
                width: 250 * s,
                height: 57 * s,
                child: Semantics(
                  label: 'Pista House',
                  image: true,
                  child: ReferenceArtwork(
                    source: Rect.fromLTRB(196, 158, 442, 211),
                    ink: Color(0xFF073B24),
                  ),
                ),
              ),
              Positioned(
                left: 0,
                right: 0,
                top: 172 * s,
                child: Text(
                  'Since 1997',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 17 * s,
                    color: const Color(0xFF0D1F16),
                  ),
                ),
              ),
              Positioned(
                right: 25 * s,
                top: 113 * s,
                width: 65 * s,
                height: 65 * s,
                child: IconButton(
                  tooltip: 'View cart',
                  onPressed: m.quantity == 0 ? null : widget.checkout,
                  icon: Badge(
                    isLabelVisible: m.quantity > 0,
                    label: Text('${m.quantity}'),
                    backgroundColor: heritageGreen,
                    textColor: const Color(0xFFFFF1CF),
                    child: Icon(
                      Icons.shopping_cart_outlined,
                      color: heritageGreen,
                      size: 41 * s,
                    ),
                  ),
                ),
              ),
              Positioned(
                left: 0,
                right: 0,
                top: 427 * s,
                height: 66 * s,
                child: const ReferenceArtwork(
                  source: Rect.fromLTRB(34, 474, 588, 540),
                  knockout: true,
                ),
              ),
              Positioned(
                left: 354 * s,
                top: 222 * s,
                width: 202 * s,
                height: 270 * s,
                child: const ReferenceArtwork(
                  source: Rect.fromLTRB(385, 269, 587, 539),
                  knockout: true,
                ),
              ),
              Positioned(
                left: 40 * s,
                top: 276 * s,
                width: 307 * s,
                height: 128 * s,
                child: Semantics(
                  label: 'Hyderabad’s Iconic Flavours at Your Doorstep',
                  image: true,
                  child: ReferenceArtwork(
                    source: Rect.fromLTRB(71, 323, 378, 451),
                    ink: Color(0xFF071D11),
                  ),
                ),
              ),
              Positioned(
                left: 26 * s,
                right: 26 * s,
                top: 511 * s,
                height: 72 * s,
                child: Container(
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(45 * s),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0x191E180E),
                        blurRadius: 25 * s,
                        offset: Offset(0, 12 * s),
                      ),
                    ],
                  ),
                  child: TextField(
                    style: TextStyle(fontSize: 20 * s),
                    onChanged: (value) => setState(() => query = value),
                    decoration: InputDecoration(
                      hintText: 'Search for Biryani, Haleem, Sweets...',
                      hintStyle: TextStyle(
                        fontSize: 20 * s,
                        color: const Color(0xFF625D57),
                      ),
                      prefixIcon: Icon(
                        Icons.search_rounded,
                        size: 33 * s,
                        color: const Color(0xFF302A20),
                      ),
                      prefixIconConstraints: BoxConstraints(minWidth: 74 * s),
                      filled: true,
                      fillColor: const Color(0xFFFDF8F0),
                      contentPadding: EdgeInsets.only(
                        right: 15 * s,
                        top: 18 * s,
                        bottom: 18 * s,
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(45 * s),
                        borderSide: const BorderSide(
                          color: Color(0xFFD9CDB9),
                          width: .8,
                        ),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(45 * s),
                        borderSide: const BorderSide(
                          color: heritageGold,
                          width: 1.2,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
              Positioned(
                left: 27 * s,
                right: 0,
                top: 612 * s,
                height: 160 * s,
                child: SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _category(
                        'Biryani',
                        const Rect.fromLTRB(57, 659, 184, 818),
                        127,
                        159,
                        s,
                      ),
                      SizedBox(width: 17 * s),
                      _category(
                        'Haleem',
                        const Rect.fromLTRB(201, 660, 320, 803),
                        119,
                        143,
                        s,
                      ),
                      SizedBox(width: 18 * s),
                      _category(
                        'Bakery',
                        const Rect.fromLTRB(338, 660, 456, 803),
                        118,
                        143,
                        s,
                      ),
                      SizedBox(width: 18 * s),
                      _category(
                        'Sweets',
                        const Rect.fromLTRB(474, 660, 588, 803),
                        114,
                        143,
                        s,
                      ),
                    ],
                  ),
                ),
              ),
              Positioned(
                left: 26 * s,
                top: 803 * s,
                width: 228 * s,
                height: 38 * s,
                child: Semantics(
                  header: true,
                  label: 'Our Favourites',
                  child: ReferenceArtwork(
                    source: Rect.fromLTRB(55, 850, 283, 888),
                    ink: Color(0xFF0A1710),
                  ),
                ),
              ),
              Positioned(
                right: 17 * s,
                top: 796 * s,
                height: 54 * s,
                child: TextButton(
                  onPressed: widget.seeAll,
                  style: TextButton.styleFrom(
                    foregroundColor: const Color(0xFF0C1C13),
                    padding: EdgeInsets.symmetric(horizontal: 8 * s),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text('See All', style: TextStyle(fontSize: 18 * s)),
                      Icon(Icons.chevron_right, size: 21 * s),
                    ],
                  ),
                ),
              ),
              Positioned(
                left: 26 * s,
                right: 0,
                top: 860 * s,
                height: 214 * s,
                child: visible.isEmpty
                    ? Center(
                        child: Text(
                          m.busy
                              ? 'Getting your favourites ready…'
                              : query.isEmpty
                              ? 'The menu will be available here.'
                              : 'No dishes match this search.',
                          style: TextStyle(
                            fontSize: 17 * s,
                            color: heritageGreen,
                          ),
                        ),
                      )
                    : ListView.separated(
                        scrollDirection: Axis.horizontal,
                        separatorBuilder: (_, i) => SizedBox(width: 20 * s),
                        itemCount: visible.length,
                        itemBuilder: (context, i) => _card(visible[i], s),
                      ),
              ),
              Positioned(
                left: 28 * s,
                right: 28 * s,
                top: 1098 * s,
                child: const Text(
                  'Testing build · illustrative menu and photography · simulated payments',
                  style: TextStyle(fontSize: 9, color: Color(0xFF8A7C66)),
                ),
              ),
            ],
          ),
        ),
      );
    },
  );
  Widget _category(
    String label,
    Rect source,
    double width,
    double height,
    double s,
  ) => Semantics(
    button: true,
    label: label,
    selected: label == 'Biryani',
    child: Tooltip(
      message: label,
      child: InkWell(
        onTap: () => widget.category(label),
        child: SizedBox(
          width: width * s,
          height: height * s,
          child: ReferenceArtwork(source: source, knockout: true),
        ),
      ),
    ),
  );
  Widget _card(Product p, double s) {
    final label = p.category == 'Biryani'
        ? p.name.replaceFirst(' Dum ', ' ')
        : p.name;
    return SizedBox(
      width: 477 * s,
      child: Container(
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          color: const Color(0xFFF6EBDD),
          borderRadius: BorderRadius.circular(29 * s),
          border: Border.all(color: const Color(0xFFD6C5AA), width: .7),
        ),
        child: Row(
          children: [
            SizedBox(
              width: 242 * s,
              height: 214 * s,
              child: p.category == 'Biryani'
                  ? const ReferenceArtwork(
                      source: Rect.fromLTRB(58, 908, 300, 1122),
                    )
                  : Container(
                      color: const Color(0xFFE6DDC8),
                      child: Icon(
                        Icons.room_service_outlined,
                        color: heritageGreen,
                        size: 50 * s,
                      ),
                    ),
            ),
            Expanded(
              child: Stack(
                children: [
                  Positioned.fill(
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: [
                            const Color(0xFFF8EFE4),
                            const Color(0xFFEDDFC9).withValues(alpha: .7),
                          ],
                        ),
                      ),
                    ),
                  ),
                  Positioned(
                    top: 7 * s,
                    right: 10 * s,
                    child: IconButton(
                      tooltip: saved.contains(p.id)
                          ? 'Unsave ${p.name}'
                          : 'Save ${p.name}',
                      onPressed: () async {
                        setState(
                          () => saved.contains(p.id)
                              ? saved.remove(p.id)
                              : saved.add(p.id),
                        );
                        try {
                          await DeviceDishSaves.save(saved);
                          if (mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text(
                                  'Favourites saved on this device.',
                                ),
                                duration: Duration(seconds: 2),
                              ),
                            );
                          }
                        } catch (_) {
                          if (mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text(
                                  'Could not save favourites on this device.',
                                ),
                              ),
                            );
                          }
                        }
                      },
                      icon: Icon(
                        saved.contains(p.id)
                            ? Icons.favorite
                            : Icons.favorite_border,
                        color: const Color(0xFF102017),
                        size: 28 * s,
                      ),
                    ),
                  ),
                  Positioned(
                    left: 19 * s,
                    right: 16 * s,
                    top: 61 * s,
                    child: InkWell(
                      onTap: () => Navigator.push<void>(
                        context,
                        MaterialPageRoute(
                          builder: (_) => HeritageProductPage(
                            model: widget.model,
                            product: p,
                            checkout: widget.checkout,
                          ),
                        ),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            label,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontFamily: 'packages/pista_ui/HouseSerif',
                              fontWeight: FontWeight.w700,
                              fontSize: 28 * s,
                              height: 1.02,
                              color: const Color(0xFF101B13),
                            ),
                          ),
                          SizedBox(height: 7 * s),
                          Text(
                            'Pista House Special',
                            style: TextStyle(
                              fontSize: 16 * s,
                              color: const Color(0xFF575348),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  Positioned(
                    left: 19 * s,
                    bottom: 27 * s,
                    child: Text(
                      rupees(p.pricePaise),
                      style: TextStyle(
                        fontSize: 25 * s,
                        fontWeight: FontWeight.w700,
                        color: const Color(0xFF0D1D12),
                      ),
                    ),
                  ),
                  Positioned(
                    right: 12 * s,
                    bottom: 12 * s,
                    child: IconButton.filled(
                      tooltip: 'Add ${p.name}',
                      onPressed:
                          !p.available ||
                              widget.model.busy ||
                              widget.model.checkoutLocked ||
                              (widget.model.cart[p.id] ?? 0) >= 20
                          ? null
                          : () => widget.model.change(p.id, 1),
                      style: IconButton.styleFrom(
                        backgroundColor: heritageGreen,
                        minimumSize: Size(44 * s, 44 * s),
                        padding: EdgeInsets.all(9 * s),
                        side: const BorderSide(
                          color: Color(0xFFBDA16A),
                          width: .6,
                        ),
                      ),
                      icon: Icon(Icons.add, size: 27 * s),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
