'use client'
import { supabase } from "@/lib/supabase"

export default function LoginPage() {
  const handleLogin = async (provider: 'google' | 'discord') => {
  await supabase.auth.signInWithOAuth({
    provider,
    options: {
      // THIS MUST MATCH GOOGLE CONSOLE EXACTLY
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  })
}

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 text-white gap-6">
      <h1 className="text-4xl font-bold tracking-tighter">Poker Stats</h1>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button 
          onClick={() => handleLogin('google')}
          className="bg-white text-black p-3 rounded-xl font-bold hover:bg-zinc-200 transition-all"
        >
          Continue with Google
        </button>
        <button 
          onClick={() => handleLogin('discord')}
          className="bg-[#5865F2] text-white p-3 rounded-xl font-bold hover:bg-[#4752C4] transition-all"
        >
          Continue with Discord
        </button>
      </div>
    </div>
  )
}