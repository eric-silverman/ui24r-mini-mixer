#!/bin/bash
# Generate PNG icons from SVG
# Requires: ImageMagick or librsvg (rsvg-convert)

cd "$(dirname "$0")/public"

if command -v rsvg-convert &> /dev/null; then
    echo "Using rsvg-convert to generate icons..."
    rsvg-convert icon.svg -w 192 -h 192 -o icon-192.png
    rsvg-convert icon.svg -w 512 -h 512 -o icon-512.png
    echo "Icons generated successfully!"
elif command -v convert &> /dev/null; then
    echo "Using ImageMagick to generate icons..."
    convert -background none icon.svg -resize 192x192 icon-192.png
    convert -background none icon.svg -resize 512x512 icon-512.png
    echo "Icons generated successfully!"
else
    echo "Error: Neither rsvg-convert nor ImageMagick (convert) found."
    echo "Please install one of them:"
    echo "  - macOS: brew install librsvg  (or: brew install imagemagick)"
    echo "  - Linux: apt-get install librsvg2-bin  (or: apt-get install imagemagick)"
    echo ""
    echo "Or use an online tool like https://realfavicongenerator.net/"
    exit 1
fi
