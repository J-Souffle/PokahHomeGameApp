'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/client'
import { useParams, useRouter } from 'next/navigation'
import { ChevronLeft, Users, Trophy } from 'lucide-react'

export default function SessionDetailPage() {
  const { id: sessionId } = useParams()
  const router = useRouter()
  const supabase = createClient()
  const [details, setDetails] = useState<any>(null)

  useEffect(() => {
    async function getSessionDetails() {
      // 1. Fetch the session info
      // 2. Separately fetch player results joined with profiles
      // This is more reliable than one giant nested select
      const { data: session } = await supabase
        .from('poker_sessions')
        .select('*')
        .eq('id', sessionId)
        .single()

      if (session) {
        const { data: results } = await supabase
          .from('player_results')
          .select('*, profiles(display_name, full_name)')
          .eq('session_id', sessionId)
          .order('final_chips', { ascending: false })

        setDetails({ ...session, player_results: results || [] })
      }
    }
    getSessionDetails()
  }, [sessionId, supabase])

  if (!details) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="p-8 text-white font-mono animate-pulse uppercase tracking-[0.3em] text-sm">Accessing Session Vault...</div>
    </div>
  )

  const totalPot = details.player_results.reduce((acc: number, r: any) => acc + (parseFloat(r.final_chips) || 0), 0)

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-8 font-sans">
      <button 
        onClick={() => router.back()} 
        className="flex items-center gap-2 text-zinc-500 mb-12 hover:text-white transition-all font-black italic uppercase text-xs tracking-widest group"
      >
        <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> BACK TO DASHBOARD
      </button>

      <div className="max-w-3xl mx-auto space-y-8">
        <header>
          <h1 className="text-5xl font-black italic uppercase tracking-tighter">{details.game_name || 'Session Report'}</h1>
          <p className="text-zinc-600 font-mono text-xs uppercase mt-3 tracking-[0.2em]">
            {new Date(details.created_at).toLocaleDateString(undefined, { dateStyle: 'full' })}
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-zinc-900/40 p-8 rounded-[2rem] border border-zinc-800 shadow-xl">
            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
              <Trophy size={14} className="text-yellow-500" /> Total Pot
            </p>
            <p className="text-5xl font-black mt-1 tracking-tighter">${totalPot.toFixed(2)}</p>
          </div>
          <div className="bg-zinc-900/40 p-8 rounded-[2rem] border border-zinc-800 shadow-xl">
            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
              <Users size={14} className="text-blue-500" /> Total Field
            </p>
            <p className="text-5xl font-black mt-1 tracking-tighter">{details.player_results.length} Players</p>
          </div>
        </div>

        <div className="bg-zinc-900/20 border border-zinc-800/50 rounded-[2.5rem] overflow-hidden shadow-2xl">
          <div className="p-8 border-b border-zinc-800/50 bg-zinc-900/30">
            <h3 className="font-black uppercase italic text-sm tracking-widest text-zinc-400">Final Leaderboard</h3>
          </div>
          <div className="divide-y divide-zinc-800/50">
            {details.player_results.map((res: any, i: number) => {
              const profit = parseFloat(res.final_chips) - (parseFloat(details.buy_in) * (1 + (parseInt(res.rebuys) || 0)))
              return (
                <div key={res.id} className="p-8 flex justify-between items-center hover:bg-white/[0.01] transition-colors">
                  <div className="flex items-center gap-6">
                    <span className="text-zinc-800 font-black italic text-2xl">#{i + 1}</span>
                    <div>
                      <p className="font-black uppercase text-lg tracking-tight">{res.profiles?.full_name || 'Unknown Player'}</p>
                      <p className="text-zinc-600 font-mono text-[10px] uppercase">{res.rebuys} REBUYS</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-black text-2xl italic tracking-tighter ${profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {profit >= 0 ? '+' : ''}${profit.toFixed(2)}
                    </p>
                    <p className="text-zinc-600 text-[9px] font-bold uppercase tracking-widest">Net Profit</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}