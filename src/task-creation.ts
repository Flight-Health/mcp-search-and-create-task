import { TaskResult } from "./types.js";
import { loginToAtlas, getAtlasBaseUrl, setLoginStatus } from "./auth.js";
import { getGlobalPage } from "./browser.js";

export async function createTask(taskType: string, taskName: string, description?: string): Promise<TaskResult> {
  try {
    // Ensure we're logged in
    await loginToAtlas();
    
    const globalPage = getGlobalPage();
    if (!globalPage) {
      throw new Error("Browser page not available");
    }
    
    console.error(`Navigating to tasks page...`);
    
    // Navigate to tasks page
    await globalPage.goto(`${getAtlasBaseUrl()}/tasks?tab=all`, { waitUntil: 'networkidle0' });
    
    // Check if we're redirected to login (session expired)
    if (globalPage.url().includes('/login')) {
      console.error("Session expired, re-logging in...");
      setLoginStatus(false);
      await loginToAtlas();
      await globalPage.goto(`${getAtlasBaseUrl()}/tasks?tab=all`, { waitUntil: 'networkidle0' });
    }
    
    console.error(`Creating new task: ${taskName} (${taskType})...`);
    
    // Set up network monitoring to catch server errors
    let networkError: string | null = null;
    let requestDetails: any = null;
    
    const responseHandler = (response: any) => {
      if (response.status() >= 400) {
        networkError = `HTTP ${response.status()}: ${response.statusText()}`;
        console.error(`Network error detected: ${networkError}`);
        console.error(`Failed URL: ${response.url()}`);
      }
    };
    
    const requestHandler = (request: any) => {
      const url = request.url();
      const method = request.method();
      
      // Capture task creation requests
      if (url.includes('/tasks') && method === 'POST') {
        requestDetails = {
          url: url,
          method: method,
          headers: request.headers(),
          postData: request.postData()
        };
        console.error(`Capturing task creation request:`, JSON.stringify(requestDetails, null, 2));
      }
    };
    
    globalPage.on('response', responseHandler);
    globalPage.on('request', requestHandler);
    
    try {
      // Debug: Log page structure
      try {
        const pageInfo = await globalPage.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button')).map(btn => ({
            text: btn.textContent?.trim() || '',
            className: btn.className || '',
            id: btn.id || '',
            tagName: btn.tagName
          }));
          
          const links = Array.from(document.querySelectorAll('a')).map(link => ({
            text: link.textContent?.trim() || '',
            href: link.href || '',
            className: link.className || ''
          }));
          
          // Look for any element containing "New Task" or "Task"
          const allElements = Array.from(document.querySelectorAll('*')).filter(el => {
            const text = el.textContent?.toLowerCase() || '';
            return text.includes('new task') || (text.includes('new') && text.includes('task'));
          }).map(el => ({
            text: el.textContent?.trim() || '',
            tagName: el.tagName,
            className: el.className || '',
            id: el.id || ''
          }));
          
          return {
            title: document.title,
            url: window.location.href,
            buttons: buttons.slice(0, 10), // First 10 buttons
            links: links.slice(0, 10), // First 10 links
            newTaskElements: allElements,
            allText: document.body.textContent?.substring(0, 500) || ''
          };
        });
        
        console.error("Page debug info:", JSON.stringify(pageInfo, null, 2));
      } catch (error) {
        console.error("Could not get page debug info:", error);
      }
      
      // Wait a bit more for the page to fully load
      await globalPage.waitForTimeout(3000);
      console.error("Waited for page to fully load...");
      
      // Click "New Task" button
      try {
        // First, try to find any element containing "New Task" text
        const newTaskElement = await globalPage.evaluate(() => {
          // Look specifically for clickable elements (buttons, links) with "New Task" text
          const clickableSelectors = ['a', 'button', '[role="button"]', '.btn'];
          
          for (const selector of clickableSelectors) {
            const elements = Array.from(document.querySelectorAll(selector));
            for (const el of elements) {
              const text = el.textContent?.toLowerCase() || '';
              const htmlEl = el as HTMLElement;
              if (text.includes('new task') && htmlEl.offsetParent !== null) { // visible element
                return {
                  tagName: el.tagName,
                  className: el.className,
                  id: el.id,
                  text: el.textContent?.trim(),
                  href: (el as HTMLAnchorElement).href || '',
                  isClickable: true
                };
              }
            }
          }
          return null;
        });
        
        console.error("Found New Task element:", newTaskElement);
        
        if (newTaskElement) {
          // Click the specific New Task button/link
          if (newTaskElement.tagName === 'A') {
            // If it's a link, try clicking by href or by element
            await globalPage.click(`a[href*="new"]`);
          } else {
            // Try clicking by text content using evaluate
            await globalPage.evaluate(() => {
              const buttons = Array.from(document.querySelectorAll('button'));
              for (const btn of buttons) {
                if (btn.textContent?.toLowerCase().includes('new task')) {
                  btn.click();
                  return;
                }
              }
            });
          }
          console.error("Clicked New Task element");
        } else {
          // Fallback: try different approaches
          const buttonSelectors = [
            'a[href*="new"]',
            'a[href*="task"]'
          ];
          
          let buttonFound = false;
          
          for (const selector of buttonSelectors) {
            try {
              await globalPage.waitForSelector(selector, { timeout: 2000 });
              await globalPage.click(selector);
              console.error(`Clicked New Task button using selector: ${selector}`);
              buttonFound = true;
              break;
            } catch (error) {
              continue;
            }
          }
          
          if (!buttonFound) {
            // Try clicking by text content using evaluate
            try {
              await globalPage.evaluate(() => {
                const allElements = Array.from(document.querySelectorAll('a, button, [role="button"]'));
                for (const el of allElements) {
                  const text = el.textContent?.toLowerCase() || '';
                  if (text.includes('new task')) {
                    (el as HTMLElement).click();
                    return true;
                  }
                }
                return false;
              });
              console.error("Clicked New Task button using JavaScript click");
              buttonFound = true;
            } catch (error) {
              throw new Error("Could not find New Task button");
            }
          }
        }
        
      } catch (error) {
        console.error("Error clicking New Task button:", error);
        throw new Error(`Could not click New Task button: ${error}`);
      }
      
      // Wait for modal to appear
      try {
        const modalSelectors = [
          '.modal',
          '[role="dialog"]',
          '.task-modal',
          '.new-task-modal',
          '.dialog',
          '.popup',
          '.overlay',
          '[data-testid*="modal"]',
          '[class*="modal"]'
        ];
        
        let modalFound = false;
        for (const selector of modalSelectors) {
          try {
            await globalPage.waitForSelector(selector, { timeout: 2000 });
            console.error(`Task creation modal opened using selector: ${selector}`);
            modalFound = true;
            break;
          } catch (error) {
            continue;
          }
        }
        
        if (!modalFound) {
          // Wait a bit and check if any new elements appeared
          await globalPage.waitForTimeout(2000);
          console.error("Modal might have opened without detectable selector, continuing...");
        }
        
        // Wait longer for the modal content to fully load
        await globalPage.waitForTimeout(5000);
        console.error("Waited additional time for modal content to load...");
        
        // Debug: Check what's actually in the modal
        const modalContent = await globalPage.evaluate(() => {
          // Look for modal content
          const modals = document.querySelectorAll('.modal, [role="dialog"], .dialog');
          const modalInfo = Array.from(modals).map(modal => ({
            tagName: modal.tagName,
            className: modal.className,
            innerHTML: modal.innerHTML.substring(0, 1000), // First 1000 chars
            forms: Array.from(modal.querySelectorAll('form')).map(form => ({
              action: form.action,
              method: form.method,
              inputs: Array.from(form.querySelectorAll('input, select, textarea')).map(input => ({
                type: (input as HTMLInputElement).type || 'unknown',
                name: (input as HTMLInputElement).name || '',
                id: (input as HTMLInputElement).id || '',
                placeholder: (input as HTMLInputElement).placeholder || '',
                tagName: input.tagName
              }))
            }))
          }));
          
          return {
            modals: modalInfo,
            allForms: Array.from(document.querySelectorAll('form')).map(form => ({
              action: form.action,
              method: form.method,
              inputs: Array.from(form.querySelectorAll('input, select, textarea')).map(input => ({
                type: (input as HTMLInputElement).type || 'unknown',
                name: (input as HTMLInputElement).name || '',
                id: (input as HTMLInputElement).id || '',
                placeholder: (input as HTMLInputElement).placeholder || '',
                tagName: input.tagName
              }))
            }))
          };
        });
        
        console.error("Modal content debug:", JSON.stringify(modalContent, null, 2));
        
      } catch (error) {
        console.error("Warning: Could not detect modal opening, continuing anyway...");
      }
      
      // Select task type from dropdown
      try {
        // Look specifically for the task type dropdown
        console.error("Looking for task type dropdown...");
        
        const taskTypeDropdown = await globalPage.evaluate(() => {
          const selects = Array.from(document.querySelectorAll('select'));
          for (const select of selects) {
            if (select.name === 'task[task_type]' || select.id === 'task_type') {
              return {
                name: select.name,
                id: select.id,
                className: select.className,
                options: Array.from(select.options).map(opt => ({
                  value: opt.value,
                  text: opt.textContent?.trim() || ''
                }))
              };
            }
          }
          return null;
        });
        
        console.error("Found task type dropdown:", JSON.stringify(taskTypeDropdown, null, 2));
        
        if (!taskTypeDropdown) {
          throw new Error("Could not find task type dropdown with name 'task[task_type]' or id 'task_type'");
        }
        
        // Map our task types to the form values
        const taskTypeMapping: { [key: string]: string } = {
          'billing': 'billing',
          'clinical': 'clinical',
          'front desk': 'front_desk',
          'front_desk': 'front_desk',
          'practice': 'practice',
          'management': 'management',
          'support': 'support'
        };
        
        const formValue = taskTypeMapping[taskType.toLowerCase()] || taskType.toLowerCase().replace(' ', '_');
        console.error(`Mapping task type "${taskType}" to form value "${formValue}"`);
        
        // Verify the form value exists in the options
        const validOption = taskTypeDropdown.options.find(opt => opt.value === formValue);
        if (!validOption) {
          throw new Error(`Task type value "${formValue}" not found in dropdown options: ${taskTypeDropdown.options.map(o => o.value).join(', ')}`);
        }
        
        // Select the task type using the specific selector
        await globalPage.select('select[name="task[task_type]"], select#task_type', formValue);
        console.error(`Selected task type: ${taskType} (form value: ${formValue})`);
        
        // Verify the selection worked by checking the specific task type dropdown
        const selectedValue = await globalPage.evaluate(() => {
          const taskTypeSelect = document.querySelector('select[name="task[task_type]"], select#task_type') as HTMLSelectElement;
          return taskTypeSelect ? taskTypeSelect.value : null;
        });
        
        console.error(`Verified task type selection: ${selectedValue}`);
        
        if (selectedValue !== formValue) {
          throw new Error(`Task type selection failed. Expected: ${formValue}, Got: ${selectedValue}`);
        }
        
      } catch (error) {
        throw new Error(`Could not select task type ${taskType}: ${error}`);
      }
      
      // Fill in task name
      try {
        console.error("Looking for task name input field...");
        
        // Look specifically for the task name/title input
        const taskNameInput = await globalPage.evaluate(() => {
          const inputs = Array.from(document.querySelectorAll('input[type="text"], input:not([type])'));
          for (const input of inputs) {
            const htmlInput = input as HTMLInputElement;
            const name = htmlInput.name?.toLowerCase() || '';
            const id = htmlInput.id?.toLowerCase() || '';
            const placeholder = htmlInput.placeholder?.toLowerCase() || '';
            
            // Look specifically for task title/name fields, avoid due_date
            if ((name.includes('title') || name.includes('name') || 
                 id.includes('title') || id.includes('name') ||
                 placeholder.includes('title') || placeholder.includes('name') ||
                 placeholder.includes('task')) && 
                !name.includes('due') && !id.includes('due') && !placeholder.includes('due')) {
              return {
                name: htmlInput.name,
                id: htmlInput.id,
                placeholder: htmlInput.placeholder,
                tagName: htmlInput.tagName,
                type: htmlInput.type
              };
            }
          }
          return null;
        });
        
        console.error("Found task name input:", JSON.stringify(taskNameInput, null, 2));
        
        if (!taskNameInput) {
          throw new Error("Could not find task name/title input field");
        }
        
        // Clear the field first, then type the task name
        const selector = taskNameInput.name ? `input[name="${taskNameInput.name}"]` : 
                        taskNameInput.id ? `input#${taskNameInput.id}` : 
                        `input[placeholder*="${taskNameInput.placeholder}"]`;
        
        console.error(`Using selector for task name: ${selector}`);
        
        await globalPage.click(selector);
        await globalPage.evaluate((sel) => {
          const input = document.querySelector(sel) as HTMLInputElement;
          if (input) {
            input.value = '';  // Clear existing value
          }
        }, selector);
        await globalPage.type(selector, taskName);
        
        console.error(`Filled task name: "${taskName}" using selector: ${selector}`);
        
        // Verify the task name was entered correctly
        const enteredValue = await globalPage.evaluate((sel) => {
          const input = document.querySelector(sel) as HTMLInputElement;
          return input ? input.value : null;
        }, selector);
        
        console.error(`Verified task name value: "${enteredValue}"`);
        
        if (enteredValue !== taskName) {
          throw new Error(`Task name verification failed. Expected: "${taskName}", Got: "${enteredValue}"`);
        }
        
      } catch (error) {
        throw new Error(`Could not fill task name: ${error}`);
      }
      
      // Fill in description if provided
      if (description) {
        try {
          await globalPage.waitForSelector('textarea[name*="description"], textarea[placeholder*="description"], [data-testid="description"]', { timeout: 3000 });
          await globalPage.type('textarea[name*="description"], textarea[placeholder*="description"], [data-testid="description"]', description);
          console.error(`Filled description: ${description}`);
        } catch (error) {
          console.error(`Warning: Could not fill description: ${error}`);
          // Continue anyway - description might be optional
        }
      }
      
      // Click Create Task button
      try {
        // Look for any button containing "Create" text
        const createButton = await globalPage.evaluate(() => {
          const allButtons = Array.from(document.querySelectorAll('button, a[role="button"], .btn, [role="button"]'));
          for (const btn of allButtons) {
            const text = btn.textContent?.toLowerCase() || '';
            const htmlBtn = btn as HTMLElement;
            // Look specifically for "Create task" or similar variations
            if ((text.includes('create task') || text.includes('create') || text.includes('save') || text.includes('submit')) && htmlBtn.offsetParent !== null) {
              return {
                tagName: btn.tagName,
                className: btn.className,
                id: btn.id,
                text: btn.textContent?.trim(),
                isVisible: htmlBtn.offsetParent !== null
              };
            }
          }
          return null;
        });
        
        console.error("Found Create button:", createButton);
        
        if (createButton) {
          // Try to click the create button
          await globalPage.evaluate(() => {
            const allButtons = Array.from(document.querySelectorAll('button, a[role="button"], .btn, [role="button"]'));
            for (const btn of allButtons) {
              const text = btn.textContent?.toLowerCase() || '';
              const htmlBtn = btn as HTMLElement;
              if ((text.includes('create task') || text.includes('create') || text.includes('save') || text.includes('submit')) && htmlBtn.offsetParent !== null) {
                htmlBtn.click();
                return;
              }
            }
          });
          console.error("Clicked Create button using JavaScript click");
        } else {
          // If no create button found, try clicking any primary-looking button with blue styling
          const primaryButton = await globalPage.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            for (const btn of buttons) {
              const htmlBtn = btn as HTMLElement;
              const className = btn.className.toLowerCase();
              // Look for the specific blue button styling from the HTML
              if (htmlBtn.offsetParent !== null && (
                className.includes('bg-fl-blue') || 
                className.includes('bg-blue-500') ||
                (className.includes('text-white') && className.includes('blue'))
              )) {
                return {
                  tagName: btn.tagName,
                  className: btn.className,
                  text: btn.textContent?.trim()
                };
              }
            }
            return null;
          });
          
          console.error("Found primary button:", primaryButton);
          
          if (primaryButton) {
            await globalPage.evaluate(() => {
              const buttons = Array.from(document.querySelectorAll('button'));
              for (const btn of buttons) {
                const htmlBtn = btn as HTMLElement;
                const className = btn.className.toLowerCase();
                if (htmlBtn.offsetParent !== null && (
                  className.includes('bg-fl-blue') || 
                  className.includes('bg-blue-500') ||
                  (className.includes('text-white') && className.includes('blue'))
                )) {
                  htmlBtn.click();
                  return;
                }
              }
            });
            console.error("Clicked primary button");
          } else {
            throw new Error("Could not find Create task button or any blue primary button");
          }
        }
      } catch (error) {
        throw new Error(`Could not click Create Task button: ${error}`);
      }
      
      // Wait for task creation to complete and verify success
      try {
        // Wait a bit for the request to complete
        await globalPage.waitForTimeout(3000);
        
        // Check for any error messages or server errors
        const errorCheck = await globalPage.evaluate(() => {
          // Check for error messages in the page
          const errorSelectors = ['.error', '.alert-danger', '.notification-error', '.toast-error'];
          for (const selector of errorSelectors) {
            const errorEl = document.querySelector(selector);
            if (errorEl && errorEl.textContent) {
              return { hasError: true, errorMessage: errorEl.textContent.trim() };
            }
          }
          
          return { hasError: false, errorMessage: null };
        });
        
        // Check for network errors
        if (networkError) {
          globalPage.off('response', responseHandler);
          globalPage.off('request', requestHandler);
          throw new Error(`Network error during task creation: ${networkError}`);
        }
        
        if (errorCheck.hasError) {
          globalPage.off('response', responseHandler);
          globalPage.off('request', requestHandler);
          throw new Error(`Server error: ${errorCheck.errorMessage}`);
        }
        
        // Check if we're still on the same page or redirected
        const currentUrl = globalPage.url();
        console.error(`Current URL after submission: ${currentUrl}`);
        
        // Wait for modal to close (indicating form submission)
        try {
          await globalPage.waitForFunction(
            () => {
              const modal = document.querySelector('.modal, [role="dialog"], .dialog');
              return !modal || (modal as HTMLElement).style.display === 'none';
            },
            { timeout: 5000 }
          );
          console.error("Modal closed after form submission");
        } catch (error) {
          console.error("Modal did not close, checking for other success indicators");
        }
        
        // Wait a bit more for the page to update
        await globalPage.waitForTimeout(2000);
        
        // Check if task count increased by looking at the pagination info
        const taskCountCheck = await globalPage.evaluate(() => {
          // Look for pagination text like "1-42 of 42" 
          const paginationText = document.querySelector('.pagination, [class*="page"], [class*="total"]')?.textContent || '';
          const bodyText = document.body.textContent || '';
          
          // Look for patterns like "1-43 of 43" or "43 tasks"
          const countMatches = bodyText.match(/(\d+)\s*(?:of\s*(\d+)|tasks?)/gi) || [];
          
          return {
            paginationText,
            countMatches,
            bodyTextSample: bodyText.substring(0, 200)
          };
        });
        
        console.error("Task count check:", JSON.stringify(taskCountCheck, null, 2));
        
        // Look for success indicators
        const successCheck = await globalPage.evaluate((taskName) => {
          const bodyText = document.body.textContent?.toLowerCase() || '';
          const taskNameLower = taskName.toLowerCase();
          
          // Check if the task name appears in the page
          const taskNameFound = bodyText.includes(taskNameLower);
          
          // Look for success messages
          const successSelectors = ['.success', '.alert-success', '.notification-success', '.toast-success'];
          let successMessage = '';
          for (const selector of successSelectors) {
            const successEl = document.querySelector(selector);
            if (successEl && successEl.textContent) {
              successMessage = successEl.textContent.trim();
              break;
            }
          }
          
          return {
            taskNameFound,
            successMessage,
            hasSuccessIndicator: successMessage.length > 0 || taskNameFound
          };
        }, taskName);
        
        console.error("Success check:", JSON.stringify(successCheck, null, 2));
        
        // If we don't see clear success indicators, this might have failed
        if (!successCheck.hasSuccessIndicator) {
          // Try refreshing the page to see if the task appears
          console.error("No clear success indicators, refreshing page to check...");
          await globalPage.reload({ waitUntil: 'networkidle0' });
          await globalPage.waitForTimeout(2000);
          
          // Check again for the task
          const finalCheck = await globalPage.evaluate((taskName) => {
            const bodyText = document.body.textContent?.toLowerCase() || '';
            const taskNameLower = taskName.toLowerCase();
            return bodyText.includes(taskNameLower);
          }, taskName);
          
          if (!finalCheck) {
            throw new Error("Task was not created - it does not appear in the task list after refresh");
          }
        }
        
        console.error("Task creation appears to have succeeded");
        
      } catch (error) {
        console.error("Task creation verification failed:", error);
        globalPage.off('response', responseHandler);
        globalPage.off('request', requestHandler);
        throw new Error(`Task creation failed: ${error instanceof Error ? error.message : String(error)}`);
      }
      
    } catch (error) {
      // Clean up event listener on any error
      globalPage.off('response', responseHandler);
      globalPage.off('request', requestHandler);
      throw error;
    }
    
    // Clean up event listener
    globalPage.off('response', responseHandler);
    globalPage.off('request', requestHandler);
    
    // Try to extract task ID if possible
    let taskId: string | undefined;
    try {
      // Look for success message or new task in the list
      const successElement = await globalPage.$('.success, .toast, .notification');
      if (successElement) {
        const successText = await globalPage.evaluate(el => el.textContent, successElement);
        const idMatch = successText?.match(/task\s+#?(\d+)/i);
        if (idMatch) {
          taskId = idMatch[1];
        }
      }
    } catch (error) {
      console.error("Could not extract task ID");
    }
    
    return {
      success: true,
      message: `Task "${taskName}" created successfully${taskId ? ` with ID: ${taskId}` : ''}`,
      taskId
    };
    
  } catch (error) {
    console.error("Task creation failed:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `Failed to create task "${taskName}": ${errorMessage}`
    };
  }
} 