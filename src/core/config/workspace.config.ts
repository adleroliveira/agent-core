import { Injectable } from "@nestjs/common";
import * as path from "path";
import * as fs from "fs";

@Injectable()
export class WorkspaceConfig {
  private workspacePath: string;

  constructor() {
    // Default to a 'workspace' directory in the project root
    this.workspacePath = path.join(process.cwd(), "workspace");
    this.ensureWorkspaceExists();
  }

  setWorkspacePath(path: string) {
    this.workspacePath = path;
    this.ensureWorkspaceExists();
  }

  getWorkspacePath(): string {
    return this.workspacePath;
  }

  private ensureWorkspaceExists() {
    if (!fs.existsSync(this.workspacePath)) {
      fs.mkdirSync(this.workspacePath, { recursive: true });
    }
  }
} 