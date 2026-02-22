// Auto-generated helper for line-reading benchmarks.
// Reads lines from stdin using Bun's native console async iterator.
async function main() {
  let count = 0;
  for await (const line of console) {
    if (line.trim() !== "") count++;
  }
  process.stdout.write(String(count));
}
main();
