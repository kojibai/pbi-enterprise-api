import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

export type ZipInputFile = {
  name: string;
  bytes: Buffer;
};

export async function createZipFromFiles(files: ZipInputFile[]): Promise<{ zipPath: string; cleanup: () => Promise<void> }> {
  const baseDir = await mkdtemp(path.join(tmpdir(), "pbi-export-"));
  const zipPath = path.join(baseDir, "export.zip");
  const filePaths: string[] = [];

  for (const file of files) {
    const filePath = path.join(baseDir, file.name);
    await writeFile(filePath, file.bytes);
    filePaths.push(filePath);
  }

  await new Promise<void>((resolve, reject) => {
    const proc = spawn("zip", ["-q", "-j", zipPath, ...filePaths], { stdio: "ignore" });
    proc.on("error", reject);
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
}
