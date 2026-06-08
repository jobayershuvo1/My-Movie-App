import { GoogleGenAI } from "@google/genai";

const aiClient = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
});

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { movieName } = req.body;
  if (!movieName) {
    return res.status(400).json({ error: "Movie name required" });
  }

  try {
    const response = await aiClient.models.generateContent({
      model: "gemini-2.0-flash",
      contents: `Return ONLY JSON for movie "${movieName}":
{"title":"","description":"","releaseYear":0,"imdbRating":0,"runtime":0,"language":"","country":"","genres":[],"posterUrl":"","coverUrl":"","trailerUrl":""}`,
    });

    const text = response.text || "";
    const clean = text.replace(/json|/g, "").trim();
    res.json(JSON.parse(clean));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
