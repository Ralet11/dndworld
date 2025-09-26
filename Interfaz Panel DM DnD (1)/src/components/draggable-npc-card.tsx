import { NPCCard } from "./npc-card";

interface NPC {
  id: string;
  name: string;
  type: string;
  cr: string;
  hp: number;
  ac: number;
  description: string;
  category: 'humanoid' | 'beast' | 'undead' | 'dragon' | 'fiend' | 'celestial';
  stats: {
    str: number;
    dex: number;
    con: number;
    int: number;
    wis: number;
    cha: number;
  };
  avatar?: string;
}

interface DraggableNPCCardProps {
  npc: NPC;
  onSelect?: (npc: NPC) => void;
  onAddToBoard?: (npc: NPC) => void;
  isSelected?: boolean;
}

export function DraggableNPCCard({ npc, onSelect, onAddToBoard, isSelected }: DraggableNPCCardProps) {
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({
      id: npc.id,
      name: npc.name,
      type: 'npc',
      avatar: npc.avatar,
      hp: npc.hp,
      maxHp: npc.hp,
      status: 'healthy',
      source: 'npc-panel'
    }));
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className="cursor-grab active:cursor-grabbing"
    >
      <NPCCard 
        npc={npc} 
        onSelect={onSelect} 
        onAddToBoard={onAddToBoard}
        isSelected={isSelected}
      />
    </div>
  );
}