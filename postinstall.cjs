'use strict';

const fs = require('fs');
const https = require('https');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const RELEASE_TAG = process.env.OBSCURA_RELEASE_TAG || 'v0.1.1';
const DOWNLOAD_BASE_URL =
  process.env.OBSCURA_DOWNLOAD_BASE_URL || 'https://github.com/h4ckf0r0day/obscura/releases/download';
const SKIP_DOWNLOAD = process.env.NODE_OBSCURA_SKIP_DOWNLOAD === '1';
const PACKAGE_ROOT = __dirname;

const ASSET_BY_PLATFORM = {
  'linux-x64': 'obscura-x86_64-linux.tar.gz',
  'darwin-arm64': 'obscura-aarch64-macos.tar.gz',
  'darwin-x64': 'obscura-x86_64-macos.tar.gz',
};

function getPlatformKey() {
  if (process.platform === 'linux' && process.arch === 'x64') {
    return 'linux-x64';
  }
  if (process.platform === 'darwin' && process.arch === 'arm64') {
    return 'darwin-arm64';
  }
  if (process.platform === 'darwin' && process.arch === 'x64') {
    return 'darwin-x64';
  }
  return null;
}

function download(url, destination, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      {
        headers: {
          'User-Agent': 'node-obscura',
        },
      },
      (response) => {
        if (
          response.statusCode &&
          response.statusCode >= 300 &&
          response.statusCode < 400 &&
          response.headers.location
        ) {
          response.resume();
          if (redirectCount >= 5) {
            reject(new Error(`Too many redirects while downloading ${url}`));
            return;
          }
          download(response.headers.location, destination, redirectCount + 1)
            .then(resolve)
            .catch(reject);
          return;
        }

        if (!response.statusCode || response.statusCode >= 400) {
          response.resume();
          reject(new Error(`Failed to download ${url}: status ${response.statusCode || 'unknown'}`));
          return;
        }

        const file = fs.createWriteStream(destination);
        response.pipe(file);
        file.on('finish', () => {
          file.close(resolve);
        });
        file.on('error', (error) => {
          file.close(() => reject(error));
        });
      }
    );
    request.on('error', reject);
  });
}

async function main() {
  if (SKIP_DOWNLOAD) {
    console.log('[node-obscura] Skipping binary download because NODE_OBSCURA_SKIP_DOWNLOAD=1');
    return;
  }

  const platformKey = getPlatformKey();
  if (!platformKey) {
    console.warn(
      `[node-obscura] Skipping download for unsupported platform ${process.platform}/${process.arch}.`
    );
    return;
  }

  const assetName = ASSET_BY_PLATFORM[platformKey];
  const targetDir = path.join(PACKAGE_ROOT, 'binaries', platformKey);
  const targetBinary = path.join(targetDir, 'obscura');

  if (fs.existsSync(targetBinary)) {
    return;
  }

  fs.mkdirSync(targetDir, { recursive: true });

  const downloadUrl = `${DOWNLOAD_BASE_URL}/${RELEASE_TAG}/${assetName}`;
  const tempArchive = path.join(os.tmpdir(), `${assetName}-${Date.now()}`);
  const extractDir = fs.mkdtempSync(path.join(os.tmpdir(), 'node-obscura-'));

  try {
    console.log(`[node-obscura] Downloading ${downloadUrl}`);
    await download(downloadUrl, tempArchive);
    execFileSync('tar', ['-xzf', tempArchive, '-C', extractDir], { stdio: 'inherit' });

    const extractedBinary = path.join(extractDir, 'obscura');
    if (!fs.existsSync(extractedBinary)) {
      throw new Error(`Extracted archive did not contain obscura at ${extractedBinary}`);
    }

    fs.copyFileSync(extractedBinary, targetBinary);
    fs.chmodSync(targetBinary, 0o755);
    console.log(`[node-obscura] Installed Obscura to ${targetBinary}`);
  } finally {
    fs.rmSync(extractDir, { recursive: true, force: true });
    fs.rmSync(tempArchive, { force: true });
  }
}

main().catch((error) => {
  console.error('[node-obscura] Failed to install Obscura:', error);
  process.exit(1);
});
