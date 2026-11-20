#!/usr/bin/env bash
set -euo pipefail
: "${APP_DIR:?APP_DIR is required}"
: "${APP_STORE_APPLE_ID:?App Store Connect app ID is required}"
# Codemagic's per-project counter also supports the first Apple upload.
NEXT_BUILD="${PROJECT_BUILD_NUMBER:-${BUILD_NUMBER:-}}"
if ! [[ "$NEXT_BUILD" =~ ^[0-9]+$ ]]; then
  echo "Codemagic did not provide a numeric build counter" >&2
  exit 1
fi
NEXT_BUILD=$((NEXT_BUILD + 1))
cd "$APP_DIR"
BUILD_ARGS=(--release --build-number="$NEXT_BUILD" --export-options-plist="$HOME/export_options.plist" --dart-define=BETA_TESTING=true)
if [ -n "${PISTA_API_URL:-}" ]; then
  BUILD_ARGS+=(--dart-define="API_URL=$PISTA_API_URL")
fi
flutter build ipa "${BUILD_ARGS[@]}"
echo "Signed internal beta archive completed for build $NEXT_BUILD."

