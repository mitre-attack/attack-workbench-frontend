const { resolve } = require('node:path');
const { loadEnvFile } = require('node:process');

// Existing shell/container values take precedence over the optional local file.
try {
  loadEnvFile(resolve(__dirname, '..', '.env'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
