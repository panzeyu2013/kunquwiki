import fs from "fs";
import path from "path";

export function loadJsonFile<T>(relativePath: string): T {
  const filePath = path.resolve(__dirname, "..", "data", relativePath);
  const raw = fs.readFileSync(filePath, "utf8");
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    throw new Error(`Failed to parse JSON at ${filePath}: ${(error as Error).message}`);
  }
}
