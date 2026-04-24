'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/client' // Adjust based on your client helper path

export default function SettingsPage() {
  const supabase = createClient()
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)

  const updateProfile = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { error } = await supabase
        .from('profiles')
        .update({ display_name: name })
        .eq('id', user.id)
      
      if (error) alert(error.message)
      else alert('Profile updated!')
    }
    setLoading(false)
  }

  return (
    <div className="p-8 bg-zinc-950 min-h-screen text-white">
      <div className="max-w-md mx-auto">
        <h1 className="text-3xl font-bold mb-6 italic uppercase">User Settings</h1>
        <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800">
          <label className="block text-zinc-500 text-xs font-bold uppercase mb-2">Display Name</label>
          <input 
            className="w-full bg-black border border-zinc-800 p-3 rounded-xl mb-4 focus:border-yellow-500 outline-none transition-all"
            placeholder="Enter your shark name..."
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button 
            onClick={updateProfile}
            disabled={loading}
            className="w-full bg-yellow-500 text-black font-black py-3 rounded-xl hover:bg-yellow-400 transition-all uppercase italic"
          >
            {loading ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </div>
    </div>
  )
}