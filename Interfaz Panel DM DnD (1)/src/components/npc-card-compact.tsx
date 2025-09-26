import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import { Sword, Shield, Heart, GripVertical } from "lucide-react";

interface NPC {
  id: string;
  name: string;
  type: string;
  cr: string;
  hp: number;
  ac: number;
  description: string;
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

interface NPCCardProps {
  npc: NPC;
  onSelect?: (npc: NPC) => void;
  onAddToBoard?: (npc: NPC) => void;
  onActivate?: (npc: NPC) => void;
  isSelected?: boolean;
  isActive?: boolean;
}

export function NPCCard({ npc, onSelect, onAddToBoard, onActivate, isSelected, isActive }: NPCCardProps) {
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
    <Card 
      className={`cursor-grab active:cursor-grabbing transition-all ${isSelected ? 'ring-2 ring-primary' : 'hover:shadow-md'} ${isActive ? 'bg-green-50 border-green-200' : ''}`}
      draggable
      onDragStart={handleDragStart}
    >
      <CardHeader className="pb-1 px-3 pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center flex-1 mr-2">
            <GripVertical className="h-3 w-3 text-muted-foreground mr-1 opacity-50" />
            <CardTitle className="text-xs font-medium truncate">{npc.name}</CardTitle>
          </div>
          <Badge variant="outline" className="text-xs h-4 px-1">
            CR {npc.cr}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 px-3 pb-2">
        <div className="flex items-center space-x-2">
          <Avatar className="h-6 w-6">
            <AvatarImage src={npc.avatar} />
            <AvatarFallback className="text-xs">{npc.name.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="text-xs font-medium truncate">{npc.type}</div>
            <div className="text-xs text-muted-foreground line-clamp-1">
              {npc.description}
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-3 gap-1 text-xs">
          <div className="flex items-center space-x-1">
            <Heart className="h-2 w-2 text-red-500" />
            <span>{npc.hp}</span>
          </div>
          <div className="flex items-center space-x-1">
            <Shield className="h-2 w-2 text-blue-500" />
            <span>{npc.ac}</span>
          </div>
          <div className="flex items-center space-x-1">
            <Sword className="h-2 w-2 text-orange-500" />
            <span>+{Math.floor((npc.stats.str - 10) / 2)}</span>
          </div>
        </div>

        <div className="grid grid-cols-6 gap-1 text-xs">
          <div className="text-center">
            <div className="font-medium text-xs">FUE</div>
            <div className="text-xs">{npc.stats.str}</div>
          </div>
          <div className="text-center">
            <div className="font-medium text-xs">DES</div>
            <div className="text-xs">{npc.stats.dex}</div>
          </div>
          <div className="text-center">
            <div className="font-medium text-xs">CON</div>
            <div className="text-xs">{npc.stats.con}</div>
          </div>
          <div className="text-center">
            <div className="font-medium text-xs">INT</div>
            <div className="text-xs">{npc.stats.int}</div>
          </div>
          <div className="text-center">
            <div className="font-medium text-xs">SAB</div>
            <div className="text-xs">{npc.stats.wis}</div>
          </div>
          <div className="text-center">
            <div className="font-medium text-xs">CAR</div>
            <div className="text-xs">{npc.stats.cha}</div>
          </div>
        </div>

        <div className="flex space-x-1">
          <Button 
            size="sm" 
            variant="outline" 
            className="flex-1 text-xs h-6"
            onClick={() => onSelect?.(npc)}
          >
            Seleccionar
          </Button>
          <Button 
            size="sm" 
            variant={isActive ? "default" : "outline"}
            className={`flex-1 text-xs h-6 ${isActive ? 'bg-green-600 hover:bg-green-700 text-white' : ''}`}
            onClick={() => onActivate?.(npc)}
          >
            {isActive ? 'Activo' : 'Activar'}
          </Button>
          <Button 
            size="sm" 
            className="flex-1 text-xs h-6"
            onClick={() => onAddToBoard?.(npc)}
          >
            Al Tablero
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}