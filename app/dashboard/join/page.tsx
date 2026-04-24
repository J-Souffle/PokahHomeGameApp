'use client'
import { useState } from 'react'
import { createClient } from '@/lib/client'
import { useRouter } from 'next/navigation'

export default function JoinGamePage() {
  const supabase = createClient()
  const router = useRouter()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // 1. Get User
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return router.push('/login')
    }

    // 2. Find the session with this join code
    const { data: session, error: sessionError } = await supabase
      .from('poker_sessions')
      .select('id, status, buy_in')
      .eq('join_code', code.toUpperCase())
      .single()

    if (sessionError || !session) {
      setError("Room not found. Check the code with the host.")
      setLoading(false)
      return
    }

    if (session.status === 'completed') {
      setError("This game has already ended.")
      setLoading(false)
      return
    }

    // 3. Attempt to Join (Insert into player_results)
    const { error: joinError } = await supabase
      .from('player_results')
      .insert({
        user_id: user.id,
        session_id: session.id,
        total_buy_in: session.buy_in, // <--- Add this line
        has_paid: false,
        rebuys: 0
      })

    if (joinError) {
      // 400 Bad Request Diagnostic
      console.error("--- JOIN ERROR DIAGNOSTIC ---")
      console.error("Message:", joinError.message)
      console.error("Code:", joinError.code)
      console.error("Details:", joinError.details)
      console.error("Hint:", joinError.hint)
      
      // If code is 23505, they are already in the session
      if (joinError.code === '23505') {
        router.push(`/dashboard/game/${session.id}`)
      } else {
        setError(`DB Error: ${joinError.message}`)
        setLoading(false)
      }
    } else {
      // Success!
      router.push(`/dashboard/game/${session.id}`)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6 flex flex-col items-center justify-center font-sans">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="inline-block p-4 bg-yellow-500/10 rounded-full mb-4">
            <span className="text-3xl">🃏</span>
          </div>
          <h1 className="text-3xl font-black italic uppercase tracking-tighter">Join the Lab</h1>
          <p className="text-zinc-500 text-[10px] font-mono uppercase tracking-widest mt-2">Enter Host's Session Code</p>
        </div>

        <form onSubmit={handleJoin} className="space-y-6">
          <input 
            type="text"
            maxLength={4}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="0000"
            className="w-full bg-zinc-900 border-2 border-zinc-800 focus:border-yellow-500 text-center text-5xl font-black tracking-[0.5em] py-6 rounded-3xl outline-none transition-all placeholder:text-zinc-800"
            autoFocus
          />

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-xl">
              <p className="text-red-500 text-center text-[10px] font-black uppercase italic leading-tight">
                {error}
              </p>
            </div>
          )}

          <button 
            type="submit"
            disabled={loading || code.length < 4}
            className="w-full bg-white text-black py-5 rounded-2xl font-black uppercase italic text-lg transition-all hover:bg-zinc-200 active:scale-95 disabled:opacity-20 shadow-xl shadow-white/5"
          >
            {loading ? 'Entering...' : 'Enter Room'}
          </button>
        </form>
        
        <p className="text-zinc-600 text-[10px] mt-10 text-center font-mono uppercase leading-relaxed">
          The host will manage your buy-ins and rebuys. <br/>
          Results update in real-time.
        </p>
      </div>
    </div>
  )
}