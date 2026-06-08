import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

// Initialize server-side Gemini Client
const aiClient = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

interface ScrapedMedia {
  posterUrl: string | null;
  coverUrl: string | null;
  trailerUrl: string | null;
}

async function scrapeMovieMedia(movieName: string): Promise<ScrapedMedia> {
  let posterUrl: string | null = null;
  let coverUrl: string | null = null;
  let trailerUrl: string | null = null;

  try {
    const searchUrl = `https://www.themoviedb.org/search?query=${encodeURIComponent(movieName)}`;
    const response = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9"
      }
    });

    if (response.ok) {
      const html = await response.text();
      const moviePaths = html.match(/\/movie\/\d+[^"'\s>]+/g);
      if (moviePaths && moviePaths.length > 0) {
        const firstMoviePath = moviePaths[0];
        const pageUrl = `https://www.themoviedb.org${firstMoviePath}`;
        const pageResponse = await fetch(pageUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9"
          }
        });

        if (pageResponse.ok) {
          const detailHtml = await pageResponse.text();
          const tmdbImages = detailHtml.match(/\/t\/p\/[^"'\s>]+/g) || [];
          const posterHashes: string[] = [];
          const backdropHashes: string[] = [];
          
          for (const img of tmdbImages) {
            const parts = img.split("/");
            const hash = parts[parts.length - 1];
            if (!hash || !hash.endsWith(".jpg")) continue;

            if (img.includes("multi_faces") || img.includes("backdrop") || img.includes("w780") || img.includes("w1000_and_h563") || img.includes("w1920")) {
              if (!backdropHashes.includes(hash)) backdropHashes.push(hash);
            } else if (img.includes("face") || img.includes("poster") || img.includes("w300") || img.includes("w600") || img.includes("w500")) {
              if (!posterHashes.includes(hash)) posterHashes.push(hash);
            }
          }

          if (posterHashes.length > 0) {
            posterUrl = `https://image.tmdb.org/t/p/w500/${posterHashes[0]}`;
          }
          if (backdropHashes.length > 0) {
            coverUrl = `https://image.tmdb.org/t/p/original/${backdropHashes[0]}`;
          } else if (posterHashes.length > 0) {
            coverUrl = `https://image.tmdb.org/t/p/original/${posterHashes[0]}`;
          }
        }
      }

      if (!posterUrl) {
        const searchImages = html.match(/\/t\/p\/[^"'\s>]+/g) || [];
        const hashes = searchImages
          .map(path => path.split("/").pop())
          .filter((h): h is string => typeof h === "string" && h.endsWith(".jpg"));
        
        if (hashes.length > 0) {
          posterUrl = `https://image.tmdb.org/t/p/w500/${hashes[0]}`;
          coverUrl = `https://image.tmdb.org/t/p/original/${hashes[0]}`;
        }
      }
    }
  } catch (err) {
    console.warn("Failed to scrape TMDB movie media:", err);
  }

  try {
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(movieName + " official trailer")}`;
    const response = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9"
      }
    });

    if (response.ok) {
      const html = await response.text();
      const videoIdMatches = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/g);
      if (videoIdMatches && videoIdMatches.length > 0) {
        const videoId = videoIdMatches[0].replace(/"videoId":"|"/g, '');
        trailerUrl = `https://www.youtube.com/watch?v=${videoId}`;
      } else {
        const watchMatches = html.match(/\/watch\?v=([a-zA-Z0-9_-]{11})/);
        if (watchMatches && watchMatches.length > 1) {
          trailerUrl = `https://www.youtube.com/watch?v=${watchMatches[1]}`;
        }
      }
    }
  } catch (err) {
    console.warn("Failed to scrape YouTube trailer:", err);
  }

  // General fallbacks using beautiful high-quality imagery to avoid blank spots
  if (!posterUrl) {
    posterUrl = `https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=600&auto=format&fit=crop`;
  }
  if (!coverUrl) {
    coverUrl = `https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=1200&auto=format&fit=crop`;
  }

  return { posterUrl, coverUrl, trailerUrl };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Router
  const apiRouter = express.Router();

  // Health Check
  apiRouter.get("/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Example API: Analytics
  apiRouter.get("/analytics", (req, res) => {
    res.json({
      totalMovies: 14208,
      totalDownloads: 1200000,
      activeUsers: 840,
    });
  });

  // AI Movie Auto-Fill Endpoint
  apiRouter.post("/movies/autofill", async (req, res) => {
    const { movieName } = req.body;
    if (!movieName || typeof movieName !== 'string' || !movieName.trim()) {
      return res.status(400).json({ error: "Please provide a valid movie name." });
    }

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(550).json({ error: "Server error: Gemini API key is missing. Please add GEMINI_API_KEY to your settings secrets." });
      }

      // Generate metadata using a robust fallback strategy to handle quotas/high demand
      let response;
      try {
        // Step A: Use gemini-3.1-flash-lite (extremely high throughput, reliable, and skips the resource-intensive search tool)
        response = await aiClient.models.generateContent({
          model: "gemini-3.1-flash-lite",
          contents: `Provide complete and accurate metadata for the movie: "${movieName}".
You MUST find or generate the absolute real, actual poster image URL and backdrop cover image URL for this movie.

Return ONLY a JSON object that matches the following schema:
{
  "title": "Movie Title",
  "description": "Synopsis summary of the movie",
  "releaseYear": 2024,
  "imdbRating": 8.5,
  "runtime": 140,
  "language": "English",
  "country": "United States",
  "genres": ["Action", "Sci-Fi"],
  "posterUrl": "https://image.tmdb.org/t/p/w500/somepath.jpg",
  "coverUrl": "https://image.tmdb.org/t/p/original/someotherpath.jpg",
  "trailerUrl": "https://..."
}

CRITICAL URL RULES:
1. "posterUrl" and "coverUrl" MUST be real, fully valid, live-working image URLs.
2. If using TMDB (image.tmdb.org), the paths MUST be complete real paths ending with a file extension like ".jpg" or ".png". Do NOT output partial or guessed paths like "/gh9Zg8" without file extensions!
3. If TMDB urls cannot be confirmed, find public high-quality movie artwork/posters from Wikipedia or Wikimedia Commons, IMDb, Unsplash, or fanart.tv. The URL MUST be a full direct link to a real image.
4. "trailerUrl" MUST be a valid, live YouTube trailer link (e.g., "https://www.youtube.com/watch?v=...").`,
          config: {
            responseMimeType: "application/json",
          }
        });
      } catch (liteErr: any) {
        console.warn("gemini-3.1-flash-lite failed or rate-limited, falling back to gemini-3.5-flash:", liteErr.message || liteErr);
        
        // Step B: Direct fallback to gemini-3.5-flash
        response = await aiClient.models.generateContent({
          model: "gemini-3.5-flash",
          contents: `Provide complete and accurate metadata for the movie: "${movieName}".
You MUST find or generate the absolute real, actual poster image URL and backdrop cover image URL for this movie.

Return ONLY a JSON object that matches the following schema:
{
  "title": "Movie Title",
  "description": "Synopsis summary of the movie",
  "releaseYear": 2024,
  "imdbRating": 8.5,
  "runtime": 140,
  "language": "English",
  "country": "United States",
  "genres": ["Action", "Sci-Fi"],
  "posterUrl": "https://image.tmdb.org/t/p/w500/somepath.jpg",
  "coverUrl": "https://image.tmdb.org/t/p/original/someotherpath.jpg",
  "trailerUrl": "https://..."
}

CRITICAL URL RULES:
1. "posterUrl" and "coverUrl" MUST be real, fully valid, live-working image URLs.
2. If using TMDB (image.tmdb.org), the paths MUST be complete real paths ending with a file extension like ".jpg" or ".png".
3. If TMDB urls cannot be confirmed, find public high-quality movie artwork/posters from Wikipedia or Wikimedia Commons, IMDb, Unsplash, or fanart.tv. The URL MUST be a full direct link to a real image.
4. "trailerUrl" MUST be a valid, live YouTube trailer link.`,
          config: {
            responseMimeType: "application/json",
          }
        });
      }

      const text = response.text;
      if (!text) {
        throw new Error("Received empty response content from Gemini.");
      }

      // Parse JSON
      let cleanJson = text.trim();
      if (cleanJson.startsWith("```")) {
        cleanJson = cleanJson.replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/```$/, "").trim();
      }

      const parsedData = JSON.parse(cleanJson);

      // Perform real-time media scraping to ensure high-fidelity working URLs for poster, cover, and trailer
      try {
        const searchTitle = parsedData.title || movieName;
        const media = await scrapeMovieMedia(searchTitle);
        if (media.posterUrl) parsedData.posterUrl = media.posterUrl;
        if (media.coverUrl) parsedData.coverUrl = media.coverUrl;
        if (media.trailerUrl) parsedData.trailerUrl = media.trailerUrl;
      } catch (scrapeErr) {
        console.warn("Media scraper correction overlay failed, returning parsed Gemini values as fallback:", scrapeErr);
      }

      res.json(parsedData);
    } catch (err: any) {
      console.error("AI Auto-Fill route error:", err);
      res.status(500).json({ error: err.message || "Failed to fetch movie details from Gemini." });
    }
  });

  // Mount APIs
  app.use("/api", apiRouter);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // For Express 4 (which is what we have)
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
