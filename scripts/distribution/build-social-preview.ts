import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Resvg } from "@resvg/resvg-js";

export interface BuildSocialPreviewOptions {
  inputPath?: string;
  outputPath?: string;
  width?: number;
}

export async function buildSocialPreview(options: BuildSocialPreviewOptions = {}): Promise<string> {
  const inputPath = path.resolve(options.inputPath ?? "assets/social-preview.svg");
  const outputPath = path.resolve(options.outputPath ?? "assets/social-preview.png");
  const width = options.width ?? 1280;

  const svg = await readFile(inputPath);
  const resvg = new Resvg(svg, {
    fitTo: {
      mode: "width",
      value: width
    },
    background: "rgba(0,0,0,0)"
  });

  const rendered = resvg.render();
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, rendered.asPng());
  return outputPath;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const outputPath = await buildSocialPreview();
  console.log(`AnswerLens social preview generated at ${outputPath}`);
}
