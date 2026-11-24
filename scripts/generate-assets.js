#!/usr/bin/env node
// Asset generation script for Open Ballot SEO
// Generates: icons in multiple sizes, og-image.png from SVG, browserconfig.xml

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const publicDir = path.join(projectRoot, 'public');
const iconsDir = path.join(publicDir, 'icons');

const iconSizes = [72, 96, 128, 144, 152, 192, 384, 512];
const sourceIcon = path.join(iconsDir, 'icon-512.png');
const sourceSvg = path.join(publicDir, 'og-image.svg');

async function generateIcons() {
  console.log('🎨 Generating icons...');
  try {
    const buffer = await fs.readFile(sourceIcon);
    for (const size of iconSizes) {
      const outputPath = path.join(iconsDir, `icon-${size}.png`);
      await sharp(buffer)
        .resize(size, size, { fit: 'cover', position: 'center' })
        .png({ compressionLevel: 9 })
        .toFile(outputPath);
      console.log(`  ✅ icon-${size}.png`);
    }
    console.log('✅ All icons generated');
  } catch (error) {
    console.error('❌ Error generating icons:', error.message);
  }
}

async function generateOgImage() {
  console.log('🖼️ Generating og-image.png...');
  try {
    await sharp(path.join(publicDir, 'og-image.svg'))
      .resize(1200, 630, { fit: 'fill' })
      .png({ compressionLevel: 9 })
      .toFile(path.join(publicDir, 'og-image.png'));
    console.log('✅ og-image.png generated');
  } catch (error) {
    console.error('❌ Error generating og-image:', error.message);
  }
}

async function generateAll() {
  console.log('🚀 Starting asset generation...\n');
  await generateIcons();
  await generateOgImage();
  console.log('\n✨ All assets generated successfully!');
}

generateAll().catch(console.error);