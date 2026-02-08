import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { chromium } from '@playwright/test';
import express from 'express';

import type { Server } from 'node:http';

interface CliOptions {
  storyId: string;
  output: string;
  width: number;
  height: number;
  port: number;
  timeout: number;
  rebuild: boolean;
  scale: number;
  containerWidth?: number;
}

function parseArgs(argv: string[]): CliOptions {
  const options: Partial<CliOptions> = {};

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    switch (arg) {
      case '--story-id':
        options.storyId = next;
        i += 1;
        break;
      case '--output':
        options.output = next;
        i += 1;
        break;
      case '--width':
        options.width = Number(next);
        i += 1;
        break;
      case '--height':
        options.height = Number(next);
        i += 1;
        break;
      case '--port':
        options.port = Number(next);
        i += 1;
        break;
      case '--timeout':
        options.timeout = Number(next);
        i += 1;
        break;
      case '--rebuild':
        options.rebuild = true;
        break;
      case '--scale':
        options.scale = Number(next);
        i += 1;
        break;
      case '--container-width':
        options.containerWidth = Number(next);
        i += 1;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!options.storyId || !options.output) {
    throw new Error('Arguments --story-id and --output are required.');
  }

  return {
    storyId: options.storyId,
    output: path.resolve(options.output),
    width: options.width ?? 1280,
    height: options.height ?? 800,
    port: options.port ?? 6008,
    timeout: options.timeout ?? 30000,
    rebuild: options.rebuild ?? false,
    scale: options.scale ?? 2,
    containerWidth: options.containerWidth,
  };
}

function ensureStaticBuild(distDir: string, rebuild: boolean): void {
  const iframeHtml = path.join(distDir, 'iframe.html');

  if (!rebuild && fs.existsSync(iframeHtml)) {
    console.log(`Static build found: ${distDir}`);
    return;
  }

  console.log('Building Storybook...');
  execSync('pnpm build-storybook', { stdio: 'inherit' });
  console.log('Storybook build complete');
}

function startStaticServer(distDir: string, port: number): Server {
  const app = express();
  app.use(express.static(distDir));

  const server = app.listen(port);
  console.log(`Static server running on http://localhost:${port}`);
  return server;
}

async function captureStory(options: CliOptions): Promise<void> {
  const url = `http://localhost:${options.port}/iframe.html?id=${encodeURIComponent(options.storyId)}&viewMode=story`;

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: options.width, height: options.height },
      deviceScaleFactor: options.scale,
    });
    const page = await context.newPage();

    await page.goto(url);
    await page.waitForLoadState('networkidle');

    await page.evaluate(() => document.fonts.ready);

    if (options.containerWidth) {
      await page.addStyleTag({
        content: [
          `#storybook-root > *:first-child {`,
          `  width: ${options.containerWidth}px !important;`,
          `  box-sizing: border-box;`,
          `  overflow: hidden;`,
          `  margin: 0;`,
          `}`,
        ].join('\n'),
      });
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
    }

    const element = page.locator('#storybook-root > *').first();
    await element.waitFor({ state: 'visible', timeout: 10000 });

    fs.mkdirSync(path.dirname(options.output), { recursive: true });
    await element.screenshot({ path: options.output });

    console.log(`Screenshot saved: ${options.output}`);
  } finally {
    await browser.close();
  }
}

async function main() {
  let server: Server | undefined;

  try {
    const options = parseArgs(process.argv.slice(2));
    const distDir = path.resolve('.dist');

    ensureStaticBuild(distDir, options.rebuild);
    server = startStaticServer(distDir, options.port);
    await captureStory(options);
  } catch (error: unknown) {
    console.error('Failed to capture screenshot');
    console.error(error);
    process.exitCode = 1;
  } finally {
    if (server) {
      console.log('Stopping static server...');
      server.close();
    }
  }
}

main();
