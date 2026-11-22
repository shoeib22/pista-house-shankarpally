import 'package:pista_ui/pista_ui.dart';
import 'package:pista_core/pista_core.dart';

const heritageCream = Color(0xFFFBF3E8),
    heritageGreen = Color(0xFF073B29),
    heritageGold = Color(0xFFB69B60);
const heritageTitle = TextStyle(
  fontFamily: 'packages/pista_ui/HouseSerif',
  fontSize: 34,
  height: 1.03,
  fontWeight: FontWeight.w600,
  color: heritageGreen,
);

class ArchBorder extends CustomPainter {
  final Color color;
  const ArchBorder({this.color = heritageGold});
  @override
  void paint(Canvas canvas, Size s) {
    final p = Path()
      ..moveTo(1, s.height)
      ..lineTo(1, 29)
      ..quadraticBezierTo(1, 17, s.width * .21, 17)
      ..quadraticBezierTo(s.width * .36, 17, s.width / 2, 1)
      ..quadraticBezierTo(s.width * .64, 17, s.width * .79, 17)
      ..quadraticBezierTo(s.width - 1, 17, s.width - 1, 29)
      ..lineTo(s.width - 1, s.height);
    canvas.drawPath(
      p,
      Paint()
        ..color = color
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1,
    );
  }

  @override
  bool shouldRepaint(ArchBorder old) => old.color != color;
}

class HeritageMenu extends StatefulWidget {
  final CustomerModel model;
  final bool home;
  final VoidCallback checkout;
  final String initialCategory;
  const HeritageMenu({
    super.key,
    required this.model,
    required this.home,
    required this.checkout,
    this.initialCategory = 'All',
  });
  @override
  State<HeritageMenu> createState() => _HeritageMenuState();
}

class _HeritageMenuState extends State<HeritageMenu> {
  String search = '', category = 'All';
  bool vegetarian = false;
  @override
  void initState() {
    super.initState();
    category = widget.initialCategory;
  }

  @override
  Widget build(BuildContext context) {
    final m = widget.model,
        categories = ['All', ...m.products.map((p) => p.category).toSet()];
    final products = m.products
        .where(
          (p) =>
              (category == 'All' || p.category == category) &&
              (!vegetarian || p.vegetarian) &&
              p.name.toLowerCase().contains(search.toLowerCase()),
        )
        .toList();
    return ListView(
      padding: const EdgeInsets.fromLTRB(22, 4, 22, 105),
      children: [
        if (widget.home) ...[
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 12),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  Icons.location_on_outlined,
                  size: 15,
                  color: heritageGreen,
                ),
                SizedBox(width: 5),
                Text(
                  'Shankarpally · Pickup & delivery',
                  style: TextStyle(fontSize: 11, color: heritageGreen),
                ),
              ],
            ),
          ),
          SizedBox(
            height: 220,
            child: Stack(
              children: [
                Positioned.fill(
                  child: Opacity(opacity: .48, child: const HeritageBackdrop()),
                ),
                const Align(
                  alignment: Alignment.centerLeft,
                  child: Padding(
                    padding: EdgeInsets.only(left: 10, right: 85),
                    child: Text(
                      'Hyderabad’s\nIconic Flavours\nat Your Doorstep',
                      style: TextStyle(
                        fontFamily: 'packages/pista_ui/HouseSerif',
                        fontSize: 31,
                        height: 1.12,
                        fontWeight: FontWeight.w600,
                        color: heritageGreen,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ] else
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 18),
            child: Text('Find your favourite.', style: heritageTitle),
          ),
        TextField(
          decoration: InputDecoration(
            hintText: 'Search for Biryani, starters & more',
            prefixIcon: const Icon(Icons.search_rounded),
            filled: true,
            fillColor: const Color(0xFFFFFAF3),
            contentPadding: const EdgeInsets.all(18),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(30),
              borderSide: const BorderSide(color: Color(0xFFDED1BA)),
            ),
          ),
          onChanged: (v) => setState(() => search = v),
        ),
        const SizedBox(height: 20),
        SizedBox(
          height: 88,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            separatorBuilder: (_, i) => const SizedBox(width: 12),
            itemCount: categories.length,
            itemBuilder: (context, i) {
              final label = categories[i], selected = category == label;
              return HeritageCategory(
                label: label,
                selected: selected,
                onTap: () => setState(() => category = label),
              );
            },
          ),
        ),
        const SizedBox(height: 20),
        Row(
          children: [
            Expanded(
              child: Text(
                widget.home ? 'Our favourites' : 'The house menu',
                style: heritageTitle.copyWith(fontSize: 29),
              ),
            ),
            FilterChip(
              label: const Text('Vegetarian'),
              selected: vegetarian,
              onSelected: (v) => setState(() => vegetarian = v),
              visualDensity: VisualDensity.compact,
            ),
          ],
        ),
        const SizedBox(height: 5),
        const Text(
          'Made for sharing. Or keeping all to yourself.',
          style: TextStyle(fontSize: 11, color: Color(0xFF7E7567)),
        ),
        const SizedBox(height: 18),
        if (m.products.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 35),
            child: Column(
              children: [
                const Icon(
                  Icons.restaurant_outlined,
                  color: heritageGold,
                  size: 42,
                ),
                const SizedBox(height: 12),
                Text(
                  m.busy
                      ? 'Getting the kitchen ready…'
                      : 'The menu is taking a little longer.',
                  style: heritageTitle.copyWith(fontSize: 24),
                ),
                if (!m.busy)
                  TextButton(
                    onPressed: m.refresh,
                    child: const Text('Try again'),
                  ),
              ],
            ),
          ),
        if (m.products.isNotEmpty && products.isEmpty)
          const Padding(
            padding: EdgeInsets.all(24),
            child: Text('No dishes match just yet. Try another search.'),
          ),
        for (final p in products)
          Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: InkWell(
              borderRadius: BorderRadius.circular(24),
              onTap: () => Navigator.push<void>(
                context,
                MaterialPageRoute(
                  builder: (_) => HeritageProductPage(
                    model: m,
                    product: p,
                    checkout: widget.checkout,
                  ),
                ),
              ),
              child: Container(
                clipBehavior: Clip.antiAlias,
                decoration: BoxDecoration(
                  color: const Color(0xFFF4E9D8),
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(color: const Color(0xFFDFD0B7)),
                ),
                child: Row(
                  children: [
                    SizedBox(
                      width: 120,
                      height: 160,
                      child: p.category == 'Biryani'
                          ? Image.asset(
                              'assets/biryani-cover.png',
                              package: 'pista_ui',
                              fit: BoxFit.cover,
                            )
                          : Container(
                              color: const Color(0xFFE7DDC9),
                              child: const Icon(
                                Icons.room_service_outlined,
                                color: heritageGreen,
                                size: 42,
                              ),
                            ),
                    ),
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Icon(
                                  Icons.circle,
                                  size: 8,
                                  color: p.vegetarian
                                      ? pistaGreen
                                      : const Color(0xFFAD6945),
                                ),
                                const SizedBox(width: 5),
                                Text(
                                  p.vegetarian
                                      ? 'Vegetarian'
                                      : 'Non-vegetarian',
                                  style: const TextStyle(
                                    fontSize: 9,
                                    color: Color(0xFF7B705C),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            Text(
                              p.name,
                              style: heritageTitle.copyWith(fontSize: 23),
                            ),
                            const SizedBox(height: 5),
                            Text(
                              p.description,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontSize: 10,
                                height: 1.45,
                                color: Color(0xFF746B5D),
                              ),
                            ),
                            const SizedBox(height: 10),
                            Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    rupees(p.pricePaise),
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w700,
                                      fontSize: 16,
                                    ),
                                  ),
                                ),
                                if (!p.available)
                                  const Text(
                                    'Sold out',
                                    style: TextStyle(fontSize: 11),
                                  )
                                else
                                  Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      if ((m.cart[p.id] ?? 0) > 0) ...[
                                        IconButton(
                                          tooltip: 'Remove ${p.name}',
                                          onPressed: () => m.change(p.id, -1),
                                          icon: const Icon(
                                            Icons.remove,
                                            size: 17,
                                          ),
                                          visualDensity: VisualDensity.compact,
                                        ),
                                        Text('${m.cart[p.id]}'),
                                      ],
                                      IconButton.filled(
                                        tooltip: 'Add ${p.name}',
                                        onPressed:
                                            m.busy ||
                                                m.checkoutLocked ||
                                                (m.cart[p.id] ?? 0) >= 20
                                            ? null
                                            : () => m.change(p.id, 1),
                                        style: IconButton.styleFrom(
                                          backgroundColor: heritageGreen,
                                          minimumSize: const Size(36, 36),
                                          padding: const EdgeInsets.all(6),
                                        ),
                                        icon: const Icon(Icons.add, size: 19),
                                      ),
                                    ],
                                  ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        const Padding(
          padding: EdgeInsets.only(top: 6),
          child: Text(
            'Illustrative food photography and sample menu. Restaurant approval pending.',
            style: TextStyle(fontSize: 9, color: Color(0xFF817765)),
          ),
        ),
      ],
    );
  }
}

class HeritageArch extends CustomClipper<Path> {
  @override
  Path getClip(Size s) => Path()
    ..moveTo(0, 66)
    ..quadraticBezierTo(s.width * .12, 22, s.width * .29, 40)
    ..quadraticBezierTo(s.width * .46, 21, s.width * .5, 0)
    ..quadraticBezierTo(s.width * .54, 21, s.width * .71, 40)
    ..quadraticBezierTo(s.width * .88, 22, s.width, 66)
    ..lineTo(s.width, s.height)
    ..lineTo(0, s.height)
    ..close();
  @override
  bool shouldReclip(HeritageArch old) => false;
}

class HeritageProductPage extends StatefulWidget {
  final CustomerModel model;
  final Product product;
  final VoidCallback checkout;
  const HeritageProductPage({
    super.key,
    required this.model,
    required this.product,
    required this.checkout,
  });
  @override
  State<HeritageProductPage> createState() => _HeritageProductPageState();
}

class HeritageBackdrop extends StatelessWidget {
  const HeritageBackdrop({super.key});
  @override
  Widget build(BuildContext context) => ShaderMask(
    blendMode: BlendMode.dstIn,
    shaderCallback: (rect) => const LinearGradient(
      begin: Alignment.topCenter,
      end: Alignment.bottomCenter,
      colors: [
        Colors.transparent,
        Colors.white,
        Colors.white,
        Colors.transparent,
      ],
      stops: [0, .14, .8, 1],
    ).createShader(rect),
    child: ShaderMask(
      blendMode: BlendMode.dstIn,
      shaderCallback: (rect) => const LinearGradient(
        colors: [
          Colors.transparent,
          Colors.white,
          Colors.white,
          Colors.transparent,
        ],
        stops: [0, .5, .92, 1],
      ).createShader(rect),
      child: Image.asset(
        'assets/charminar-heritage.png',
        package: 'pista_ui',
        fit: BoxFit.cover,
        alignment: Alignment.centerRight,
      ),
    ),
  );
}

class HeritageCategory extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;
  const HeritageCategory({
    super.key,
    required this.label,
    required this.selected,
    required this.onTap,
  });
  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    selected: selected,
    child: InkResponse(
      onTap: onTap,
      child: CustomPaint(
        painter: _CategoryEmblem(selected),
        child: SizedBox(
          width: 88,
          height: 88,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                label == 'Biryani'
                    ? Icons.rice_bowl_outlined
                    : label == 'Starters'
                    ? Icons.restaurant_outlined
                    : label == 'Desserts'
                    ? Icons.cake_outlined
                    : Icons.room_service_outlined,
                color: selected
                    ? const Color(0xFFEAD49C)
                    : const Color(0xFF817240),
                size: 27,
              ),
              const SizedBox(height: 7),
              Text(
                label,
                style: TextStyle(
                  fontSize: 11,
                  color: selected ? heritageCream : heritageGreen,
                ),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}

class _CategoryEmblem extends CustomPainter {
  final bool selected;
  _CategoryEmblem(this.selected);
  @override
  void paint(Canvas canvas, Size s) {
    final p = Path()
      ..moveTo(2, 25)
      ..quadraticBezierTo(2, 16, s.width * .22, 16)
      ..quadraticBezierTo(s.width * .4, 12, s.width * .5, 2)
      ..quadraticBezierTo(s.width * .6, 12, s.width * .78, 16)
      ..quadraticBezierTo(s.width - 2, 16, s.width - 2, 25)
      ..lineTo(s.width - 2, s.height - 21)
      ..quadraticBezierTo(
        s.width - 2,
        s.height - 9,
        s.width * .72,
        s.height - 9,
      )
      ..quadraticBezierTo(
        s.width * .57,
        s.height - 7,
        s.width * .5,
        s.height - 2,
      )
      ..quadraticBezierTo(
        s.width * .43,
        s.height - 7,
        s.width * .28,
        s.height - 9,
      )
      ..quadraticBezierTo(2, s.height - 9, 2, s.height - 21)
      ..close();
    canvas.drawPath(
      p,
      Paint()..color = selected ? heritageGreen : const Color(0xFFF8EEDF),
    );
    canvas.drawPath(
      p,
      Paint()
        ..color = selected ? heritageGold : const Color(0xFFDACBAD)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1,
    );
  }

  @override
  bool shouldRepaint(_CategoryEmblem old) => old.selected != selected;
}

class _HeritageProductPageState extends State<HeritageProductPage> {
  int quantity = 1;
  @override
  Widget build(BuildContext context) {
    final product = widget.product, model = widget.model;
    final remaining = 20 - (model.cart[product.id] ?? 0);
    return ListenableBuilder(
      listenable: model,
      builder: (context, _) => Scaffold(
        backgroundColor: heritageCream,
        extendBodyBehindAppBar: true,
        appBar: AppBar(
          backgroundColor: Colors.transparent,
          surfaceTintColor: Colors.transparent,
          foregroundColor: heritageCream,
          leading: IconButton(
            tooltip: 'Back',
            onPressed: () => Navigator.maybePop(context),
            icon: const Icon(Icons.arrow_back_ios_new),
          ),
        ),
        body: Stack(
          children: [
            Positioned(
              top: 0,
              left: 0,
              right: 0,
              height: 425,
              child: product.category == 'Biryani'
                  ? Image.asset(
                      'assets/biryani-cover.png',
                      package: 'pista_ui',
                      fit: BoxFit.cover,
                    )
                  : Container(
                      color: heritageGreen,
                      child: const Icon(
                        Icons.room_service_outlined,
                        color: heritageGold,
                        size: 90,
                      ),
                    ),
            ),
            CustomScrollView(
              slivers: [
                const SliverToBoxAdapter(child: SizedBox(height: 325)),
                SliverToBoxAdapter(
                  child: ClipPath(
                    clipper: HeritageArch(),
                    child: CustomPaint(
                      foregroundPainter: const _ArchTrim(),
                      child: Container(
                        decoration: const BoxDecoration(
                          gradient: LinearGradient(
                            colors: [Color(0xFFFFF7E9), heritageCream],
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                          ),
                        ),
                        padding: const EdgeInsets.fromLTRB(25, 77, 25, 30),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              product.name,
                              style: heritageTitle.copyWith(fontSize: 40),
                            ),
                            const SizedBox(height: 8),
                            const Text(
                              'Pista House · Shankarpally',
                              style: TextStyle(fontSize: 15),
                            ),
                            const SizedBox(height: 20),
                            Text(
                              product.description,
                              style: const TextStyle(
                                fontSize: 16,
                                height: 1.6,
                                color: Color(0xFF5E6257),
                              ),
                            ),
                            const SizedBox(height: 30),
                            Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    rupees(product.pricePaise),
                                    style: heritageTitle.copyWith(fontSize: 36),
                                  ),
                                ),
                                Container(
                                  decoration: BoxDecoration(
                                    border: Border.all(
                                      color: const Color(0xFFDDCBA8),
                                    ),
                                    borderRadius: BorderRadius.circular(30),
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      IconButton(
                                        tooltip: 'Decrease quantity',
                                        onPressed: quantity > 1
                                            ? () => setState(() => quantity--)
                                            : null,
                                        icon: const Icon(Icons.remove),
                                      ),
                                      Text(
                                        '$quantity',
                                        style: const TextStyle(
                                          fontSize: 18,
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                      IconButton(
                                        tooltip: 'Increase quantity',
                                        onPressed: quantity < remaining
                                            ? () => setState(() => quantity++)
                                            : null,
                                        icon: const Icon(Icons.add),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 30),
                            const Divider(color: Color(0xFFE0D2B8)),
                            const SizedBox(height: 18),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceAround,
                              children: [
                                _detail(
                                  Icons.room_service_outlined,
                                  'Made with care',
                                ),
                                _detail(
                                  product.vegetarian
                                      ? Icons.eco_outlined
                                      : Icons.restaurant_outlined,
                                  product.vegetarian
                                      ? 'Vegetarian'
                                      : 'Non-vegetarian',
                                ),
                              ],
                            ),
                            const SizedBox(height: 22),
                            const Divider(color: Color(0xFFE0D2B8)),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
        bottomNavigationBar: SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(24, 8, 24, 18),
            child: FilledButton.icon(
              style: FilledButton.styleFrom(
                backgroundColor: heritageGreen,
                padding: const EdgeInsets.all(20),
                shape: const StadiumBorder(),
              ),
              onPressed:
                  !product.available ||
                      model.busy ||
                      model.checkoutLocked ||
                      remaining == 0
                  ? null
                  : () {
                      model.change(product.id, quantity);
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text('${product.name} added to your cart.'),
                        ),
                      );
                      Navigator.pop(context);
                    },
              icon: const Icon(Icons.shopping_bag_outlined),
              label: Text(
                product.available && remaining == 0
                    ? 'Maximum quantity in cart'
                    : product.available
                    ? 'Add to cart · ${rupees(product.pricePaise * quantity)}'
                    : 'Sold out',
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _detail(IconData icon, String text) => Column(
    children: [
      Icon(icon, color: const Color(0xFF857A36), size: 30),
      const SizedBox(height: 9),
      Text(text, style: const TextStyle(fontSize: 12)),
    ],
  );
}

class _ArchTrim extends CustomPainter {
  const _ArchTrim();
  @override
  void paint(Canvas c, Size s) {
    final p = Path()
      ..moveTo(0, 66)
      ..quadraticBezierTo(s.width * .12, 22, s.width * .29, 40)
      ..quadraticBezierTo(s.width * .46, 21, s.width * .5, 1)
      ..quadraticBezierTo(s.width * .54, 21, s.width * .71, 40)
      ..quadraticBezierTo(s.width * .88, 22, s.width, 66);
    c.drawPath(
      p,
      Paint()
        ..color = heritageGold
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1,
    );
  }

  @override
  bool shouldRepaint(_ArchTrim old) => false;
}
