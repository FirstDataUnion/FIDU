#!/bin/bash

# This script generates simple placeholder icons for the ACM Manager extension
# It creates a simple text-based icon with different sizes

# Function to generate an SVG icon with given text and size
generate_svg() {
  local size="$1"
  local text="ACM"
  local bgcolor="#2196f3"
  local textcolor="#ffffff"
  
  cat > "icon${size}.svg" << EOF
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="${bgcolor}" rx="5" ry="5"/>
  <text x="50%" y="50%" font-family="Arial" font-size="$((size/3))" 
        font-weight="bold" fill="${textcolor}" 
        text-anchor="middle" dominant-baseline="middle">${text}</text>
</svg>
EOF
}

# Function to convert SVG to PNG
svg_to_png() {
  local size="$1"
  
  if command -v convert &> /dev/null; then
    # Using ImageMagick if available
    convert "icon${size}.svg" "icon${size}.png"
    echo "Generated icon${size}.png"
    rm "icon${size}.svg"
  else
    echo "ImageMagick 'convert' command not found. Keeping SVG files instead."
  fi
}

# Generate icons in different sizes
for size in 16 48 128; do
  generate_svg "$size"
  svg_to_png "$size"
done

echo "Icon generation complete!"
echo "If PNG files were not generated, please install ImageMagick or manually convert the SVG files." 