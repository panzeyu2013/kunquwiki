export function repairJson(raw: string) {
  let text = raw.trim();
  if (!text) {
    return null;
  }

  text = stripCodeFences(text);
  const extracted = extractFirstJsonObject(text);
  if (extracted) {
    text = extracted;
  }

  text = text.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
  text = text.replace(/,\s*([}\]])/g, "$1");

  try {
    return JSON.parse(text) as unknown;
  } catch {
    try {
      const repaired = text.replace(/'([^']*)'/g, '"$1"');
      return JSON.parse(repaired) as unknown;
    } catch {
      return null;
    }
  }
}

function stripCodeFences(text: string) {
  return text.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
}

function extractFirstJsonObject(text: string) {
  const start = text.indexOf("{");
  if (start === -1) {
    return null;
  }
  let depth = 0;
  for (let i = start; i < text.length; i += 1) {
    const char = text[i];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) {
      return text.slice(start, i + 1);
    }
  }
  return null;
}
