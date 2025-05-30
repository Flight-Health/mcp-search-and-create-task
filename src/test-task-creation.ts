#!/usr/bin/env node

import dotenv from "dotenv";
import { createTask } from "./task-creation.js";
import { closeBrowser } from "./browser.js";

// Load environment variables
dotenv.config();

async function testTaskCreation() {
  try {
    console.log("Starting task creation test...");
    
    const result = await createTask("billing", "Test Task from Terminal", "This is a test task created from terminal");
    
    console.log("Task creation result:", result);
    
  } catch (error) {
    console.error("Test failed:", error);
  } finally {
    // Clean up
    await closeBrowser();
    process.exit(0);
  }
}

testTaskCreation(); 