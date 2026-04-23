'use client'
import { useState } from "react"
import { Player } from "@/types/poker"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { AddPlayerDrawer } from "@/components/AddPlayerDrawer"

export default function PokerDashboard() {
  const [players, setPlayers] = useState<Player[]>([])

  const addPlayer = (name: string, buyIn: number) => {
    const newPlayer: Player = {
      id: crypto.randomUUID(),
      name,
      buyIn,
      chips: 0,
    }
    setPlayers([...players, newPlayer])
  }

  const totalPot = players.reduce((sum, p) => sum + p.buyIn, 0)

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