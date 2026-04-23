'use client'
import { useState } from "react"
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger, DrawerFooter, DrawerClose } from "@/components/ui/drawer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus } from "lucide-react"

export function AddPlayerDrawer({ onAdd }: { onAdd: (name: string, buyIn: number) => void }) {
  const [name, setName] = useState("")
  const [buyIn, setBuyIn] = useState("20") // Default buy-in

  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Button className="fixed bottom-6 right-6 rounded-full h-14 w-14 shadow-lg">
          <Plus className="h-6 w-6" />
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <div className="mx-auto w-full max-w-sm">
          <DrawerHeader>
            <DrawerTitle>Add New Player</DrawerTitle>
          </DrawerHeader>
          <div className="p-4 space-y-4">
            <Input 
              placeholder="Player Name" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
            />
            <Input 
              type="number" 
              placeholder="Buy-in Amount ($)" 
              value={buyIn} 
              onChange={(e) => setBuyIn(e.target.value)} 
            />
          </div>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button onClick={() => {
                onAdd(name, parseFloat(buyIn));
                setName("");
              }}>
                Confirm Buy-in
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  )
}