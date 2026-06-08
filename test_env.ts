import dotenv from "dotenv";
dotenv.config();

console.log("ENV VARS AVAILABLE IN SERVER:");
console.log("VITE_SUPABASE_URL:", process.env.VITE_SUPABASE_URL ? "SET" : "NOT SET");
console.log("VITE_SUPABASE_ANON_KEY:", process.env.VITE_SUPABASE_ANON_KEY ? "SET" : "NOT SET");
console.log("SUPABASE_SERVICE_ROLE_KEY:", process.env.SUPABASE_SERVICE_ROLE_KEY ? "SET" : "NOT SET");
console.log("DATABASE_URL:", process.env.DATABASE_URL ? "SET" : "NOT SET");
