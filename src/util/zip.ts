import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

export type ZipInputFile = {
  name: string;
  bytes: Buffer;
};

function safeEntryName(name: string): string {
  const trimmed = name.trim();

  // Disallow any path traversal or separators.
  if (
    trimmed.length === 0 ||
    trimmed.includes("..") ||
    trimmed.includes("/") ||
    trimmed.includes("\\") ||
    trimmed !== path.posix.basename(trimmed)
  ) {
    throw new Error("zip_invalid_entry_name");
  }

  return trimmed;
}

export async function createZipFromFiles(
  files: ZipInputFile[]
): Promise<{ zipPath: string; cleanup: () => Promise<void> }> {
  const baseDir = await mkdtemp(path.join(tmpdir(), "pbi-export-"));
  const zipPath = path.join(baseDir, "export.zip");
  const filePaths: string[] = [];

  try {
    for (const file of files) {
      const entry = safeEntryName(file.name);
      const filePath = path.join(baseDir, entry);
      await writeFile(filePath, file.bytes);
      filePaths.push(filePath);
    }

    await new Promise<void>((resolve, reject) => {
      const proc = spawn("zip", ["-q", "-j", zipPath, ...filePaths], { stdio: "ignore" });

      proc.on("error", (err) => {
        const msg =
          typeof err === "object" && err !== null && "code" in err && (err as { code?: unknown }).code === "ENOENT"
            ? "zip_binary_missing"
            : "zip_spawn_failed";
        reject(new Error(msg));
      });

      proc.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`zip_failed:${code ?? "unknown"}`));
      });
    });

    return {
      zipPath,
      cleanup: async () => {
        await rm(baseDir, { recursive: true, force: true });
      }
    };
  } catch (err) {
    // If zip building fails, clean up temp dir immediately.
    try {
      await rm(baseDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup failure
    }
    throw err;
  }
}
