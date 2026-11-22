# Customer design reference implementation

Direction confirmed by the user on 22 November 2026.

- `references/heritage-reference.png` is the primary home/product reference: parchment cream, deep green, restrained gold, serif headlines, shaped category emblems, food imagery and an arched product panel.
- `references/customer-tracking-reference.png` supplies the customer tracking composition: map, delivery status, milestone icons and an itemised order summary.
- Implementation stays in Flutter. The new menu/detail widgets replace the earlier plain menu list. The drawer, category filtering, quantity controls, product selection, cart and order navigation perform real actions; sample ratings, fake offers and unsupported award/serving claims were not copied from the concepts.
- The actual menu retains its existing names, categories and authoritative prices. The reference images are not restaurant price approvals.
- The temporary text wordmark remains pending the user's promised Pista House Shankarpally logo. The previous official logo asset is preserved.
- Fonts are bundled DM Sans and Cormorant Garamond from Google Fonts, with their OFL notices in `packages/mobile_ui/assets/fonts/` and the package `LICENSE`. No font network request is needed at runtime.

## Generated illustration

Built-in image-generation tool used for the Charminar background only. Final project asset: `packages/mobile_ui/assets/charminar-heritage.png`. Flutter masks soften its edges into the cream surface. Existing food photography remains labelled illustrative in the menu.

Final generation prompt:

> Create one production UI illustration asset, landscape 3:2. A delicate hand-engraved botanical heritage illustration of Hyderabad's Charminar, in muted deep forest-green and sage ink with subtle warm gold details. Match an elegant traditional Indian restaurant app on warm cream parchment: fine architectural linework, ornamental arches and four minarets, soft pale foliage at the base and very faint floating wisps of cloud. The building occupies the RIGHT HALF and lower right; the LEFT HALF is nearly empty for headline overlay. No food, no phone, no UI, no words, no letters, no logos, no borders. Gentle premium vintage print character. Transparent background with the pale shadowing and ink edges preserved, not a white rectangle. The illustration should remain soft enough behind large dark-green type.

## Preview evidence

- `../qa/mobile/customer.png`: implemented customer home, rendered with sample data.
- `../qa/mobile/customer-product.png`: implemented product detail, rendered with sample data.
- `../qa/mobile/customer-tracking.jpg`: actual Flutter browser preview connected to the local API with an isolated test order and explicitly simulated GPS.
- `../qa/mobile/customer-map-pin.jpg`: real area-search result selected on the map and confirmed back into checkout.
- `../qa/mobile/customer-tracking-compact.jpg`: small-screen summary scrolling verified at 320x700; no browser console errors.

These are implementation previews, not captures from an installed iPhone. Physical-device checks and a new TestFlight build remain pending.

