import { describe, expect, it } from "vitest";
import { parseSseStream, SseStreamError } from "@/lib/ai/sse";

function streamBytes(chunks: Uint8Array[], failAfter = -1): ReadableStream<Uint8Array> {
  let index = 0;
  return new ReadableStream({
    pull(controller) {
      if (index === failAfter) {
        controller.error(new Error("socket closed"));
        return;
      }
      if (index >= chunks.length) {
        controller.close();
        return;
      }
      controller.enqueue(chunks[index]);
      index += 1;
    },
  });
}

async function collect(stream: ReadableStream<Uint8Array>) {
  const result = [];
  for await (const message of parseSseStream(stream)) result.push(message);
  return result;
}

describe("parseSseStream", () => {
  it("handles arbitrary byte boundaries, UTF-8 Chinese, CRLF, comments and DONE", async () => {
    const encoded = new TextEncoder().encode(
      ": keepalive\r\nevent: response.output_text.delta\r\ndata: {\"delta\":\"中文\"}\r\n\r\ndata: [DONE]\r\n\r\n",
    );
    const chunks = [encoded.slice(0, 47), encoded.slice(47, 61), encoded.slice(61, 64), encoded.slice(64)];
    await expect(collect(streamBytes(chunks))).resolves.toEqual([
      { event: "response.output_text.delta", data: '{"delta":"中文"}' },
      { event: undefined, data: "[DONE]" },
    ]);
  });

  it("emits the final event even without a trailing blank line", async () => {
    const encoded = new TextEncoder().encode("event: error\ndata: {\"message\":\"失敗\"}");
    await expect(collect(streamBytes([encoded]))).resolves.toEqual([
      { event: "error", data: '{"message":"失敗"}' },
    ]);
  });

  it("reports an interrupted connection clearly", async () => {
    const encoded = new TextEncoder().encode("data: partial");
    await expect(collect(streamBytes([encoded], 1))).rejects.toBeInstanceOf(SseStreamError);
    await expect(collect(streamBytes([encoded], 1))).rejects.toThrow("串流連線中斷");
  });

  it("rejects an empty body", async () => {
    await expect(collect(null as never)).rejects.toThrow("沒有可讀取的內容");
  });
});
