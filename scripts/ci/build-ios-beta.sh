#!/usr/bin/env bash
set -euo pipefail
: "${APP_DIR:?APP_DIR is required}"
: "${APP_STORE_APPLE_ID:?App Store Connect app ID is required}"
LATEST_BUILD="$(app-store-connect get-latest-testflight-build-number "$APP_STORE_APPLE_ID")"
if ! [[ "$LATEST_BUILD" =~ ^[0-9]+$ ]]; then
  echo "Apple did not return a numeric build number" >&2
  exit 1
fi
NEXT_BUILD=$((LATEST_BUILD + 1))
if [[ "${BUILD_NUMBER:-}" =~ ^[0-9]+$ ]] && (( BUILD_NUMBER + 1 > NEXT_BUILD )); then
  NEXT_BUILD=$((BUILD_NUMBER + 1))
fi
cd "$APP_DIR"
BUILD_ARGS=(--release --build-number="$NEXT_BUILD" --export-options-plist="$HOME/export_options.plist" --dart-define=BETA_TESTING=true)
if [ -n "${PISTA_API_URL:-}" ]; then
  BUILD_ARGS+=(--dart-define="API_URL=$PISTA_API_URL")
fi
flutter build ipa "${BUILD_ARGS[@]}"
echo "Signed internal beta archive completed for build $NEXT_BUILD."
