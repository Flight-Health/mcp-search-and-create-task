#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  InitializeRequestSchema,
  CallToolRequest,
  ListToolsRequest,
  InitializeRequest,
  CallToolResult,
  ListToolsResult,
  InitializeResult,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import dotenv from "dotenv";

// Import our modular components
import { HelloWorldArgs, SearchPatientV2Args, CreateTaskArgs } from "./types.js";
import { searchPatients } from "./patient-search.js";
import { createTask } from "./task-creation.js";
import { closeBrowser } from "./browser.js";

// Load environment variables
dotenv.config();

// Type guard functions for runtime validation
function isSearchPatientV2Args(args: any): args is SearchPatientV2Args {
  return args && typeof args.patient_name === "string";
}

function isHelloWorldArgs(args: any): args is HelloWorldArgs {
  return !args || typeof args.name === "string" || args.name === undefined;
}

function isCreateTaskArgs(args: any): args is CreateTaskArgs {
  return args && typeof args.task_type === "string" && typeof args.task_name === "string";
}

// Create server instance
const server = new Server(
  {
    name: "patient-search-v2-server",
    version: "2.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handle initialization
server.setRequestHandler(InitializeRequestSchema, async (): Promise<InitializeResult> => {
  return {
    protocolVersion: "2024-11-05",
    capabilities: {
      tools: {},
    },
    serverInfo: {
      name: "patient-search-v2-server",
      version: "2.0.0",
    },
  };
});

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async (): Promise<ListToolsResult> => {
  const tools: Tool[] = [
    {
      name: "hello_world",
      description: "A simple hello world function to test MCP connection",
      inputSchema: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Name to greet",
          },
        },
      },
    },
    {
      name: "search_patient_v2",
      description: "Search for patients in the Flight Health Atlas system by name using advanced web automation",
      inputSchema: {
        type: "object",
        properties: {
          patient_name: {
            type: "string",
            description: "Name of the patient to search for (e.g., 'Abigal', 'John', 'Smith')",
          },
          detailed: {
            type: "boolean",
            description: "Whether to return detailed patient information",
            default: false,
          },
        },
        required: ["patient_name"],
      },
    },
    {
      name: "create_new_task",
      description: "Create a new task in the Flight Health Atlas system using web automation",
      inputSchema: {
        type: "object",
        properties: {
          task_type: {
            type: "string",
            description: "Type of task to create",
            enum: ["billing", "clinical", "front_desk", "practice", "management", "support"],
          },
          task_name: {
            type: "string",
            description: "Name/title of the task",
          },
          description: {
            type: "string",
            description: "Optional description for the task",
          },
        },
        required: ["task_type", "task_name"],
      },
    },
  ];

  return { tools };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest): Promise<CallToolResult> => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "hello_world": {
      if (!isHelloWorldArgs(args)) {
        throw new Error("Invalid arguments for hello_world tool");
      }
      const { name: greetName } = args;
      return {
        content: [
          {
            type: "text",
            text: `Hello, ${greetName || "World"}! MCP TypeScript Patient Search V2 server is working correctly.`,
          },
        ],
      };
    }

    case "search_patient_v2": {
      if (!isSearchPatientV2Args(args)) {
        throw new Error("Invalid arguments for search_patient_v2 tool - patient_name is required");
      }
      
      const { patient_name, detailed = false } = args;
      
      try {
        console.error(`Starting patient search V2 for: ${patient_name}`);
        const patients = await searchPatients(patient_name, detailed);
        
        if (patients.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `🔍 No patients found matching "${patient_name}" in the Flight Health Atlas system (V2 search).`,
              },
            ],
          };
        }
        
        let response = `🏥 Found ${patients.length} patient(s) matching "${patient_name}" (V2 search):\n\n`;
        
        patients.forEach((patient, index) => {
          response += `**Patient ${index + 1}:**\n`;
          response += `• Name: ${patient.name}\n`;
          response += `• ID: ${patient.id}\n`;
          if (patient.dob) response += `• Date of Birth: ${patient.dob}\n`;
          if (patient.gender) response += `• Gender: ${patient.gender}\n`;
          if (patient.phone) response += `• Phone: ${patient.phone}\n`;
          if (patient.primaryInsurance) response += `• Primary Insurance: ${patient.primaryInsurance}\n`;
          if (patient.secondaryInsurance) response += `• Secondary Insurance: ${patient.secondaryInsurance}\n`;
          if (patient.pcp) response += `• PCP: ${patient.pcp}\n`;
          if (patient.lastAppointment) response += `• Last Appointment: ${patient.lastAppointment}\n`;
          response += `\n`;
        });
        
        return {
          content: [
            {
              type: "text",
              text: response,
            },
          ],
        };
        
      } catch (error) {
        console.error("Patient search V2 error:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text",
              text: `❌ Error searching for patient "${patient_name}" (V2): ${errorMessage}`,
            },
          ],
        };
      }
    }

    case "create_new_task": {
      if (!isCreateTaskArgs(args)) {
        throw new Error("Invalid arguments for create_new_task tool - task_type and task_name are required");
      }
      
      const { task_type, task_name, description } = args;
      
      try {
        console.error(`Starting task creation: ${task_name} (${task_type})`);
        const result = await createTask(task_type, task_name, description);
        
        return {
          content: [
            {
              type: "text",
              text: result.success ? `✅ ${result.message}` : `❌ ${result.message}`,
            },
          ],
        };
        
      } catch (error) {
        console.error("Task creation error:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text",
              text: `❌ Error creating task "${task_name}": ${errorMessage}`,
            },
          ],
        };
      }
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// Cleanup on exit
process.on('SIGINT', async () => {
  console.error("Shutting down gracefully...");
  await closeBrowser();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.error("Shutting down gracefully...");
  await closeBrowser();
  process.exit(0);
});

// Start the server
async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Patient Search MCP Server V2 running with Puppeteer web automation!");
}

main().catch((error: Error) => {
  console.error("Server V2 error:", error);
  process.exit(1);
});