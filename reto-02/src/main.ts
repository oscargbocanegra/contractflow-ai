import { loadEnvFile } from "node:process";
import { startServer } from "./server.js";
try {
  loadEnvFile(".env");
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT")
    throw new Error("Unable to load backend environment file");
}
await startServer();
