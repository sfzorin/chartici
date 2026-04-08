import userGuideContent from '../assets/user_guide.md?raw';

/**
 * Builds the full messages array for the Moonshot API.
 * All prompt logic lives here on the frontend — backend is a dumb proxy.
 */

const SYSTEM_PROMPT = `You are a Chartici diagram generator. The user describes a diagram in natural language, you return ONLY valid JSON in the .cci format. No text, no explanations, no markdown — just pure JSON.

<CCI FORMAT SPECIFICATION>
${userGuideContent}
</CCI FORMAT SPECIFICATION>

RULES:
1. Always return a complete .cci JSON with fields: title, aspect, diagramType, theme, data.groups, data.edges
2. Choose the correct diagramType based on the user's request
3. Every node must have a unique id (use snake_case with a numeric suffix, e.g. "api_gateway_1")
4. Every sourceId and targetId in edges must reference an existing node id
5. Use color integers from 1 to 9 only
6. Choose size based on diagram density: XS/S for dense diagrams, L/XL for simple ones
7. Node labels: short and concise (1-3 words)
8. Edge labels: even shorter (1-2 words, verb)
9. Group related nodes into one group with shared color and type
10. For ERD use connectionType with crow's foot notation (1:N, N:M, etc.)
11. For timeline use rect for spine nodes and circle for event bubbles
12. Use a fitting theme from the available list based on the diagram's subject
13. Default to aspect "16:9" unless the user requests something specific
14. If the user writes in a non-English language, use that language for all labels and the title`;

export function buildMessages(userPrompt) {
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userPrompt }
  ];
}

/**
 * Calls the backend proxy which forwards to Moonshot API.
 * Returns { success, cci } or { success, error }.
 */
export async function generateDiagram(userPrompt) {
  const messages = buildMessages(userPrompt);

  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages,
      model: 'moonshot-v1-128k',
      temperature: 0.3
    })
  });

  const data = await res.json();

  if (!data.success) {
    return { success: false, error: data.error || 'Unknown error' };
  }

  // Parse the raw content from Kimi
  const rawContent = data.content;
  let parsed;

  try {
    // Try direct JSON parse first
    parsed = JSON.parse(rawContent);
  } catch {
    // Try extracting from markdown code block
    const match = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) {
      try {
        parsed = JSON.parse(match[1].trim());
      } catch {
        return { success: false, error: 'AI returned invalid JSON' };
      }
    } else {
      return { success: false, error: 'AI returned invalid JSON' };
    }
  }

  // Basic validation
  if (!parsed.data || !parsed.data.groups || !parsed.data.edges) {
    return { success: false, error: 'AI returned incomplete diagram data' };
  }

  return { success: true, cci: parsed };
}
