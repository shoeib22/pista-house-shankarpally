import 'dart:ui' as ui;
import 'package:flutter/material.dart';

/// Display a piece of the user-supplied artwork as a UI graphic. No screenshot
/// is used for interactive content: the cart, fields, cards and nav are widgets.
class ReferenceArtwork extends StatefulWidget {
  final Rect source;
  final Color? ink;

  /// Makes pixels close to the page's cream background transparent so a cropped
  /// piece of artwork blends into the page instead of showing a lighter box.
  final bool knockout;
  const ReferenceArtwork({
    super.key,
    required this.source,
    this.ink,
    this.knockout = false,
  });
  @override
  State<ReferenceArtwork> createState() => _ReferenceArtworkState();
}

class _ReferenceArtworkState extends State<ReferenceArtwork> {
  ImageStream? stream;
  ImageInfo? info;
  late final listener = ImageStreamListener((image, synchronous) {
    final old = info;
    if (mounted) {
      setState(() => info = image);
    } else {
      image.dispose();
    }
    old?.dispose();
  });
  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final next = const AssetImage(
      'assets/home-reference.png',
      package: 'pista_ui',
    ).resolve(createLocalImageConfiguration(context));
    if (next.key != stream?.key) {
      stream?.removeListener(listener);
      stream = next..addListener(listener);
    }
  }

  @override
  void dispose() {
    stream?.removeListener(listener);
    info?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => ExcludeSemantics(
    child: CustomPaint(
      painter: info == null
          ? null
          : _FragmentPainter(
              info!.image,
              widget.source,
              widget.ink,
              widget.knockout,
            ),
      size: Size.infinite,
    ),
  );
}

class _FragmentPainter extends CustomPainter {
  final ui.Image image;
  final Rect source;
  final Color? ink;
  final bool knockout;
  _FragmentPainter(this.image, this.source, this.ink, this.knockout);
  @override
  void paint(Canvas c, Size s) {
    final paint = Paint()..filterQuality = FilterQuality.high;
    if (ink != null) {
      final color = ink!;
      paint.colorFilter = ColorFilter.matrix([
        0,
        0,
        0,
        0,
        color.r * 255,
        0,
        0,
        0,
        0,
        color.g * 255,
        0,
        0,
        0,
        0,
        color.b * 255,
        -.416667,
        -.416667,
        -.416667,
        0,
        283,
      ]);
    }
    if (knockout && ink == null) {
      paint.colorFilter = const ColorFilter.matrix([
        1, 0, 0, 0, 0, //
        0, 1, 0, 0, 0,
        0, 0, 1, 0, 0,
        0, 0, -8, 0, 1776,
      ]);
    }
    c.drawImageRect(image, source, Offset.zero & s, paint);
  }

  @override
  bool shouldRepaint(_FragmentPainter old) =>
      image != old.image ||
      source != old.source ||
      ink != old.ink ||
      knockout != old.knockout;
}

class ReferencePatternClip extends CustomClipper<Path> {
  @override
  Path getClip(Size s) => Path()
    ..moveTo(0, 0)
    ..lineTo(s.width, 0)
    ..lineTo(s.width, s.height)
    ..cubicTo(
      s.width * .95,
      s.height * .45,
      s.width * .83,
      s.height * .16,
      s.width * .735,
      s.height * .59,
    )
    ..quadraticBezierTo(s.width * .65, s.height * .16, s.width * .525, 0)
    ..quadraticBezierTo(
      s.width * .41,
      s.height * .18,
      s.width * .315,
      s.height * .59,
    )
    ..cubicTo(
      s.width * .20,
      s.height * .15,
      s.width * .07,
      s.height * .38,
      0,
      s.height,
    )
    ..close();
  @override
  bool shouldReclip(ReferencePatternClip old) => false;
}
