/**
 * Build script - copia archivos del cliente al directorio webDir
 * En este proyecto el cliente ya está en /client, no se necesita transpilación.
 * Este script verifica la estructura y genera un reporte.
 */

const fs = require('fs');
const path = require('path');

const clientDir = path.join(__dirname, 'client');
const requiredFiles = [
  'index.html',
  'Game.js',
  'Renderer.js',
  'InputHandler.js',
  'UI.js',
  'NetworkClient.js',
  'TouchControls.js',
  'assets/sprites.js'
];

console.log('=== MU Pixel Realm - Build ===');
console.log('Verificando estructura del cliente...\n');

let allOk = true;
requiredFiles.forEach(file => {
  const filePath = path.join(clientDir, file);
  const exists = fs.existsSync(filePath);
  console.log(`  ${exists ? '✓' : '✗'} client/${file}`);
  if (!exists) allOk = false;
});

if (allOk) {
  console.log('\n✓ Build OK - todos los archivos presentes');
  console.log('  El directorio client/ está listo para Capacitor.');
  console.log('\nPróximos pasos:');
  console.log('  npx cap sync android');
  console.log('  npx cap open android  (o dejar que GitHub Actions compile)');
} else {
  console.error('\n✗ Build FALLIDO - faltan archivos');
  process.exit(1);
}
