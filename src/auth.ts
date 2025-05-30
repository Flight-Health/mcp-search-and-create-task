import { Page } from "puppeteer";
import { initializeBrowser, getGlobalPage } from "./browser.js";
import { LoginCredentials } from "./types.js";

// ********** Have to enter your own credentials here **********

const ATLAS_BASE_URL = "https://atlas.staging.goflighthealth.com";
const LOGIN_CREDENTIALS: LoginCredentials = {
  email: "example@example.com",
  password: "PSWD"
};

let isLoggedIn = false;

export async function loginToAtlas(): Promise<boolean> {
  try {
    const globalPage = getGlobalPage();
    
    if (isLoggedIn && globalPage) {
      // Check if we're still logged in by trying to access a protected page
      try {
        await globalPage.goto(`${ATLAS_BASE_URL}/patients`, { waitUntil: 'networkidle0', timeout: 10000 });
        const currentUrl = globalPage.url();
        if (!currentUrl.includes('/login')) {
          console.error("Already logged in!");
          return true;
        }
      } catch (error) {
        console.error("Session expired, need to re-login");
        isLoggedIn = false;
      }
    }

    const { page } = await initializeBrowser();
    
    console.error("Navigating to login page...");
    await page.goto(`${ATLAS_BASE_URL}/login`, { waitUntil: 'networkidle0' });
    
    console.error("Filling login form...");
    
    // Wait for email input and fill it
    await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 10000 });
    await page.type('input[type="email"], input[name="email"]', LOGIN_CREDENTIALS.email);
    
    // Wait for password input and fill it
    await page.waitForSelector('input[type="password"], input[name="password"]', { timeout: 10000 });
    await page.type('input[type="password"], input[name="password"]', LOGIN_CREDENTIALS.password);
    
    console.error("Submitting login form...");
    
    // Click login button and wait for navigation
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 }),
      page.click('button[type="submit"], input[type="submit"], .btn-primary, .login-btn')
    ]);
    
    // Check if login was successful
    const currentUrl = page.url();
    if (currentUrl.includes('/login')) {
      // Check for error messages
      const errorElement = await page.$('.alert-danger, .error, .invalid-feedback');
      if (errorElement) {
        const errorText = await page.evaluate(el => el.textContent, errorElement);
        throw new Error(`Login failed: ${errorText}`);
      }
      throw new Error("Login failed - still on login page");
    }
    
    console.error("Login successful!");
    isLoggedIn = true;
    return true;
    
  } catch (error) {
    console.error("Login failed:", error);
    isLoggedIn = false;
    throw error;
  }
}

export function getAtlasBaseUrl(): string {
  return ATLAS_BASE_URL;
}

export function setLoginStatus(status: boolean): void {
  isLoggedIn = status;
}
