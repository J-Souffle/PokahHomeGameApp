'use client'
import { useState } from 'react'
import { createClient } from '@/lib/client'
import { useRouter } from 'next/navigation'

export default function CreateGamePage() {
  const supabase = createClient()
  const router = useRouter()
  const [buyIn, setBuyIn] = useState(20)
  const [sessionName, setSessionName] = useState('') // New state for name
  const [loading, setLoading] = useState(false)

  // Generates a simple 4-character join code (e.g., A7X2)
  const generateJoinCode = () => {
    return Math.random().toString(36).substring(2, 6).toUpperCase()
  }

  const handleCreateGame = async () => {
  setLoading(true)
  console.log("🚀 [Debug] Starting game creation...")
  
  const { data: { user } } = await supabase.auth.getUser()
  console.log("👤 [Debug] Current User:", user?.id || "No user found")

  if (!user) {
    setLoading(false)
    return
  }

  const joinCode = generateJoinCode()
  const payload = {
    host_id: user.id,
    name: sessionName.trim() || null,
    buy_in: buyIn,
    join_code: joinCode,
    status: 'waiting'
  }

  console.log("📦 [Debug] Sending Payload to Supabase:", payload)

  const { data, error } = await supabase
    .from('poker_sessions')
    .insert(payload)
    .select()
    .single()

  if (error) {
    // This will tell us if the error is "Column not found" (42703) or something else
    console.error("❌ [Debug] Supabase Insert Error:", error)
    alert(`Failed to initialize session: ${error.message}`)
    setLoading(false)
  } else {
    console.log("✅ [Debug] Session Created Successfully:", data)
    router.push(`/dashboard/host/${data.id}`)
  }
}

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-8 flex items-center justify-center font-sans">
      <div className="w-full max-w-md bg-zinc-900/50 border border-zinc-800 p-10 rounded-[2.5rem] shadow-2xl">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-black italic uppercase tracking-tighter mb-2">New High Table Session</h1>
          <p className="text-zinc-500 text-xs font-mono uppercase tracking-[0.2em]">Configure Game Parameters</p>
        </div>

        <div className="space-y-8">
          {/* Session Name Input */}
          <div>
            <label className="text-zinc-600 text-[10px] font-black uppercase tracking-widest block mb-3">Session Name (Optional)</label>
            <input 
              type="text"
              placeholder="e.g. Friday Night Heist"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-4 px-5 text-sm font-bold focus:outline-none focus:border-yellow-500 transition-colors placeholder:text-zinc-700"
            />
          </div>

          <div>
            <label className="text-zinc-600 text-[10px] font-black uppercase tracking-widest block mb-4">Initial Buy-In ($)</label>
            <div className="flex items-center gap-6">
              <input 
                type="range" 
                min="5" 
                max="200" 
                step="5"
                value={buyIn}
                onChange={(e) => setBuyIn(parseInt(e.target.value))}
                className="flex-1 accent-yellow-500 bg-zinc-800 h-1 rounded-full appearance-none cursor-pointer"
              />
              <span className="text-3xl font-black italic text-yellow-500 w-20 text-right">${buyIn}</span>
            </div>
          </div>

          <div className="pt-4">
            <button 
              onClick={handleCreateGame}
              disabled={loading}
              className="w-full bg-yellow-500 text-black py-5 rounded-2xl font-black uppercase italic text-lg transition-all hover:bg-yellow-400 hover:scale-[1.02] active:scale-95 shadow-xl shadow-yellow-500/10 disabled:opacity-50"
            >
              {loading ? 'Initializing...' : 'Generate Join Code'}
            </button>
          </div>
        </div>

        <p className="text-zinc-600 text-[10px] mt-8 text-center font-mono uppercase leading-relaxed">
          Once created, players can join using a unique code. <br/>You will manage all rebuys and payments.
        </p>
      </div>
    </div>
  )
}