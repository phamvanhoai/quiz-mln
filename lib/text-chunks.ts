export const importChunkSize = 6000;

export function splitImportText(text: string, chunkSize = importChunkSize) {
  return splitImportTextWithMeta(text, chunkSize).map((chunk) => chunk.text);
}

export function splitImportTextWithMeta(text: string, chunkSize = importChunkSize) {
  const lines = text.split(/\r?\n/);
  const chunks: Array<{ text: string; startLine: number; endLine: number }> = [];
  let current = "";
  let startLine = 1;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if ((current + "\n" + line).length > chunkSize && current.trim()) {
      chunks.push({ text: current.trim(), startLine, endLine: index });
      current = "";
      startLine = index + 1;
    }
    current += `${line}\n`;
  }

  if (current.trim()) chunks.push({ text: current.trim(), startLine, endLine: lines.length });
  return chunks;
}
