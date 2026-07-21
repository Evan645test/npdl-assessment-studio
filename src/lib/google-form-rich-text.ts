const BOLD_DIGIT_OFFSET = 0x1d7ce - 0x30;
const BOLD_UPPER_OFFSET = 0x1d5d4 - 0x41;
const BOLD_LOWER_OFFSET = 0x1d5ee - 0x61;
const ITALIC_UPPER_OFFSET = 0x1d608 - 0x41;
const ITALIC_LOWER_OFFSET = 0x1d622 - 0x61;

function toBoldAsciiChar(char: string): string {
  const code = char.charCodeAt(0);
  if (code >= 0x30 && code <= 0x39) {
    return String.fromCodePoint(code + BOLD_DIGIT_OFFSET);
  }
  if (code >= 0x41 && code <= 0x5a) {
    return String.fromCodePoint(code + BOLD_UPPER_OFFSET);
  }
  if (code >= 0x61 && code <= 0x7a) {
    return String.fromCodePoint(code + BOLD_LOWER_OFFSET);
  }
  return char;
}

function toItalicAsciiChar(char: string): string {
  const code = char.charCodeAt(0);
  if (code >= 0x41 && code <= 0x5a) {
    return String.fromCodePoint(code + ITALIC_UPPER_OFFSET);
  }
  if (code >= 0x61 && code <= 0x7a) {
    return String.fromCodePoint(code + ITALIC_LOWER_OFFSET);
  }
  return char;
}

function mapAscii(text: string, mapper: (char: string) => string): string {
  return [...text].map((char) => mapper(char)).join("");
}

/** Google Forms API 不支援 rich text；中文用【】、英文數字用 Unicode 粗體模擬。 */
export function formBold(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  if (/^[\x00-\x7F]+$/.test(trimmed)) {
    return mapAscii(trimmed, toBoldAsciiChar);
  }
  return `【${trimmed}】`;
}

/** 中文用「」、純英文用 Unicode 斜體模擬。 */
export function formItalic(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  if (/^[A-Za-z0-9\s.,!?;:'"()-]+$/.test(trimmed)) {
    return mapAscii(trimmed, toItalicAsciiChar);
  }
  return `「${trimmed}」`;
}

export function formLead(label: string, body: string): string {
  const content = body.trim();
  if (!content) return formBold(label);
  return `${formBold(label)}\n${content}`;
}

export function formBulletList(items: string[]): string {
  return items
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => `• ${item}`)
    .join("\n");
}

export function formNote(text: string): string {
  return `※ ${text.trim()}`;
}

export function enrichMarkdownEmphasis(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/gs, (_, inner: string) => formBold(inner))
    .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/gs, (_, inner: string) =>
      formItalic(inner),
    )
    .replace(/^>\s?/gm, "")
    .replace(/^[•·]\s*/gm, "• ");
}

export function joinFormBlocks(...blocks: Array<string | undefined>): string | undefined {
  const lines = blocks
    .map((block) => block?.trim())
    .filter((block): block is string => Boolean(block));
  return lines.length > 0 ? lines.join("\n\n") : undefined;
}
