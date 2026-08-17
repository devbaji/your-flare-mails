#!/usr/bin/env bash
# Sign the latest universal release APK using apps/desktop/android-keystore.properties
set -euo pipefail
DESKTOP="$(cd "$(dirname "$0")/.." && pwd)"
PROPS="$DESKTOP/android-keystore.properties"
OUT_DIR="$DESKTOP/src-tauri/gen/android/app/build/outputs/apk/universal/release"
UNSIGNED="$OUT_DIR/app-universal-release-unsigned.apk"
SIGNED="$OUT_DIR/app-universal-release-signed.apk"

if [[ ! -f "$PROPS" ]]; then
  echo "Missing $PROPS — create a keystore first (see docs/mobile.md)."
  exit 1
fi
if [[ ! -f "$UNSIGNED" ]]; then
  echo "Missing unsigned APK. Run: pnpm build:android"
  exit 1
fi

storeFile=$(grep '^storeFile=' "$PROPS" | cut -d= -f2-)
storePassword=$(grep '^storePassword=' "$PROPS" | cut -d= -f2-)
keyAlias=$(grep '^keyAlias=' "$PROPS" | cut -d= -f2-)
keyPassword=$(grep '^keyPassword=' "$PROPS" | cut -d= -f2-)
KS="$DESKTOP/$storeFile"

BUILD_TOOLS="${ANDROID_HOME:-$HOME/Library/Android/sdk}/build-tools/35.0.0"
APKSIGNER="$BUILD_TOOLS/apksigner"
ZIPALIGN="$BUILD_TOOLS/zipalign"
ALIGNED="$(mktemp -t yfm-aligned).apk"

"$ZIPALIGN" -f -p 4 "$UNSIGNED" "$ALIGNED"
"$APKSIGNER" sign \
  --ks "$KS" \
  --ks-key-alias "$keyAlias" \
  --ks-pass "pass:$storePassword" \
  --key-pass "pass:$keyPassword" \
  --out "$SIGNED" \
  "$ALIGNED"
rm -f "$ALIGNED"
"$APKSIGNER" verify --verbose "$SIGNED"
echo "Signed APK: $SIGNED"
