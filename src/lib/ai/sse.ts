export interface SseMessage {
  event?: string;
  data: string;
}

export class SseStreamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SseStreamError";
  }
}

function parseEventBlock(block: string): SseMessage | null {
  let event: string | undefined;
  const data: string[] = [];

  for (const rawLine of block.split("\n")) {
    const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
    if (!line || line.startsWith(":")) continue;
    const separator = line.indexOf(":");
    const field = separator === -1 ? line : line.slice(0, separator);
    let value = separator === -1 ? "" : line.slice(separator + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "event") event = value;
    if (field === "data") data.push(value);
  }

  if (!data.length) return null;
  return { event, data: data.join("\n") };
}

export async function* parseSseStream(
  stream: ReadableStream<Uint8Array> | null,
): AsyncGenerator<SseMessage> {
  if (!stream) throw new SseStreamError("串流回應沒有可讀取的內容");

  const reader = stream.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: false });
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");

      let boundary = buffer.indexOf("\n\n");
      while (boundary !== -1) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const message = parseEventBlock(block);
        if (message) yield message;
        boundary = buffer.indexOf("\n\n");
      }
    }

    buffer += decoder.decode().replace(/\r\n/g, "\n");
    const trailing = parseEventBlock(buffer.trimEnd());
    if (trailing) yield trailing;
  } catch (error) {
    throw new SseStreamError(
      `串流連線中斷：${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    reader.releaseLock();
  }
}
