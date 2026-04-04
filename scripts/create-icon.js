const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ICON_SIZE = 1024;
const DARK_BG = '#0A0A0F';
const CYAN_ACCENT = '#00D4FF';

// Create SVG with F
const svgString = `
<svg width="${ICON_SIZE}" height="${ICON_SIZE}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="glow">
      <feGaussianBlur stdDeviation="20" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <!-- Dark background -->
  <rect width="${ICON_SIZE}" height="${ICON_SIZE}" fill="${DARK_BG}"/>

  <!-- Cyan glowing F -->
  <text
    x="${ICON_SIZE / 2}"
    y="${ICON_SIZE * 0.65}"
    font-family="Arial, sans-serif"
    font-size="600"
    font-weight="bold"
    text-anchor="middle"
    fill="${CYAN_ACCENT}"
    filter="url(#glow)"
    letter-spacing="-20"
  >F</text>
</svg>
`;

async function createIcon() {
  try {
    const assetsDir = path.join(__dirname, '../assets');

    // Create assets directory if it doesn't exist
    if (!fs.existsSync(assetsDir)) {
      fs.mkdirSync(assetsDir, { recursive: true });
    }

    // Create the icon from SVG
    console.log('Creating app icon (1024x1024)...');
    await sharp(Buffer.from(svgString))
      .png()
      .toFile(path.join(assetsDir, 'icon.png'));
    console.log('✓ Created assets/icon.png');

    // Create adaptive icon (same for now)
    console.log('Creating adaptive icon...');
    await sharp(Buffer.from(svgString))
      .png()
      .toFile(path.join(assetsDir, 'adaptive-icon.png'));
    console.log('✓ Created assets/adaptive-icon.png');

    // Also create a smaller version for favicon
    console.log('Creating favicon...');
    await sharp(Buffer.from(svgString))
      .png()
      .resize(192, 192)
      .toFile(path.join(assetsDir, 'favicon.png'));
    console.log('✓ Created assets/favicon.png');

    console.log('\n✓ All icons created successfully!');
  } catch (error) {
    console.error('Error creating icon:', error);
    process.exit(1);
  }
}

createIcon();
