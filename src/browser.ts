import puppeteer, { Browser, Page } from "puppeteer";
import { BrowserSession } from "./types.js";

// Global browser instance for session management
let globalBrowser: Browser | null = null;
let globalPage: Page | null = null;

export async function initializeBrowser(): Promise<BrowserSession> {
  if (globalBrowser && globalPage) {
    try {
      // Check if browser is still connected
      await globalPage.evaluate(() => document.title);
      return { browser: globalBrowser, page: globalPage };
    } catch (error) {
      console.error("Browser connection lost, reinitializing...");
      globalBrowser = null;
      globalPage = null;
    }
  }

  console.error("Launching new browser instance...");
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu'
    ]
  });

  const page = await browser.newPage();
  
  // Set user agent to avoid detection
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  // Set viewport
  await page.setViewport({ width: 1280, height: 720 });

  // Capture browser console logs
  page.on('console', (msg) => {
    console.error(`Browser Console [${msg.type()}]: ${msg.text()}`);
  });

  globalBrowser = browser;
  globalPage = page;
  
  return { browser, page };
}

export function getGlobalPage(): Page | null {
  return globalPage;
}

export async function closeBrowser(): Promise<void> {
  if (globalBrowser) {
    await globalBrowser.close();
    globalBrowser = null;
    globalPage = null;
  }
}
