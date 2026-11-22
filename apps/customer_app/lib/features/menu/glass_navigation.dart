import 'dart:ui' as ui;
import 'package:pista_ui/pista_ui.dart';

/// Flutter frosted/refractive glass treatment, not Apple's native Liquid Glass API.
class GlassNavigation extends StatelessWidget {
  final int selectedIndex;
  final ValueChanged<int> onSelected;
  const GlassNavigation({
    super.key,
    required this.selectedIndex,
    required this.onSelected,
  });
  @override
  Widget build(BuildContext context) {
    final reduced = MediaQuery.of(context).disableAnimations;
    return SafeArea(
      top: false,
      minimum: const EdgeInsets.fromLTRB(16, 8, 16, 14),
      child: Container(
        height: 78,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(46),
          boxShadow: const [
            BoxShadow(
              color: Color(0x36122E22),
              blurRadius: 24,
              offset: Offset(0, 10),
            ),
            BoxShadow(
              color: Color(0x33FFFFFF),
              blurRadius: 2,
              offset: Offset(0, -1),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(46),
          child: BackdropFilter(
            filter: ui.ImageFilter.blur(sigmaX: 22, sigmaY: 22),
            child: Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(46),
                gradient: const LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    Color(0xE53F6B4B),
                    Color(0xED073B29),
                    Color(0xD6093327),
                  ],
                ),
                border: Border.all(color: const Color(0x99FFF4D9), width: 1),
              ),
              child: Padding(
                padding: const EdgeInsets.all(7),
                child: LayoutBuilder(
                  builder: (context, box) => Stack(
                    children: [
                      AnimatedAlign(
                        duration: Duration(milliseconds: reduced ? 0 : 300),
                        curve: Curves.easeOutCubic,
                        alignment: Alignment(-1 + selectedIndex * 2 / 3, 0),
                        child: Container(
                          width: box.maxWidth / 4,
                          height: 62,
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(35),
                            gradient: const LinearGradient(
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                              colors: [Color(0x7DFFFBEA), Color(0x28E2D6AB)],
                            ),
                            border: Border.all(
                              color: const Color(0x88FFF9E9),
                              width: .8,
                            ),
                            boxShadow: const [
                              BoxShadow(
                                color: Color(0x33F2E6B4),
                                blurRadius: 16,
                              ),
                            ],
                          ),
                        ),
                      ),
                      Row(
                        children: [
                          for (var i = 0; i < 4; i++)
                            Expanded(
                              child: Semantics(
                                button: true,
                                selected: i == selectedIndex,
                                label: const [
                                  'Home',
                                  'Order Again',
                                  'Offers',
                                  'Account',
                                ][i],
                                child: InkWell(
                                  borderRadius: BorderRadius.circular(32),
                                  onTap: () => onSelected(i),
                                  child: Column(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      Icon(
                                        [
                                          i == 0 && selectedIndex == 0
                                              ? Icons.home_filled
                                              : Icons.home_outlined,
                                          Icons.history_rounded,
                                          Icons.sell_outlined,
                                          Icons.person_outline,
                                        ][i],
                                        color: i == selectedIndex
                                            ? const Color(0xFFFFE4A1)
                                            : const Color(0xFFF8F2DD),
                                        size: 27,
                                      ),
                                      const SizedBox(height: 5),
                                      Text(
                                        const [
                                          'Home',
                                          'Order Again',
                                          'Offers',
                                          'Account',
                                        ][i],
                                        style: TextStyle(
                                          fontSize: 10.5,
                                          fontWeight: i == selectedIndex
                                              ? FontWeight.w600
                                              : FontWeight.w400,
                                          color: i == selectedIndex
                                              ? const Color(0xFFFFE4A1)
                                              : const Color(0xFFF8F2DD),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
