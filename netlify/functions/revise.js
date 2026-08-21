const DEFAULT_MODEL = "openai/gpt-oss-20b";

// Model IDs that are served but are not text/chat-completion models.
const NON_CHAT_MODEL = /whisper|tts|guard|embed|playai/i;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });

export default async (req, context) => {
  // GET /api/revise -> live list of available chat models (no access token required;
  // this only exposes public model IDs, never the API key or any user data).
  if (req.method === "GET") {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/models", {
        headers: { "Authorization": `Bearer ${Netlify.env.get("GROQ_API_KEY")}` }
      });
      const data = await res.json();
      const models = (data.data || [])
        .filter(m => m.active !== false && !NON_CHAT_MODEL.test(m.id))
        .map(m => ({ id: m.id, owned_by: m.owned_by }))
        .sort((a, b) => a.id.localeCompare(b.id));
      return json({ models });
    } catch (e) {
      // Front-end falls back to its built-in list when this is empty.
      return json({ models: [] });
    }
  }

  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const { model, summary, accessToken } = await req.json();

  if (!accessToken || accessToken !== Netlify.env.get("ACCESS_TOKEN"))
    return new Response(JSON.stringify({ error: "Invalid access token." }), { status: 401 });

  if (!summary) return new Response(JSON.stringify({ error: "No summary provided." }), { status: 400 });

  const SYSTEM_PROMPT = `You are a medical editor. Your task is to revise medical summaries to improve clarity, readability, and grammatical accuracy while strictly preserving the original structure and content.

Rules you must follow:
- Do not add any new clinical information or change the meaning of any statement.
- Do not use bullet points, numbered lists, subtitles, bold, or italics anywhere in the output.
- Write in continuous, fluid prose — a single coherent narrative or fluid multi-paragraph format.
- Vital signs must be written exactly as: "The body temperature was __°C, the heart rate __ beats per minute, the blood pressure __/__ mm Hg, the respiratory rate __ breaths per minute, and the oxygen saturation __% while the patient was breathing __ (ambient air or oxygen device)."
- When introducing vital signs, use contextual phrases such as "at triage" or "upon visiting the emergency department (ED)" to ensure natural placement in the narrative.
- The revision is purely editorial — refine language, phrasing, and grammar only. Keep all medical content unchanged and clinically accurate.
- Do not use additional formatting such as italics or bold types.
- Use American English spelling and conventions throughout.`;

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Netlify.env.get("GROQ_API_KEY")}`
      },
      body: JSON.stringify({
        model: model || DEFAULT_MODEL,
        max_tokens: 1024,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Please revise the following medical summary:\n\n${summary}` }
        ]
      })
    });

    const data = await response.json();
    if (data.error) return new Response(JSON.stringify({ error: data.error.message }), { status: 500 });
    return new Response(JSON.stringify({ result: data.choices?.[0]?.message?.content || "" }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "Something went wrong. Please try again." }), { status: 500 });
  }
};

export const config = { path: "/api/revise" };
