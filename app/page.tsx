'use client'
import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Player } from "@/types/poker"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { AddPlayerDrawer } from "@/components/AddPlayerDrawer"
import { CashOutDrawer } from "@/components/CashOutDrawer"

const SESSION_ID = "43dfbd26-08fb-4436-b9ac-8485b7e81a58" 

export default function PokerDashboard() {
  // 2. State hooks always go at the very top
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)

  // 3. Place your useEffect here (runs once when the component mounts)
  useEffect(() => {
    const fetchPlayers = async () => {
      const { data } = await supabase
        .from('players')
        .select('*')
        .eq('session_id', SESSION_ID) // Important: Filter by your session!
        .order('created_at', { ascending: true })
      
      if (data) setPlayers(data)
      setLoading(false)
    }
    fetchPlayers()
  }, [])

  // 4. Place your addPlayer function here
  const addPlayer = async (name: string, buyIn: number) => {
    const { data, error } = await supabase
      .from('players')
      .insert([{ 
        name, 
        buy_in: buyIn, 
        session_id: SESSION_ID,
        chips: 0 
      }])
      .select()

    if (error) {
      console.error("Error adding player:", error)
      return
    }

    if (data) {
      setPlayers((prev) => [...prev, ...data])
    }
  }

  const handleCashOut = async (id: string, chips: number) => {
  const { error } = await supabase
    .from('players')
    .update({ chips })
    .eq('id', id);

  if (error) {
    console.error("Update error:", error);
    return;
  }

  

  // Update local state so UI refreshes
  setPlayers(prev => prev.map(p => p.id === id ? { ...p, chips } : p));
};

  // 5. Derived state (math) goes just before the return
  const totalPot = players.reduce((sum, p) => sum + Number(p.buy_in), 0)

   const totalChips = players.reduce((sum, p) => sum + (Number(p.chips) || 0), 0);
  const isBalanced = totalPot === totalChips;

  if (loading) return <div className="p-10 text-center">Loading game...</div>

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50 p-4 pb-24">
      <header className="mb-4">
        <h1 className="text-3xl font-bold">Friday Night Poker</h1>
        <p className="text-zinc-400">Total Pot: <span className="text-green-500 font-mono">${totalPot.toFixed(2)}</span></p>
      </header>

      {/* The Balance Checker Bar */}
      {totalChips > 0 && (
        <div className={`text-xs font-mono mb-6 px-3 py-2 rounded-lg border ${
          isBalanced 
          ? 'text-zinc-400 border-zinc-800 bg-zinc-900/50' 
          : 'text-red-400 border-red-900/50 bg-red-900/10 animate-pulse'
        }`}>
          {isBalanced 
            ? "✓ Table is balanced" 
            : `⚠ Warning: Discrepancy of $${Math.abs(totalPot - totalChips).toFixed(2)}`}
        </div>
      )}

      <div className="grid gap-4">
        {players.map((player) => (
          <Card key={player.id} className="bg-zinc-900 border-zinc-800">
            <CardHeader className="flex flex-row items-center justify-between py-4">
              <div>
                <CardTitle className="text-lg">{player.name}</CardTitle>
                <p className="text-xs text-zinc-500 font-mono">In: ${player.buy_in}</p>
              </div>
              
              <div className="flex flex-col items-end gap-2">
                {/* Check if chips is not null. 
                   Even if chips is 0, we show the amount.
                */}
                {player.chips !== null && (
                  <span className={`text-lg font-mono font-bold ${
                    Number(player.chips) >= Number(player.buy_in) ? 'text-green-500' : 'text-red-500'
                  }`}>
                    ${Number(player.chips).toFixed(2)}
                  </span>
                )}
                <CashOutDrawer player={player} onSave={handleCashOut} />
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>

      {/* Show Settle Button only when balanced and everyone is cashed in */}
      {isBalanced && totalChips > 0 && (
        <div className="mt-8">
          <button 
            className="w-full bg-green-600 hover:bg-green-500 text-white h-12 rounded-xl font-bold transition-all"
            onClick={() => alert("Time to calculate the Venmo list!")}
          >
            Settle Game & View Debts
          </button>
        </div>
      )}

      <AddPlayerDrawer onAdd={addPlayer} />
    </main>
  )
}