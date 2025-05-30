import { PatientInfo } from "./types.js";
import { loginToAtlas, getAtlasBaseUrl, setLoginStatus } from "./auth.js";
import { getGlobalPage } from "./browser.js";

export async function searchPatients(patientName: string, detailed: boolean = false): Promise<PatientInfo[]> {
  try {
    // Ensure we're logged in
    await loginToAtlas();
    
    const globalPage = getGlobalPage();
    if (!globalPage) {
      throw new Error("Browser page not available");
    }
    
    console.error(`Navigating to patients page...`);
    
    // Navigate to patients page
    await globalPage.goto(`${getAtlasBaseUrl()}/patients?tab=all`, { waitUntil: 'networkidle0' });
    
    // Check if we're redirected to login (session expired)
    if (globalPage.url().includes('/login')) {
      console.error("Session expired, re-logging in...");
      setLoginStatus(false);
      await loginToAtlas();
      await globalPage.goto(`${getAtlasBaseUrl()}/patients?tab=all`, { waitUntil: 'networkidle0' });
    }
    
    console.error(`Searching for patient: ${patientName}...`);
    
    // Look for search input and search for the patient
    try {
      const searchSelector = 'input[type="search"], input[placeholder*="search"], input[name*="search"], .search-input';
      await globalPage.waitForSelector(searchSelector, { timeout: 5000 });
      await globalPage.type(searchSelector, patientName);
      
      // Wait a bit for search results to load
      await globalPage.waitForTimeout(2000);
    } catch (error) {
      console.error("No search input found, proceeding with table parsing...");
    }
    
    // Wait for patient table to load
    await globalPage.waitForSelector('table, .patient-list, .patients-table', { timeout: 10000 });
    
    // Debug: Check what page we're on
    const pageTitle = await globalPage.title();
    const currentUrl = globalPage.url();
    console.error(`Current page: ${pageTitle} at ${currentUrl}`);
    
    // Debug: Check if there are any tables at all
    const tableCount = await globalPage.evaluate(() => {
      const tables = document.querySelectorAll('table');
      const tbodies = document.querySelectorAll('tbody');
      const rows = document.querySelectorAll('tr');
      return {
        tables: tables.length,
        tbodies: tbodies.length,
        rows: rows.length,
        firstTableHTML: tables[0]?.outerHTML?.substring(0, 500) || 'No table found'
      };
    });
    console.error(`Page structure: ${JSON.stringify(tableCount, null, 2)}`);
    
    // Extract patient data from the page
    const patients = await globalPage.evaluate((searchName) => {
      const patientData: PatientInfo[] = [];
      
      // Look for table rows containing patient data - be more specific about the structure
      const rows = document.querySelectorAll('tbody tr, tr[data-patient], .patient-row');
      
      console.log(`Found ${rows.length} table rows to examine`);
      
      rows.forEach((row, index) => {
        const rowText = row.textContent?.toLowerCase() || '';
        console.log(`Row ${index}: ${rowText.substring(0, 100)}...`);
        
        if (rowText.includes(searchName.toLowerCase())) {
          console.log(`Found matching row for: ${searchName}`);
          
          const patient: PatientInfo = {
            name: '',
            id: '',
          };
          
          // Extract name from the row text
          // Pattern: "xxFirstName LastNameid" -> extract "FirstName LastName"
          const nameMatch = rowText.match(/^.{2}([a-z\s]+?)id:/i);
          if (nameMatch && nameMatch[1]) {
            patient.name = nameMatch[1].trim()
              .split(' ')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ');
          }
          
          // Extract ID
          const idMatch = rowText.match(/id:\s*(\d+)/i);
          if (idMatch) {
            patient.id = idMatch[1];
          }
          
          // Extract DOB (date pattern)
          const dobMatch = rowText.match(/(\d{2}\/\d{2}\/\d{4})/);
          if (dobMatch) {
            patient.dob = dobMatch[1];
          }
          
          // Extract gender (male/female after date)
          const genderMatch = rowText.match(/\d{4}(male|female)/i);
          if (genderMatch) {
            patient.gender = genderMatch[1];
          }
          
          // Extract phone (pattern like (555) 123-4567)
          const phoneMatch = rowText.match(/\((\d{3})\)\s*(\d{3})-(\d{4})/);
          if (phoneMatch) {
            patient.phone = `(${phoneMatch[1]}) ${phoneMatch[2]}-${phoneMatch[3]}`;
          }
          
          console.log(`Extracted patient: ${JSON.stringify(patient)}`);
          
          if (patient.name && patient.name !== '') {
            patientData.push(patient);
          }
        }
      });
      
      console.log(`Total patients found: ${patientData.length}`);
      return patientData;
    }, patientName);
    
    console.error(`Found ${patients.length} matching patients using Puppeteer`);
    return patients;
    
  } catch (error) {
    console.error("Patient search failed:", error);
    throw error;
  }
}
