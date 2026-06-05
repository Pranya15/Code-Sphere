import { GoogleGenerativeAI } from "@google/generative-ai";

function getModel() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  return new GoogleGenerativeAI(key).getGenerativeModel({ model: "gemini-1.5-flash" });
}

export async function runGemini(prompt, fallback) {
  const model = getModel();
  if (!model) return fallback;
  const result = await model.generateContent(prompt);
  return result.response.text();
}
