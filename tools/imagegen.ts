#!/usr/bin/env bun
/**
 * Standalone CLI tool for generating images via the Instacart AI Gateway.
 * Supports OpenAI (gpt-image-1.5) and Gemini (gemini-3-pro-image-preview) providers.
 *
 * Usage: bun tools/imagegen.ts --prompt "A robot playing chess" --output out.png
 */

import { parseArgs } from 'util';
import { readFileSync, writeFileSync } from 'fs';
import OpenAI from 'openai';

const DEFAULT_GATEWAY_URL = 'https://aigateway.instacart.tools';
const DEFAULT_SOURCE = 'AvaWeb';
const DEFAULT_OPENAI_MODEL = 'gpt-image-1.5';
const DEFAULT_GEMINI_MODEL = 'gemini-3-pro-image-preview';
const GATEWAY_TAG = 'imageGen:recs-tools';

interface CliOptions {
  prompt: string;
  image?: string;
  output: string;
  provider: 'openai' | 'gemini';
  model: string;
  size: string;
  quality: 'high' | 'standard';
  n: number;
  gatewayUrl: string;
  source: string;
}

function printHelp(): void {
  console.log(`Usage: bun tools/imagegen.ts [options]

Options:
  --prompt, -p      Text prompt for image generation (required)
  --image, -i       Input image path for editing/reference
  --output, -o      Output file path (default: output.png)
  --provider        Provider: "openai" or "gemini" (default: openai)
  --model, -m       Model override (default: gpt-image-1.5 for openai, gemini-3-pro-image-preview for gemini)
  --size, -s        Image size (default: auto). Options: auto, 1024x1024, 1536x1024, etc.
  --quality, -q     Quality: high or standard (default: high)
  --n               Number of images (default: 1)
  --gateway-url     Gateway base URL (default: ${DEFAULT_GATEWAY_URL})
  --source          Gateway source identifier (default: AvaWeb)
  --help, -h        Show help`);
}

function parseCli(): CliOptions {
  const { values } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      prompt:       { type: 'string',  short: 'p' },
      image:        { type: 'string',  short: 'i' },
      output:       { type: 'string',  short: 'o', default: 'output.png' },
      provider:     { type: 'string' },
      model:        { type: 'string',  short: 'm' },
      size:         { type: 'string',  short: 's', default: 'auto' },
      quality:      { type: 'string',  short: 'q', default: 'high' },
      n:            { type: 'string' },
      'gateway-url': { type: 'string' },
      source:       { type: 'string' },
      help:         { type: 'boolean', short: 'h' },
    },
    strict: true,
  });

  if (values.help) {
    printHelp();
    process.exit(0);
  }

  if (!values.prompt) {
    console.error('Error: --prompt is required');
    printHelp();
    process.exit(1);
  }

  const provider = (values.provider ?? 'openai') as 'openai' | 'gemini';
  if (provider !== 'openai' && provider !== 'gemini') {
    console.error(`Error: --provider must be "openai" or "gemini", got "${provider}"`);
    process.exit(1);
  }

  const quality = (values.quality ?? 'high') as 'high' | 'standard';
  if (quality !== 'high' && quality !== 'standard') {
    console.error(`Error: --quality must be "high" or "standard", got "${quality}"`);
    process.exit(1);
  }

  const n = values.n ? parseInt(values.n, 10) : 1;
  if (isNaN(n) || n < 1) {
    console.error(`Error: --n must be a positive integer, got "${values.n}"`);
    process.exit(1);
  }

  const defaultModel = provider === 'openai' ? DEFAULT_OPENAI_MODEL : DEFAULT_GEMINI_MODEL;

  return {
    prompt: values.prompt,
    image: values.image,
    output: values.output ?? 'output.png',
    provider,
    model: values.model ?? defaultModel,
    size: values.size ?? 'auto',
    quality,
    n,
    gatewayUrl: values['gateway-url'] ?? DEFAULT_GATEWAY_URL,
    source: values.source ?? DEFAULT_SOURCE,
  };
}

function readImageAsBase64(imagePath: string): string {
  const buffer = readFileSync(imagePath);
  return Buffer.from(buffer).toString('base64');
}

function detectMimeType(imagePath: string): string {
  const ext = imagePath.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'png':  return 'image/png';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'gif':  return 'image/gif';
    case 'webp': return 'image/webp';
    default:     return 'image/png';
  }
}

async function generateWithOpenAI(opts: CliOptions): Promise<Buffer> {
  const client = new OpenAI({
    apiKey: '',
    baseURL: `${opts.gatewayUrl}/proxy/${opts.source}/openai/v1`,
    defaultHeaders: { 'x-aigateway-tag': GATEWAY_TAG },
  });

  if (opts.image) {
    const imageBuffer = readFileSync(opts.image);
    const imageFile = new File([imageBuffer], opts.image.split('/').pop() ?? 'image.png', {
      type: detectMimeType(opts.image),
    });

    const response = await client.images.edit({
      model: opts.model,
      image: imageFile,
      prompt: opts.prompt,
      n: opts.n,
      size: opts.size as '1024x1024' | '1536x1024' | '1024x1536',
    });

    const b64 = response.data?.[0]?.b64_json;
    if (!b64) {
      throw new Error('No image data in OpenAI edit response');
    }
    return Buffer.from(b64, 'base64');
  }

  const response = await client.images.generate({
    model: opts.model,
    prompt: opts.prompt,
    n: opts.n,
    size: opts.size as 'auto' | '1024x1024' | '1536x1024' | '1024x1536',
    quality: opts.quality === 'high' ? 'high' : 'medium',
  });

  const b64 = response.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error('No image data in OpenAI generate response');
  }
  return Buffer.from(b64, 'base64');
}

async function generateWithGemini(opts: CliOptions): Promise<Buffer> {
  const client = new OpenAI({
    apiKey: '',
    baseURL: `${opts.gatewayUrl}/unified/${opts.source}/v1`,
    defaultHeaders: { 'x-aigateway-tag': GATEWAY_TAG },
  });

  const contentParts: Array<OpenAI.ChatCompletionContentPartText | OpenAI.ChatCompletionContentPartImage> = [];

  if (opts.image) {
    const b64 = readImageAsBase64(opts.image);
    const mime = detectMimeType(opts.image);
    contentParts.push({
      type: 'image_url',
      image_url: { url: `data:${mime};base64,${b64}` },
    });
  }

  contentParts.push({
    type: 'text',
    text: `Generate an image: ${opts.prompt}`,
  });

  const response = await client.chat.completions.create({
    model: opts.model,
    messages: [{ role: 'user', content: contentParts }],
  });

  const content = response.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('No content in Gemini response');
  }

  // Try to extract base64 image data from the response.
  // The response may contain the base64 data directly, or wrapped in markdown/JSON.
  const b64Match = content.match(/data:image\/[^;]+;base64,([A-Za-z0-9+/=]+)/);
  if (b64Match?.[1]) {
    return Buffer.from(b64Match[1], 'base64');
  }

  // Try raw base64 (the whole content might be base64)
  const stripped = content.replace(/\s/g, '');
  if (/^[A-Za-z0-9+/=]{100,}$/.test(stripped)) {
    return Buffer.from(stripped, 'base64');
  }

  throw new Error(
    `Could not extract image data from Gemini response. Response starts with: ${content.slice(0, 200)}`
  );
}

async function main(): Promise<void> {
  const opts = parseCli();

  console.log(`Generating image with ${opts.provider} (model: ${opts.model})...`);
  if (opts.image) {
    console.log(`Using input image: ${opts.image}`);
  }

  let imageBuffer: Buffer;
  if (opts.provider === 'openai') {
    imageBuffer = await generateWithOpenAI(opts);
  } else {
    imageBuffer = await generateWithGemini(opts);
  }

  writeFileSync(opts.output, imageBuffer);

  // Read back and report dimensions if it's a PNG
  const fileSizeKb = (imageBuffer.length / 1024).toFixed(1);
  let dimensionInfo = '';
  if (imageBuffer[0] === 0x89 && imageBuffer[1] === 0x50) {
    // PNG: width at bytes 16-19, height at bytes 20-23 (big-endian)
    const width = imageBuffer.readUInt32BE(16);
    const height = imageBuffer.readUInt32BE(20);
    dimensionInfo = ` (${width}x${height})`;
  }

  console.log(`Image saved to ${opts.output}${dimensionInfo} [${fileSizeKb} KB]`);
}

main().catch((err: Error) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
