'use client'
import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Player } from "@/types/poker"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { AddPlayerDrawer } from "@/components/AddPlayerDrawer"

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

  // 5. Derived state (math) goes just before the return
  const totalPot = players.reduce((sum, p) => sum + Number(p.buy_in), 0)

  if (loading) return <div className="p-10 text-center">Loading game...</div>

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50 p-4 pb-24">
      <header className="mb-8">
        <h1 className="text-3xl font-bold">Friday Night Poker</h1>
        <p className="text-zinc-400">Total Pot: <span className="text-green-500 font-mono">${totalPot.toFixed(2)}</span></p>
      </header>

      <div className="grid gap-4">
        {players.map((player) => (
          <Card key={player.id} className="bg-zinc-900 border-zinc-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg font-medium text-white">{player.name}</CardTitle>
              <span className="text-sm font-mono text-zinc-400">In: ${player.buyIn}</span>
            </CardHeader>
          </Card>
        ))}
        {players.length === 0 && (
          <p className="text-center text-zinc-500 mt-10">No players yet. Tap the + to start.</p>
        )}
      </div>

      <AddPlayerDrawer onAdd={addPlayer} />
    </main>
  )
}