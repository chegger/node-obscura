# node-obscura

Tiny Node.js wrapper around the [Obscura](https://github.com/h4ckf0r0day/obscura) browser binary.

It downloads the matching Obscura release artifact at install time and exposes a small runtime API so you can start `obscura serve` and connect with Playwright or Puppeteer over CDP.

## Install

```bash
npm install node-obscura
```

Supported today:

- Linux x64
- macOS arm64
- macOS x64

## Usage

```js
const { chromium } = require('playwright-core');
const { startObscura } = require('node-obscura');

async function main() {
  const obscura = await startObscura({ stealth: true });
  const browser = await chromium.connectOverCDP(obscura.endpoint);

  try {
    const context = browser.contexts()[0] || (await browser.newContext());
    const page = await context.newPage();
    await page.goto('https://example.com');
    console.log(await page.title());
  } finally {
    await browser.close();
    await obscura.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

## API

### `getBinaryPath()`

Returns the installed Obscura binary path for the current platform.

### `startObscura(options?)`

Starts `obscura serve` and resolves when the CDP endpoint is ready.

Options:

- `port?: number`
- `host?: string`
- `stealth?: boolean`
- `startupTimeoutMs?: number`
- `extraArgs?: string[]`

Returns:

```ts
{
  endpoint: string;
  wsEndpoint: string;
  close: () => Promise<void>;
}
```

## Environment variables

- `OBSCURA_RELEASE_TAG` overrides the release tag to download. Default: `v0.1.1`
- `OBSCURA_DOWNLOAD_BASE_URL` overrides the GitHub release base URL
- `NODE_OBSCURA_SKIP_DOWNLOAD=1` skips binary download during install

## Notes

- This package does not bundle `playwright-core` or `puppeteer-core`; install your preferred CDP client separately.
- The package currently downloads upstream release binaries rather than building Obscura from source.
