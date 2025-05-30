# Patient Search & Create Tasks MCP Server

This project provides a Model Context Protocol (MCP) server for searching patients in the Flight Health Atlas system and creating a new task.

## Features

- **V2 Server** (`server-v2.ts`): Uses Puppeteer for advanced web automation and more reliable login handling

## Prerequisites

- Node.js 18 or higher
- npm or yarn package manager

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd patient-search-mcp
```

2. Install dependencies:
```bash
npm install
```

3. Update Credentials
Go to `auth.ts` and replace the email and password in `LOGIN_CREDENTIALS` with your credentials. 
For demo purposes these are hardcoded since by default Cursor AI cannot access a .env file (possible to work around this by creating a .cursorignore file and adding !.env to it).

4. Build the servers:
```bash
npm build:v2      # only build the V2 server
npm run start     # Build and start V2 server
```

## Configuration

### For Cursor MCP

Add the following to your Cursor `mcp.json` file (found through Cursor Settings):

**V2 Server (Recommended):**
```json
{
  "mcpServers": {
    "patient-search-v2": {
      "command": "node",
      "args": ["/path/to/mcp-search-and-create-task/dist/server-v2.js"]
    }
  }
}
```

## Usage

### Available Tools

Both servers provide the following tools:

#### `hello_world`
- **Description**: Test MCP connection
- **Parameters**: 
  - `name` (optional): Name to greet

#### `search_patient_v2` (V2 Server)
- **Description**: Search for patients using Puppeteer web automation
- **Parameters**:
  - `patient_name` (required): Name of the patient to search for
  - `detailed` (optional): Whether to return detailed information

#### `create_new_task` (V2 Server)
- **Description**: Create a new task
- **Parameters**:
  - `task_type` (required): Type of the task to create
  - `task_name` (required): Name of the task to create
  - `description` (optional): Any description you want to add to the task

### Example Usage

```typescript
// Test connection
await callTool("hello_world", { name: "Aakarsh" });

// Search for a patient (V2 server)
await callTool("search_patient_v2", { 
  patient_name: "John Smith",
  detailed: true 
});
```

## Development

### Running in Development Mode

```bash
npm run dev

### Starting the Server

```bash
# Latest server
npm start

### Testing

You can test the servers directly using JSON-RPC messages:

```bash
# Test V2 server initialization
echo '{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2024-11-05", "capabilities": {}, "clientInfo": {"name": "test", "version": "1.0.0"}}}' | node dist/server-v2.js
```

I have also created a sample test file to test task creation called `test-task-creation`. You can run the test through the command `node dist/test-task-creation.js` once you have built the server.


## Troubleshooting

### Common Issues

1. **Browser launch fails (V2 server)**:
   - Ensure you have sufficient system resources
   - Try running with `--no-sandbox` flag (already included)

2. **Login fails**:
   - Verify credentials are correct
   - Check if the Atlas staging site is accessible
   - Ensure network connectivity

3. **Patient search returns no results**:
   - Verify the patient name spelling
   - Check if you're logged into the correct environment
   - Try with a partial name match

### Debug Mode

Both servers log debug information to stderr. Monitor the console output for detailed error messages.
Additionally if you need to clear the `/dist` folder you can run `npm run clean`.

## Dependencies

- `@modelcontextprotocol/sdk`: MCP TypeScript SDK
- `puppeteer`: Web automation (V2 server)
- `dotenv`: Environment variable management
