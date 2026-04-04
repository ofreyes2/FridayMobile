#!/usr/bin/env node
/**
 * Icon generation script
 * Generates all required icon sizes from a master 1024x1024 PNG
 *
 * Usage: node scripts/generate-icons.js
 *
 * Requires:
 *   - assets/icon.png (1024x1024)
 *   - assets/adaptive-icon.png (1024x1024)
 *   - npm install sharp
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const ICON_SIZES = {
  // iOS
  '120': 'icon-120.png',   // iPhone notification
  '152': 'icon-152.png',   // iPad notification
  '167': 'icon-167.png',   // iPad Pro notification
  '180': 'icon-180.png',   // iPhone 6+
  '192': 'icon-192.png',   // Android
  '512': 'icon-512.png',   // App store
  '1024': 'icon.png',      // Master
};

const assetsDir = path.join(__dirname, '../assets');

async function generateIcons() {
  try {
    console.log('📱 Generating F.R.I.D.A.Y. app icons...\n');

    const sourceIcon = path.join(assetsDir, 'icon.png');
    const sourceAdaptive = path.join(assetsDir, 'adaptive-icon.png');

    // Check if source exists
    if (!fs.existsSync(sourceIcon)) {
      console.error('❌ Error: assets/icon.png not found');
      console.error('   Please add a 1024x1024 PNG icon to assets/icon.png');
      process.exit(1);
    }

    // Generate standard icon sizes
    console.log('Generating standard icon sizes:');
    for (const [size, filename] of Object.entries(ICON_SIZES)) {
      if (size === '1024') continue; // Skip master

      const outputPath = path.join(assetsDir, filename);
      await sharp(sourceIcon)
        .resize(parseInt(size), parseInt(size), {
          fit: 'contain',
          background: { r: 10, g: 10, b: 15, alpha: 1 },
        })
        .png()
        .toFile(outputPath);

      console.log(`  ✓ ${filename} (${size}x${size})`);
    }

    // Generate adaptive icon if it exists
    if (fs.existsSync(sourceAdaptive)) {
      console.log('\nGenerating adaptive icon:');
      const adaptiveOutput = path.join(assetsDir, 'android-icon.png');
      await sharp(sourceAdaptive)
        .resize(1024, 1024, {
          fit: 'contain',
          background: { r: 10, g: 10, b: 15, alpha: 1 },
        })
        .png()
        .toFile(adaptiveOutput);
      console.log(`  ✓ android-icon.png (1024x1024)`);
    }

    // Generate favicon
    console.log('\nGenerating web favicon:');
    const faviconOutput = path.join(assetsDir, 'favicon.png');
    await sharp(sourceIcon)
      .resize(192, 192, {
        fit: 'contain',
        background: { r: 10, g: 10, b: 15, alpha: 1 },
      })
      .png()
      .toFile(faviconOutput);
    console.log(`  ✓ favicon.png (192x192)`);

    console.log('\n✅ Icon generation complete!');
    console.log('\nNext steps:');
    console.log('  1. Review generated icons in assets/');
    console.log('  2. Run: npm run ios (to build for iOS)');
    console.log('  3. Run: npm run android (to build for Android)');
  } catch (error) {
    console.error('❌ Error generating icons:', error.message);
    process.exit(1);
  }
}

// Run generation
generateIcons();
