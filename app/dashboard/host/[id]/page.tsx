'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/client'
import { useParams } from 'next/navigation'

export default function HostLobby() {
  const params = useParams()
  const sessionId = params.id as string
  const supabase = createClient()
  
  const [players, setPlayers] = useState<any[]>([])
  const [sessionData, setSessionData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  async function getData() {
    if (!sessionId) return
    
    // Fetch session details
    const { data: session } = await supabase
      .from('poker_sessions')
      .select('join_code, buy_in')
      .eq('id', sessionId)
      .single()
    
    if (session) setSessionData(session)

    // Fetch players with a safer query
    const { data: playerData, error: pError } = await supabase
      .from('player_results')
      .select(`
        id, 
        user_id, 
        has_paid, 
        rebuys
      `) // We'll fetch profiles separately if this fails
      .eq('session_id', sessionId)
    
    if (pError) {
      console.error("Fetch Error:", pError.message)
    } else {
      setPlayers(playerData || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    getData()
    const channel = supabase
      .channel('lobby-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'player_results' }, () => getData())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [sessionId])

  const addRebuy = async (id: string, current: number) => {
    await supabase.from('player_results').update({ rebuys: current + 1 }).eq('id', id)
  }

  const togglePaid = async (id: string, current: boolean) => {
    await supabase.from('player_results').update({ has_paid: !current }).eq('id', id)
  }

  if (loading) return <div className="p-8 text-white font-mono uppercase tracking-widest text-center">Syncing...</div>

  return (
    <div className="p-8 bg-zinc-950 min-h-screen text-white font-sans">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-end mb-10">
          <div>
            <h2 className="text-4xl font-black uppercase italic tracking-tighter">Command Center</h2>
            <div className="flex items-center gap-3 mt-2">
              <p className="text-zinc-500 font-mono text-[10px] uppercase">Join Code:</p>
              <span className="bg-yellow-500 text-black px-3 py-1 rounded-lg font-black text-xl">
                {sessionData?.join_code || '----'}
              </span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-zinc-600 text-[10px] font-black uppercase">Active Players</p>
            <p className="text-2xl font-black italic text-yellow-500">{players.length}</p>
          </div>
        </div>

        <div className="grid gap-4">
          {players.length === 0 ? (
            <div className="border-2 border-dashed border-zinc-900 rounded-[2rem] py-20 text-center">
              <p className="text-zinc-700 font-black uppercase italic tracking-widest animate-pulse">Awaiting Signal...</p>
            </div>
          ) : (
            players.map(player => (
              <div key={player.id} className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl flex justify-between items-center">
                <div>
                  <p className="font-black text-xl italic uppercase">Player {player.user_id.slice(0,4)}</p>
                  <p className="text-zinc-500 text-[10px] uppercase font-mono mt-1">
                    Rebuys: <span className="text-yellow-500 font-bold">{player.rebuys}</span>
                  </p>
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={() => togglePaid(player.id, player.has_paid)}
                    className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase border ${
                      player.has_paid ? 'bg-green-500/10 border-green-500 text-green-500' : 'bg-zinc-800 border-zinc-700 text-zinc-500'
                    }`}
                  >
                    {player.has_paid ? 'Paid' : 'Unpaid'}
                  </button>
                  <button 
                    onClick={() => addRebuy(player.id, player.rebuys)}
                    className="bg-white text-black px-6 py-3 rounded-2xl text-[10px] font-black uppercase"
                  >
                    + Rebuy
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}