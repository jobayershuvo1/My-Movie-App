import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

// Initialize server-side Gemini Client with lazy/on-demand loading
let cachedClient: GoogleGenAI | null = null;
let cachedKey: string | null = null;

function getAiClient(): GoogleGenAI {
  let apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Server error: Gemini API key is missing. Please add GEMINI_API_KEY to your settings secrets.");
  }
  
  // Strip any surrounding whitespace or literal quotes (e.g. from environment file wrapping)
  apiKey = apiKey.trim().replace(/^['"]|['"]$/g, '');

  if (!cachedClient || cachedKey !== apiKey) {
    cachedKey = apiKey;
    cachedClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return cachedClient;
}

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
      signal: AbortSignal.timeout(4000),
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept-Language": "en-US,en;q=0.9"
      }
    });

    if (response.ok) {
      let html = await response.text();
      html = html.slice(0, 300000); // limit regex search space
      const moviePaths = html.match(/\/movie\/\d+[^"'\s>]+/g);
      if (moviePaths && moviePaths.length > 0) {
        const firstMoviePath = moviePaths[0].replace(/"/g, '');
        const pageUrl = `https://www.themoviedb.org${firstMoviePath}`;
        const pageResponse = await fetch(pageUrl, {
          signal: AbortSignal.timeout(4000),
          headers: {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
          }
        });

        if (pageResponse.ok) {
          let detailHtml = await pageResponse.text();
          detailHtml = detailHtml.slice(0, 500000); // limit string size
          const tmdbImages = detailHtml.match(/\/t\/p\/[^"'\s>]+/g) || [];
          const posterHashes: string[] = [];
          const backdropHashes: string[] = [];
          
          for (const img of tmdbImages) {
            const parts = img.split("/");
            const hash = parts[parts.length - 1];
            if (!hash || !hash.endsWith(".jpg")) continue;

            if (img.includes("multi_faces") || img.includes("backdrop") || img.includes("w780") || img.includes("w1000")) {
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
      signal: AbortSignal.timeout(4000),
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept-Language": "en-US,en;q=0.9"
      }
    });

    if (response.ok) {
      let html = await response.text();
      html = html.slice(0, 500000); 
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

  if (!posterUrl) {
    posterUrl = `https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=600&auto=format&fit=crop`;
  }
  if (!coverUrl) {
    coverUrl = `https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=1200&auto=format&fit=crop`;
  }

  return { posterUrl, coverUrl, trailerUrl };
}

const app = express();
app.use(express.json());

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
async function scrapeFullMovieData(movieName: string): Promise<any> {
  let title = movieName;
  let description = `A high-quality cinema release spotlighting ${movieName}.`;
  let releaseYear = new Date().getFullYear();
  let imdbRating = 7.5;
  let runtime = 120;
  let language = "English";
  let country = "United States";
  let genres = ["Drama", "Action"];
  let posterUrl = "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=600&auto=format&fit=crop";
  let coverUrl = "https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=1200&auto=format&fit=crop";
  let trailerUrl = "";

  try {
    const searchUrl = `https://www.themoviedb.org/search?query=${encodeURIComponent(movieName)}`;
    const response = await fetch(searchUrl, {
      signal: AbortSignal.timeout(5000),
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9"
      }
    });

    if (response.ok) {
      let html = await response.text();
      html = html.slice(0, 400000);
      const moviePaths = html.match(/\/movie\/\d+[^"'\s>]+/g);
      if (moviePaths && moviePaths.length > 0) {
        const firstMoviePath = moviePaths[0].replace(/"/g, '');
        const pageUrl = `https://www.themoviedb.org${firstMoviePath}`;
        
        const pageResponse = await fetch(pageUrl, {
          signal: AbortSignal.timeout(5000),
          headers: {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9"
          }
        });

        if (pageResponse.ok) {
          let detailHtml = await pageResponse.text();
          detailHtml = detailHtml.slice(0, 600000);

          // Extract Title & Year
          const titleTagMatch = detailHtml.match(/<title>(.*?)\s*\((.*?)\)\s*—/);
          if (titleTagMatch) {
            title = titleTagMatch[1].trim();
            const yr = parseInt(titleTagMatch[2]);
            if (!isNaN(yr)) releaseYear = yr;
          }

          // Extract Description
          const ogDescMatch = detailHtml.match(/<meta property="og:description" content="(.*?)"/i) ||
                             detailHtml.match(/<meta name="description" content="(.*?)"/i);
          if (ogDescMatch && ogDescMatch[1]) {
            description = ogDescMatch[1]
              .replace(/&quot;/g, '"')
              .replace(/&amp;/g, '&')
              .replace(/&#39;/g, "'")
              .replace(/&lt;/g, "<")
              .replace(/&gt;/g, ">")
              .trim();
          }

          // Extract Genres
          const genreMatches = detailHtml.match(/href="\/genre\/\d+-[^">]*"[^>]*>(.*?)<\/a>/gi);
          if (genreMatches && genreMatches.length > 0) {
            const genresSet = new Set<string>();
            for (const m of genreMatches) {
              const cleaned = m.replace(/<[^>]*>/g, '').trim();
              if (cleaned && cleaned.length < 25) {
                genresSet.add(cleaned);
              }
            }
            if (genresSet.size > 0) {
              genres = Array.from(genresSet).slice(0, 4);
            }
          }

          // Extract Rating
          const scoreMatch = detailHtml.match(/data-percent="(\d+)"/i);
          if (scoreMatch) {
            imdbRating = parseFloat((parseInt(scoreMatch[1]) / 10).toFixed(1));
          }

          // Extract Runtime
          const runtimeMatch = detailHtml.match(/<span class="runtime">(.*?)<\/span>/i);
          if (runtimeMatch) {
            const duration = runtimeMatch[1].trim();
            const h = duration.match(/(\d+)h/i);
            const m = duration.match(/(\d+)m/i);
            let tot = 0;
            if (h) tot += parseInt(h[1]) * 60;
            if (m) tot += parseInt(m[1]);
            if (tot > 0) runtime = tot;
          }

          // Extract Images
          const tmdbImages = detailHtml.match(/\/t\/p\/[^"'\s>]+/g) || [];
          const posterHashes: string[] = [];
          const backdropHashes: string[] = [];
          for (const img of tmdbImages) {
            const parts = img.split("/");
            const hash = parts[parts.length - 1];
            if (!hash || !hash.endsWith(".jpg")) continue;

            if (img.includes("backdrop") || img.includes("w780") || img.includes("w1000")) {
              if (!backdropHashes.includes(hash)) backdropHashes.push(hash);
            } else if (img.includes("poster") || img.includes("w300") || img.includes("w500")) {
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

      if (posterUrl.includes("unsplash")) {
        const searchImages = html.match(/\/t\/p\/[^"'\s>]+/g) || [];
        const hashes = searchImages
          .map(p => p.split("/").pop())
          .filter((h): h is string => typeof h === "string" && h.endsWith(".jpg"));
        if (hashes.length > 0) {
          posterUrl = `https://image.tmdb.org/t/p/w500/${hashes[0]}`;
          coverUrl = `https://image.tmdb.org/t/p/original/${hashes[0]}`;
        }
      }
    }
  } catch (err) {
    console.warn("Direct details scraper failed:", err);
  }

  // Fetch Youtube Trailer
  try {
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(title + " official trailer")}`;
    const response = await fetch(searchUrl, {
      signal: AbortSignal.timeout(4000),
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept-Language": "en-US,en;q=0.9"
      }
    });

    if (response.ok) {
      let html = await response.text();
      html = html.slice(0, 500000); 
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
    console.warn("Direct trailer scraper failed:", err);
  }

  // No trailer found — leave empty so the UI can hide the trailer section
  // instead of showing a wrong/placeholder video.
  if (!trailerUrl) {
    trailerUrl = "";
  }

  return {
    title,
    description,
    releaseYear,
    imdbRating,
    runtime,
    language,
    country,
    genres,
    posterUrl,
    coverUrl,
    trailerUrl
  };
}

apiRouter.post("/movies/autofill", async (req, res) => {
  const { movieName } = req.body;
  if (!movieName || typeof movieName !== 'string' || !movieName.trim()) {
    return res.status(400).json({ error: "Please provide a valid movie name." });
  }

  let parsedData: any = null;

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined in environments.");
    }

    // Generate metadata using Gemini Client
    let response;
    try {
      // Step A: Use gemini-2.0-flash-lite
      response = await getAiClient().models.generateContent({
        model: "gemini-2.0-flash-lite",
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
      console.warn("gemini-2.0-flash-lite failed, falling back to gemini-2.0-flash:", liteErr.message || liteErr);

      // Step B: Direct fallback to gemini-2.0-flash
      response = await getAiClient().models.generateContent({
        model: "gemini-2.0-flash",
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

    parsedData = JSON.parse(cleanJson);

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
  } catch (err: any) {
    console.warn("Gemini service unavailable. Falling back to direct HTML Web Scraper:", err.message || err);
    try {
      parsedData = await scrapeFullMovieData(movieName);
    } catch (fallbackErr: any) {
      console.error("Scraper fallback failed:", fallbackErr);
    }
  }

  if (parsedData) {
    res.json(parsedData);
  } else {
    res.status(500).json({ error: "Failed to fetch movie details from both Gemini AI and scraping engines." });
  }
});

// Mount APIs
app.use("/api", apiRouter);

async function startServer() {
  const PORT = 3000;

  // Vite middleware for development (dynamic import — keep vite out of the prod/serverless bundle)
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
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

if (!process.env.VERCEL) {
  startServer();
}

export default app;
