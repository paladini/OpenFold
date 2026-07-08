#!/bin/bash
# Release Binary Validation Script
# Verifies all platform binaries are present and meet size requirements

set -e

echo "=== OpenFold v1.0.0 Release Binary Validation ==="
echo ""

# Expected platforms
PLATFORMS=("windows-x64" "macos-x64" "macos-arm64" "linux-x64")
MAX_SIZE_MB=50

# Check if we're in a release build directory
if [ ! -d "target/release" ]; then
  echo "❌ Error: target/release directory not found"
  echo "   Run: cargo build --release -p openfold-desktop"
  exit 1
fi

echo "Checking artifacts..."
echo ""

PASS=0
FAIL=0

for platform in "${PLATFORMS[@]}"; do
  # Expected artifact paths (from release.yml)
  if [[ "$platform" == "windows-x64" ]]; then
    artifact="openfold-desktop-${platform}.zip"
    binary="target/release/x86_64-pc-windows-msvc/openfold-desktop.exe"
  else
    artifact="openfold-desktop-${platform}.tar.gz"
    if [[ "$platform" == "macos-x64" ]]; then
      binary="target/release/x86_64-apple-darwin/openfold-desktop"
    elif [[ "$platform" == "macos-arm64" ]]; then
      binary="target/release/aarch64-apple-darwin/openfold-desktop"
    else
      binary="target/release/x86_64-unknown-linux-gnu/openfold-desktop"
    fi
  fi

  if [ -f "$artifact" ]; then
    size_bytes=$(stat -f%z "$artifact" 2>/dev/null || stat -c%s "$artifact" 2>/dev/null)
    size_mb=$(echo "scale=2; $size_bytes / 1024 / 1024" | bc 2>/dev/null || echo "unknown")

    if [ "$size_mb" != "unknown" ]; then
      if (( $(echo "$size_mb < $MAX_SIZE_MB" | bc -l) )); then
        echo "✅ $platform: $artifact ($size_mb MB)"
        ((PASS++))
      else
        echo "⚠️  $platform: $artifact ($size_mb MB, > $MAX_SIZE_MB MB limit)"
        ((FAIL++))
      fi
    else
      echo "✅ $platform: $artifact (size: unknown)"
      ((PASS++))
    fi
  elif [ -f "$binary" ]; then
    size_bytes=$(stat -f%z "$binary" 2>/dev/null || stat -c%s "$binary" 2>/dev/null)
    size_mb=$(echo "scale=2; $size_bytes / 1024 / 1024" | bc 2>/dev/null || echo "unknown")
    echo "❓ $platform: binary found ($size_mb MB) but not packaged"
    ((FAIL++))
  else
    echo "❌ $platform: artifact not found"
    ((FAIL++))
  fi
done

echo ""
echo "=== Summary ==="
echo "Passed: $PASS/${#PLATFORMS[@]}"
echo "Failed: $FAIL/${#PLATFORMS[@]}"

if [ $FAIL -eq 0 ]; then
  echo ""
  echo "✅ All binaries validated!"
  echo ""
  echo "Next steps:"
  echo "  1. Verify artifact sizes are reasonable"
  echo "  2. Run: gh release create v1.0.0 --draft --generate-notes"
  echo "  3. Manually review draft, then publish"
  exit 0
else
  echo ""
  echo "❌ Validation failed. Check artifacts above."
  exit 1
fi
