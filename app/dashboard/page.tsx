import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const cookieStore = await cookies()
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Protect the route - if no user, send them back to login
  if (!user) {
    redirect('/login')
  }

  return (
    <div className="p-8 bg-zinc-950 min-h-screen text-white">
      <h1 className="text-2xl font-bold">Welcome to your Poker Stats</h1>
      <p className="text-zinc-400">Logged in as: {user.email}</p>
      
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800">
          <h3 className="text-zinc-500 text-sm font-medium">Total Profit</h3>
          <p className="text-3xl font-bold text-green-500">$0.00</p>
        </div>
        <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800">
          <h3 className="text-zinc-500 text-sm font-medium">Win Rate</h3>
          <p className="text-3xl font-bold">0%</p>
        </div>
        <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800">
          <h3 className="text-zinc-500 text-sm font-medium">Sessions Played</h3>
          <p className="text-3xl font-bold">0</p>
        </div>
      </div>
    </div>
  )
}