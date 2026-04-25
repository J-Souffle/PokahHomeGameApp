'use client'
import { useState } from 'react'
import { createClient } from '@/lib/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Loader2, Hash, ArrowLeft } from 'lucide-react'

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

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return router.push('/login')
    }

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

    const { error: joinError } = await supabase
      .from('player_results')
      .insert({
        user_id: user.id,
        session_id: session.id,
        total_buy_in: session.buy_in,
        has_paid: false,
        rebuys: 0
      })

    if (joinError) {
      if (joinError.code === '23505') {
        router.push(`/dashboard/game/${session.id}`)
      } else {
        setError(`DB Error: ${joinError.message}`)
        setLoading(false)
      }
    } else {
      router.push(`/dashboard/game/${session.id}`)
    }
  }

  return (
    <div className="min-h-screen bg-black text-white p-6 flex flex-col items-center justify-center selection:bg-yellow-500/30 overflow-hidden relative">
      
      {/* Background Effect: Subtle glow */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-yellow-500/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-zinc-800/20 blur-[120px] rounded-full pointer-events-none" />

      {/* Navigation - Top Left (Absolute) */}
      <div className="absolute top-10 left-8 sm:top-12 sm:left-12">
        <Link 
          href="/dashboard" 
          className="group flex items-center gap-2 text-zinc-600 hover:text-white transition-all font-black italic text-xs tracking-[0.2em] uppercase"
        >
          <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          Abort to Hub
        </Link>
      </div>

      <div className="w-full max-w-sm z-10">
        <div className="text-center mb-12">
          <div className="inline-flex p-5 bg-zinc-900/50 border border-zinc-800 rounded-[2rem] mb-6 shadow-2xl">
            <span className="text-4xl animate-pulse">🃏</span>
          </div>
          <h1 className="text-5xl font-black italic uppercase tracking-tighter leading-none mb-3">
            JOIN THE <span className="text-yellow-500">LAB</span>
          </h1>
          <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.4em]">Initialize Session Access</p>
        </div>

        <form onSubmit={handleJoin} className="space-y-6">
          <div className="relative group">
            <Hash className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-800 group-focus-within:text-yellow-500 transition-colors" size={20} />
            <input 
              type="text"
              maxLength={4}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="0000"
              className="w-full bg-zinc-950 border-2 border-zinc-900 focus:border-yellow-500 text-center text-5xl font-black tracking-[0.5em] py-8 rounded-[2.5rem] outline-none transition-all placeholder:text-zinc-900 pl-10"
              autoFocus
            />
          </div>

          {error && (
            <div className="bg-red-500/5 border border-red-500/20 p-4 rounded-2xl animate-in fade-in zoom-in-95 duration-300">
              <p className="text-red-500 text-center text-[10px] font-black uppercase italic tracking-widest leading-tight">
                {error}
              </p>
            </div>
          )}

          <button 
            type="submit"
            disabled={loading || code.length < 4}
            className="w-full bg-white text-black py-6 rounded-[2rem] font-black uppercase italic text-xl transition-all hover:bg-yellow-500 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-20 shadow-[0_20px_50px_rgba(255,255,255,0.05)] flex items-center justify-center gap-3 group"
          >
            {loading ? (
              <Loader2 className="animate-spin text-black" size={24} />
            ) : (
              'Enter Sequence'
            )}
          </button>
        </form>
        
        <div className="mt-12 flex flex-col items-center gap-6">
            <div className="h-px w-12 bg-zinc-800" />
            
            {/* Primary Navigation - Visible on Mobile */}
            <Link 
              href="/dashboard" 
              className="flex items-center gap-2 text-zinc-500 hover:text-zinc-300 transition-colors font-black uppercase italic text-[10px] tracking-widest"
            >
              <ArrowLeft size={12} />
              Return to Dashboard
            </Link>

            <p className="text-zinc-700 text-[9px] text-center font-bold uppercase tracking-[0.3em] leading-relaxed max-w-[200px] opacity-50">
              Real-time synchronization enabled. Ensure code matches host display.
            </p>
        </div>
      </div>
    </div>
  )
}