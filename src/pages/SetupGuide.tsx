import { LucideIcon, Database, ArrowRight } from 'lucide-react';

export default function SetupGuide() {
  return (
    <div className="min-h-screen bg-[#050505] text-[#E5E5E5] flex flex-col items-center justify-center p-6">
      <div className="max-w-2xl w-full glass p-8 rounded-2xl">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-red-600/20 text-red-500 rounded-xl flex items-center justify-center">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-sans text-white">CineVault Setup Required</h1>
            <p className="text-zinc-400 text-sm">Database connection needed to continue.</p>
          </div>
        </div>

        <div className="space-y-6 text-sm text-zinc-300">
          <p>You have configured the CineVault platform successfully, but it requires a Supabase connection to function.</p>
          
          <div className="bg-[#050505] p-4 rounded-lg border border-white/10 space-y-4">
            <h2 className="font-semibold text-white">Instructions:</h2>
            <ol className="list-decimal list-inside space-y-2">
              <li>Create a new project at <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-red-500 hover:underline">Supabase</a>.</li>
              <li>Go to Project Settings {'>'} API and copy your URL and Anon Key.</li>
              <li>In the AI Studio UI, open the <strong>Settings</strong> panel.</li>
              <li>Add <code className="text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">VITE_SUPABASE_URL</code> and your URL.</li>
              <li>Add <code className="text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">VITE_SUPABASE_ANON_KEY</code> and your Key.</li>
              <li>Execute the SQL found in <code className="text-zinc-400 bg-zinc-800 px-1.5 py-0.5 rounded">/supabase/schema.sql</code> in your Supabase SQL editor.</li>
            </ol>
          </div>
        </div>

        <div className="mt-8 flex justify-end">
          <button 
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-lg transition-colors font-medium cursor-pointer"
          >
            I have added the keys
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
