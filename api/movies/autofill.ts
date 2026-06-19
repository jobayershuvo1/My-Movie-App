// Standalone Vercel serverless function for movie metadata autofill.
// Uses the OMDb API (free IMDb-backed JSON API) — fast, no scraping, no timeout risk.
// Get a free key at https://www.omdbapi.com/apikey.aspx and set OMDB_API_KEY.

interface AutofillResponse {
  title: string;
  description: string;
  releaseYear: number;
  imdbRating: number;
  runtime: number;
  language: string;
  country: string;
  genres: string[];
  posterUrl: string;
  coverUrl: string;
  trailerUrl: string;
}

const FALLBACK_POSTER =
  "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=600&auto=format&fit=crop";

function parseRuntime(raw: string): number {
  const m = raw.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const movieName: string | undefined = req.body?.movieName;
  if (!movieName || typeof movieName !== "string" || !movieName.trim()) {
    return res.status(400).json({ error: "Please provide a valid movie name." });
  }

  const apiKey = process.env.OMDB_API_KEY;
  if (!apiKey) {
    return res
      .status(500)
      .json({ error: "OMDB_API_KEY is not configured on the server." });
  }

  try {
    const url = `https://www.omdbapi.com/?apikey=${apiKey}&t=${encodeURIComponent(
      movieName.trim()
    )}&plot=full`;

    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) {
      return res.status(502).json({ error: `OMDb request failed (${r.status}).` });
    }

    const data: any = await r.json();
    if (data.Response === "False") {
      return res
        .status(404)
        .json({ error: data.Error || "Movie not found." });
    }

    const poster =
      data.Poster && data.Poster !== "N/A" ? data.Poster : FALLBACK_POSTER;

    const result: AutofillResponse = {
      title: data.Title || movieName,
      description: data.Plot && data.Plot !== "N/A" ? data.Plot : "",
      releaseYear: parseInt(data.Year, 10) || new Date().getFullYear(),
      imdbRating:
        data.imdbRating && data.imdbRating !== "N/A"
          ? parseFloat(data.imdbRating)
          : 0,
      runtime: data.Runtime ? parseRuntime(data.Runtime) : 0,
      language:
        data.Language && data.Language !== "N/A"
          ? data.Language.split(",")[0].trim()
          : "English",
      country:
        data.Country && data.Country !== "N/A"
          ? data.Country.split(",")[0].trim()
          : "United States",
      genres:
        data.Genre && data.Genre !== "N/A"
          ? data.Genre.split(",").map((g: string) => g.trim()).slice(0, 4)
          : [],
      posterUrl: poster,
      coverUrl: poster,
      trailerUrl: "",
    };

    return res.status(200).json(result);
  } catch (err: any) {
    return res
      .status(500)
      .json({ error: "Failed to fetch movie details: " + (err.message || err) });
  }
}
