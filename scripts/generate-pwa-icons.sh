#!/bin/bash
# Generate PWA icons from the SVG source.
# Requires: Inkscape or ImageMagick (convert)
#
# Usage: bash scripts/generate-pwa-icons.sh
#
# After generating PNGs, update vite.config.ts manifest icons to reference
# the PNG files instead of SVG for better Android compatibility.

SVG="src/client/public/favicon.svg"
OUT="src/client/public"

if command -v convert &> /dev/null; then
  echo "Using ImageMagick..."
  convert -background none -resize 192x192 "$SVG" "$OUT/pwa-192x192.png"
  convert -background none -resize 512x512 "$SVG" "$OUT/pwa-512x512.png"
  convert -background none -resize 180x180 "$SVG" "$OUT/apple-touch-icon.png"
  echo "Done. Icons generated in $OUT"
elif command -v inkscape &> /dev/null; then
  echo "Using Inkscape..."
  inkscape "$SVG" -w 192 -h 192 -o "$OUT/pwa-192x192.png"
  inkscape "$SVG" -w 512 -h 512 -o "$OUT/pwa-512x512.png"
  inkscape "$SVG" -w 180 -h 180 -o "$OUT/apple-touch-icon.png"
  echo "Done. Icons generated in $OUT"
else
  echo "Error: Neither ImageMagick nor Inkscape found."
  echo "Install one of them, or use an online tool to convert favicon.svg to PNG."
  exit 1
fi
