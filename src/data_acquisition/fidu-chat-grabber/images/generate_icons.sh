#!/bin/bash

# Generate icons for the FIDU Chat Grabber extension
# This script creates PNG icons from SVG templates

# Colors
BACKGROUND_COLOR="#2196f3"
TEXT_COLOR="#ffffff"

# Text to display on icons
local text="Grabber"

# Sizes to generate
sizes=(16 48 128)

# Create output directory if it doesn't exist
mkdir -p .

# Generate icons for each size
for size in "${sizes[@]}"; do
    echo "Generating ${size}x${size} icon..."
    
    # Create SVG content
    svg_content="<svg width=\"${size}\" height=\"${size}\" xmlns=\"http://www.w3.org/2000/svg\">
  <rect width=\"${size}\" height=\"${size}\" fill=\"${BACKGROUND_COLOR}\" rx=\"${size/8}\"/>
  <text x=\"50%\" y=\"50%\" font-family=\"Arial, sans-serif\" font-size=\"${size/4}\" font-weight=\"bold\" fill=\"${TEXT_COLOR}\" text-anchor=\"middle\" dominant-baseline=\"middle\">${text}</text>
</svg>"
    
    # Write SVG to temporary file
    echo "$svg_content" > "temp_icon_${size}.svg"
    
    # Convert SVG to PNG using ImageMagick (if available)
    if command -v convert &> /dev/null; then
        convert "temp_icon_${size}.svg" "icon${size}.png"
        echo "Created icon${size}.png"
    else
        echo "ImageMagick not found. Please install it to generate PNG icons."
        echo "SVG file created: temp_icon_${size}.svg"
    fi
    
    # Clean up temporary SVG file
    rm "temp_icon_${size}.svg"
done

echo "Icon generation complete!" 