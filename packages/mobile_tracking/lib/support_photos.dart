import 'package:flutter/material.dart';
import 'package:pista_core/pista_core.dart';

/// Photos attached to a support message. The server only hands them to the
/// customer who sent them and to support staff, so they are fetched with the
/// signed-in session rather than a public link.
class SupportPhotoRow extends StatelessWidget {
  final PistaApi api;
  final List<dynamic> photos;
  const SupportPhotoRow({super.key, required this.api, required this.photos});

  String _url(String id) => '${api.baseUrl}/support/attachments/$id';
  Map<String, String> get _headers => {
    if (api.token != null) 'Authorization': 'Bearer ${api.token}',
  };

  @override
  Widget build(BuildContext context) {
    if (photos.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Wrap(
        spacing: 6,
        runSpacing: 6,
        children: [
          for (final p in photos)
            InkWell(
              key: ValueKey('photo-${(p as Map)['id']}'),
              onTap: () => showDialog<void>(
                context: context,
                builder: (_) => Dialog(
                  backgroundColor: Colors.black,
                  insetPadding: const EdgeInsets.all(12),
                  child: InteractiveViewer(
                    child: _image(p['id'] as String, fit: BoxFit.contain),
                  ),
                ),
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(10),
                child: SizedBox(
                  width: 92,
                  height: 92,
                  child: _image(p['id'] as String, fit: BoxFit.cover),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _image(String id, {required BoxFit fit}) => Image.network(
    _url(id),
    headers: _headers,
    fit: fit,
    errorBuilder: (_, _, _) => const ColoredBox(
      color: Colors.black12,
      child: Center(child: Icon(Icons.broken_image_outlined)),
    ),
  );
}
