import { GoogleGenerativeAI } from "@google/generative-ai";

function getModel() {
  const key = String(process.env.GEMINI_API_KEY || "").trim();
  if (!key || key === "your-gemini-api-key" || key.includes("placeholder")) return null;
  return new GoogleGenerativeAI(key).getGenerativeModel({ model: "gemini-1.5-flash" });
}

export async function runGemini(prompt, fallback) {
  const model = getModel();
  if (!model) return fallback;
  try {
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error("Gemini request failed:", error.message);
    return fallback;
  }
}
