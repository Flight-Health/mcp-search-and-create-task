// Type definitions for the patient search MCP server

export interface HelloWorldArgs {
  name?: string;
}

export interface SearchPatientV2Args {
  patient_name: string;
  detailed?: boolean;
}

export interface CreateTaskArgs {
  task_type: string;
  task_name: string;
  description?: string;
}

export interface TaskResult {
  success: boolean;
  message: string;
  taskId?: string;
}

export interface PatientInfo {
  name: string;
  id: string;
  dob?: string;
  gender?: string;
  phone?: string;
  email?: string;
  primaryInsurance?: string;
  secondaryInsurance?: string;
  pcp?: string;
  lastAppointment?: string;
}

export interface BrowserSession {
  browser: import('puppeteer').Browser;
  page: import('puppeteer').Page;
}

export interface LoginCredentials {
  email: string;
  password: string;
}
