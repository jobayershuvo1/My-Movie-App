// Standalone Vercel serverless function for movie metadata autofill.
//
// Fills ALL fields (title, plot, year, rating, runtime, language, country,
// genres, poster, cover/backdrop, trailer).
//
// Primary source: TMDB API (https://www.themoviedb.org) — gives poster,
//   backdrop AND a YouTube trailer. Set TMDB_API_KEY (v3 key).
// Fallback source: OMDb API (https://www.omdbapi.com) — text + poster only,
//   no trailer/backdrop. Set OMDB_API_KEY.
//
// At least one of the two keys must be configured.

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

const TMDB_IMG = "https://image.tmdb.org/t/p";

function cleanKey(v: string | undefined): string {
  return (v || "").trim().replace(/^['"]|['"]$/g, "");
}

function parseRuntimeText(raw: string): number {
  const m = raw.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

// ---------- TMDB ----------
async function fetchFromTmdb(
  movieName: string,
  key: string
): Promise<AutofillResponse | null> {
  // 1. Search
  const searchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${key}&query=${encodeURIComponent(
    movieName
  )}&include_adult=false`;
  const sRes = await fetch(searchUrl, { signal: AbortSignal.timeout(8000) });
  if (!sRes.ok) return null;
  const sData: any = await sRes.json();
  const hit = sData?.results?.[0];
  if (!hit) return null;

  // 2. Details + videos
  const detailUrl = `https://api.themoviedb.org/3/movie/${hit.id}?api_key=${key}&append_to_response=videos`;
  const dRes = await fetch(detailUrl, { signal: AbortSignal.timeout(8000) });
  const d: any = dRes.ok ? await dRes.json() : hit;

  // Trailer: prefer official YouTube Trailer
  let trailerUrl = "";
  const vids: any[] = d?.videos?.results || [];
  const yt =
    vids.find((v) => v.site === "YouTube" && v.type === "Trailer" && v.official) ||
    vids.find((v) => v.site === "YouTube" && v.type === "Trailer") ||
    vids.find((v) => v.site === "YouTube");
  if (yt?.key) trailerUrl = `https://www.youtube.com/watch?v=${yt.key}`;

  return {
    title: d.title || hit.title || movieName,
    description: d.overview || hit.overview || "",
    releaseYear: (d.release_date || hit.release_date || "").slice(0, 4)
      ? parseInt((d.release_date || hit.release_date).slice(0, 4), 10)
      : new Date().getFullYear(),
    imdbRating: d.vote_average ? parseFloat(d.vote_average.toFixed(1)) : 0,
    runtime: d.runtime || 0,
    language: (d.original_language || "en").toUpperCase() === "EN"
      ? "English"
      : d.original_language || "English",
    country:
      d.production_countries?.[0]?.name ||
      d.origin_country?.[0] ||
      "United States",
    genres: (d.genres || []).map((g: any) => g.name).slice(0, 4),
    posterUrl: hit.poster_path
      ? `${TMDB_IMG}/w500${hit.poster_path}`
      : FALLBACK_POSTER,
    coverUrl: d.backdrop_path
      ? `${TMDB_IMG}/original${d.backdrop_path}`
      : hit.poster_path
      ? `${TMDB_IMG}/original${hit.poster_path}`
      : FALLBACK_POSTER,
    trailerUrl,
  };
}

// ---------- OMDb ----------
async function fetchFromOmdb(
  movieName: string,
  key: string
): Promise<AutofillResponse | null> {
  const url = `https://www.omdbapi.com/?apikey=${key}&t=${encodeURIComponent(
    movieName
  )}&plot=full`;
  const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) return null;
  const data: any = await r.json();
  if (data.Response === "False") return null;

  const poster =
    data.Poster && data.Poster !== "N/A" ? data.Poster : FALLBACK_POSTER;

  return {
    title: data.Title || movieName,
    description: data.Plot && data.Plot !== "N/A" ? data.Plot : "",
    releaseYear: parseInt(data.Year, 10) || new Date().getFullYear(),
    imdbRating:
      data.imdbRating && data.imdbRating !== "N/A"
        ? parseFloat(data.imdbRating)
        : 0,
    runtime: data.Runtime ? parseRuntimeText(data.Runtime) : 0,
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
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const movieName: string | undefined = req.body?.movieName;
  if (!movieName || typeof movieName !== "string" || !movieName.trim()) {
    return res.status(400).json({ error: "Please provide a valid movie name." });
  }
  const name = movieName.trim();

  const tmdbKey = cleanKey(process.env.TMDB_API_KEY);
  const omdbKey = cleanKey(process.env.OMDB_API_KEY);

  if (!tmdbKey && !omdbKey) {
    return res.status(500).json({
      error: "No autofill key configured. Set TMDB_API_KEY or OMDB_API_KEY.",
    });
  }

  let result: AutofillResponse | null = null;

  // Try TMDB first (richest data: trailer + backdrop)
  if (tmdbKey) {
    try {
      result = await fetchFromTmdb(name, tmdbKey);
    } catch {
      result = null;
    }
  }

  // Fallback to OMDb
  if (!result && omdbKey) {
    try {
      result = await fetchFromOmdb(name, omdbKey);
    } catch {
      result = null;
    }
  }

  if (!result) {
    return res
      .status(404)
      .json({ error: `No data found for "${name}". Check the title spelling.` });
  }

  return res.status(200).json(result);
}
