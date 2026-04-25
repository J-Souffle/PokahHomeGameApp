'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/client'
import { useParams, useRouter } from 'next/navigation'
import { ChevronLeft, Users, Trophy, clock } from 'lucide-react'

export default function SessionDetailPage() {
  const { id: sessionId } = useParams()
  const router = useRouter()
  const supabase = createClient()
  const [details, setDetails] = useState<any>(null)

  useEffect(() => {
    async function getSessionDetails() {
      // Fetch session info + all player results for that session
      const { data: session } = await supabase
        .from('poker_sessions')
        .select('*, player_results(*, profiles(full_name))')
        .eq('id', sessionId)
        .single()
      
      if (session) setDetails(session)
    }
    getSessionDetails()
  }, [sessionId, supabase])

  if (!details) return <div className="p-8 text-white animate-pulse">Loading Session History...</div>

  const totalPot = details.player_results.reduce((acc, r) => acc + (r.final_chips || 0), 0)

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-8">
      <button onClick={() => router.back()} className="flex items-center gap-2 text-zinc-500 mb-8 hover:text-white transition-all">
        <ChevronLeft size={20} /> BACK TO DASHBOARD
      </button>

      <div className="max-w-2xl mx-auto space-y-8">
        <header>
          <h1 className="text-4xl font-black italic uppercase tracking-tighter">{details.game_name || 'The Lab Session'}</h1>
          <p className="text-zinc-500 font-mono text-sm uppercase mt-2">{new Date(details.created_at).toLocaleDateString()}</p>
        </header>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-zinc-900 p-6 rounded-3xl border border-zinc-800">
            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
              <Trophy size={12} /> Total Pot
            </p>
            <p className="text-4xl font-black mt-1">${totalPot}</p>
          </div>
          <div className="bg-zinc-900 p-6 rounded-3xl border border-zinc-800">
            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
              <Users size={12} /> Total Field
            </p>
            <p className="text-4xl font-black mt-1">{details.player_results.length} Players</p>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] overflow-hidden">
          <div className="p-6 border-b border-zinc-800">
            <h3 className="font-black uppercase italic text-sm">Leaderboard</h3>
          </div>
          <div className="divide-y divide-zinc-800">
            {details.player_results
              .sort((a, b) => (b.final_chips || 0) - (a.final_chips || 0))
              .map((res, i) => {
                const profit = res.final_chips - (details.buy_in * (1 + res.rebuys))
                return (
                  <div key={res.id} className="p-6 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <span className="text-zinc-700 font-black italic">#{i+1}</span>
                      <span className="font-bold uppercase">{res.profiles?.full_name}</span>
                    </div>
                    <span className={`font-black ${profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {profit >= 0 ? '+' : ''}${profit.toFixed(2)}
                    </span>
                  </div>
                )
              })}
          </div>
        </div>
      </div>
    </div>
  )
}