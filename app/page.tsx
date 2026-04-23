'use client'
import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Player } from "@/types/poker"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { AddPlayerDrawer } from "@/components/AddPlayerDrawer"
import { CashOutDrawer } from "@/components/CashOutDrawer"
import { Trash2 } from "lucide-react"

const SESSION_ID = "43dfbd26-08fb-4436-b9ac-8485b7e81a58" 

export default function PokerDashboard() {
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchPlayers = async () => {
      const { data } = await supabase
        .from('players')
        .select('*')
        .eq('session_id', SESSION_ID)
        .order('created_at', { ascending: true })
      
      if (data) setPlayers(data)
      setLoading(false)
    }
    fetchPlayers()
  }, [])

  const addPlayer = async (name: string, buyIn: number) => {
    const { data, error } = await supabase
      .from('players')
      .insert([{ name, buy_in: buyIn, session_id: SESSION_ID, chips: 0 }])
      .select()

    if (error) { console.error("Error adding player:", error); return; }
    if (data) setPlayers((prev) => [...prev, ...data])
  }

  const handleCashOut = async (id: string, chips: number) => {
    const { error } = await supabase
      .from('players')
      .update({ chips })
      .eq('id', id);

    if (error) { console.error("Update error:", error); return; }
    setPlayers(prev => prev.map(p => p.id === id ? { ...p, chips } : p));
  };
  
  const removePlayer = async (id: string) => {
    const { error } = await supabase
      .from('players')
      .delete()
      .eq('id', id);

    if (error) {
      console.error("Error deleting player:", error);
      return;
    }
    setPlayers((prev) => prev.filter((p) => p.id !== id));
  };

  // --- DERIVED MATH ---
  const totalPot = players.reduce((sum, p) => sum + Number(p.buy_in), 0)
  const totalChips = players.reduce((sum, p) => sum + (Number(p.chips) || 0), 0);
  const isBalanced = totalPot === totalChips;

  const expectedInbound = players.reduce((sum, p) => {
    const net = (Number(p.chips) || 0) - Number(p.buy_in);
    return net < 0 ? sum + Math.abs(net) : sum;
  }, 0);

  const totalPayouts = players.reduce((sum, p) => {
    const net = (Number(p.chips) || 0) - Number(p.buy_in);
    return net > 0 ? sum + net : sum;
  }, 0);

  if (loading) return <div className="p-10 text-center text-zinc-500 font-sans">Loading game...</div>

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50 p-4 pb-32">
      <header className="mb-4">
        <h1 className="text-3xl font-bold tracking-tight">Friday Night Poker</h1>
        <p className="text-zinc-400">Total Pot: <span className="text-green-500 font-mono">${totalPot.toFixed(2)}</span></p>
      </header>

      {/* BANK SUMMARY TILES */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800">
          <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-1">Inbound (Venmos)</p>
          <p className="text-2xl font-mono text-blue-400 font-bold">${expectedInbound.toFixed(2)}</p>
        </div>
        <div className="bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800">
          <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-1">Payouts (Winners)</p>
          <p className="text-2xl font-mono text-orange-400 font-bold">${totalPayouts.toFixed(2)}</p>
        </div>
      </div>

      {/* BALANCE CHECKER */}
      {totalChips > 0 && (
        <div className={`text-xs font-mono mb-6 px-4 py-3 rounded-xl border transition-all ${
          isBalanced 
          ? 'text-zinc-400 border-zinc-800 bg-zinc-900/30' 
          : 'text-red-400 border-red-900/50 bg-red-900/10 animate-pulse'
        }`}>
          {isBalanced 
            ? "✓ Table is balanced" 
            : `⚠ Discrepancy: $${Math.abs(totalPot - totalChips).toFixed(2)}`}
        </div>
      )}

      {/* PLAYER LIST */}
      <div className="grid gap-4">
        {players.map((player) => {
          const net = (Number(player.chips) || 0) - Number(player.buy_in);
          return (
            <Card key={player.id} className="bg-zinc-900 border-zinc-800 relative overflow-hidden group">
              {/* Trash icon specifically tied to this player.id */}
              <button 
                onClick={() => {
                  if(confirm(`Remove ${player.name}?`)) {
                    removePlayer(player.id)
                  }
                }}
                className="absolute top-3 right-3 text-zinc-700 hover:text-red-500 transition-colors z-10 p-1"
              >
                <Trash2 size={16} />
              </button>

              <CardHeader className="flex flex-row items-center justify-between py-5 px-5">
                <div className="pr-4">
                  <CardTitle className="text-lg font-semibold">{player.name}</CardTitle>
                  <p className="text-[11px] text-zinc-500 font-mono mt-0.5">Bought in for ${player.buy_in}</p>
                </div>
                
                <div className="flex flex-col items-end gap-2">
                  {player.chips !== null && (
                    <div className="text-right">
                      <span className={`text-xl font-mono font-bold ${net >= 0 ? 'text-green-500' : 'text-red-400'}`}>
                        {net >= 0 ? `+ $${net.toFixed(2)}` : `- $${Math.abs(net).toFixed(2)}`}
                      </span>
                      <p className="text-[9px] text-zinc-500 uppercase font-black tracking-tighter mt-1">
                        {net >= 0 ? "You Pay Them" : "They Pay You"}
                      </p>
                    </div>
                  )}
                  <CashOutDrawer player={player} onSave={handleCashOut} />
                </div>
              </CardHeader>
            </Card>
          );
        })}
      </div>

      <div className="fixed bottom-6 left-0 right-0 px-4 flex justify-center pointer-events-none">
        <div className="pointer-events-auto">
          <AddPlayerDrawer onAdd={addPlayer} />
        </div>
      </div>
    </main>
  )
}