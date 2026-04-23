'use client'
import { useState } from "react"
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger, DrawerFooter, DrawerClose } from "@/components/ui/drawer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Player } from "@/types/poker"

interface CashOutProps {
  player: Player;
  onSave: (id: string, chips: number) => void;
}

export function CashOutDrawer({ player, onSave }: CashOutProps) {
  const [chips, setChips] = useState(player.chips?.toString() || "0")

  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Button variant="secondary" size="sm" className="bg-zinc-800 hover:bg-zinc-700">
          Cash Out
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <div className="mx-auto w-full max-w-sm p-6 text-center">
          <DrawerHeader>
            <DrawerTitle>Cash Out: {player.name}</DrawerTitle>
            <p className="text-sm text-zinc-400">Enter final chip count</p>
          </DrawerHeader>
          
          <div className="py-6">
            <Input 
              type="number" 
              inputMode="decimal"
              className="text-3xl h-20 text-center font-mono border-zinc-700 bg-zinc-900"
              value={chips} 
              onChange={(e) => setChips(e.target.value)} 
              autoFocus
            />
          </div>

          <DrawerFooter className="flex-row gap-2">
            <DrawerClose asChild>
              <Button variant="outline" className="flex-1">Cancel</Button>
            </DrawerClose>
            <DrawerClose asChild>
              <Button 
                className="flex-1 bg-green-600 hover:bg-green-500"
                onClick={() => onSave(player.id, parseFloat(chips) || 0)}
              >
                Save
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  )
}