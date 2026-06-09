export const importChunkSize = 9000;

export function splitImportText(text: string, chunkSize = importChunkSize) {
  const lines = text.split(/\r?\n/);
  const chunks: string[] = [];
  let current = "";

  for (const line of lines) {
    if ((current + "\n" + line).length > chunkSize && current.trim()) {
      chunks.push(current.trim());
      current = "";
    }
    current += `${line}\n`;
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks;
}
