#!/usr/bin/env bash
# Footprint budget measurement for macOS/Linux (design.md "Footprint measurement method").
# Run after `cargo build --release -p openfold-desktop`, from the repo root.
#
# On Linux CI runners there is no display server by default; set OPENFOLD_MEASURE_XVFB=1 to
# launch the binary under xvfb-run (a virtual display), which the desktop CI job's Linux leg does.
set -euo pipefail

BIN_PATH="target/release/openfold-desktop"
MAX_BINARY_BYTES=$((10 * 1024 * 1024))
MAX_IDLE_RSS_KB=$((50 * 1024))
MAX_COLD_START_MS=2000

if [ ! -f "$BIN_PATH" ]; then
  echo "binary not found at $BIN_PATH -- run 'cargo build --release -p openfold-desktop' first" >&2
  exit 1
fi

BIN_SIZE=$(stat -c%s "$BIN_PATH" 2>/dev/null || stat -f%z "$BIN_PATH")
echo "Binary size: $((BIN_SIZE / 1024 / 1024)) MB ($BIN_SIZE bytes)"
if [ "$BIN_SIZE" -gt "$MAX_BINARY_BYTES" ]; then
  echo "Binary size $BIN_SIZE bytes exceeds the $MAX_BINARY_BYTES byte budget" >&2
  exit 1
fi

OUT_FILE=$(mktemp)
START_MS=$(($(date +%s%N) / 1000000))

if [ "${OPENFOLD_MEASURE_XVFB:-0}" = "1" ]; then
  xvfb-run --auto-servernum "$BIN_PATH" >"$OUT_FILE" 2>&1 &
else
  "$BIN_PATH" >"$OUT_FILE" 2>&1 &
fi
PID=$!

READY_SEEN=0
for _ in $(seq 1 100); do
  sleep 0.1
  if grep -q "openfold: ready" "$OUT_FILE" 2>/dev/null; then
    READY_SEEN=1
    break
  fi
done
END_MS=$(($(date +%s%N) / 1000000))
COLD_START_MS=$((END_MS - START_MS))

if [ "$READY_SEEN" -ne 1 ]; then
  echo "cold-start ready marker not seen within 10s -- the SPA's startup ping never roundtripped" >&2
  kill "$PID" 2>/dev/null || true
  exit 1
fi
echo "Cold start (process spawn -> ping roundtrip): ${COLD_START_MS} ms"
if [ "$COLD_START_MS" -gt "$MAX_COLD_START_MS" ]; then
  echo "Cold start ${COLD_START_MS}ms exceeds the ${MAX_COLD_START_MS}ms budget" >&2
  kill "$PID" 2>/dev/null || true
  exit 1
fi

sleep 10
RSS_KB=$(ps -o rss= -p "$PID" | tr -d ' ')
echo "Idle host process RSS (webview processes excluded, per design.md): $((RSS_KB / 1024)) MB"
kill "$PID" 2>/dev/null || true

if [ "$RSS_KB" -gt "$MAX_IDLE_RSS_KB" ]; then
  echo "Idle RSS ${RSS_KB}KB exceeds the ${MAX_IDLE_RSS_KB}KB budget" >&2
  exit 1
fi

echo "All footprint budgets passed."
