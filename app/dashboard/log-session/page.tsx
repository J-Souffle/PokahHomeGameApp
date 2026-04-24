import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function LogSessionPage() {
  async function logSession(formData: FormData) {
    'use server'
    
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { return cookieStore.getAll() } } }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const gameName = formData.get('gameName') as string
    const buyIn = parseFloat(formData.get('buyIn') as string)
    const cashOut = parseFloat(formData.get('cashOut') as string)

    // 1. Create the session
    const { data: session, error: sError } = await supabase
      .from('poker_sessions')
      .insert([{ game_name: gameName }])
      .select()
      .single()

    if (sError) throw sError

    // 2. Create the result entry
    const { error: rError } = await supabase
      .from('player_results')
      .insert([{
        session_id: session.id,
        user_id: user.id,
        total_buy_in: buyIn,
        cash_out: cashOut
      }])

    if (rError) throw rError

    redirect('/dashboard')
  }

  return (
    <div className="max-w-md mx-auto mt-12 p-8 bg-zinc-900 rounded-2xl border border-zinc-800 text-white">
      <h1 className="text-2xl font-bold mb-6">Log New Session</h1>
      
      <form action={logSession} className="space-y-4">
        <div>
          <label className="block text-sm text-zinc-400 mb-1">Game Name</label>
          <input name="gameName" required className="w-full bg-zinc-950 border border-zinc-800 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="e.g. Friday Night Funkin" />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Buy-In ($)</label>
            <input name="buyIn" type="number" step="0.01" required className="w-full bg-zinc-950 border border-zinc-800 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="20.00" />
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Cash-Out ($)</label>
            <input name="cashOut" type="number" step="0.01" required className="w-full bg-zinc-950 border border-zinc-800 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="50.00" />
          </div>
        </div>

        <button type="submit" className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-lg mt-4 transition-colors">
          Save Session
        </button>
      </form>
    </div>
  )
}