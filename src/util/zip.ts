// src/util/zip.ts
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createWriteStream } from "node:fs";
import archiver from "archiver";

export type ZipInputFile = {
  name: string;
  bytes: Buffer;
};

function safeEntryName(name: string): string {
  const trimmed = name.trim();

  // Disallow traversal or separators.
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

  try {
    await new Promise<void>((resolve, reject) => {
      const output = createWriteStream(zipPath);
      const archive = archiver("zip", { zlib: { level: 9 } });

      output.on("close", () => resolve());
      output.on("error", (err) => reject(err));

      archive.on("error", (err) => reject(err));
      archive.pipe(output);

      for (const f of files) {
        archive.append(f.bytes, { name: safeEntryName(f.name) });
      }

      void archive.finalize();
    });

    return {
      zipPath,
      cleanup: async () => {
        await rm(baseDir, { recursive: true, force: true });
      }
    };
  } catch (err) {
    try {
      await rm(baseDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup failure
    }
    throw err;
  }
}
