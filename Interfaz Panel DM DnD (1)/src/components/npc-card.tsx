import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import { Sword, Shield, Heart } from "lucide-react";

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
  return (
    <Card className={`cursor-pointer transition-all ${isSelected ? 'ring-2 ring-primary' : 'hover:shadow-md'}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">{npc.name}</CardTitle>
          <Badge variant="outline" className="text-xs">
            CR {npc.cr}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center space-x-2">
          <Avatar className="h-10 w-10">
            <AvatarImage src={npc.avatar} />
            <AvatarFallback>{npc.name.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="text-xs font-medium">{npc.type}</div>
            <div className="text-xs text-muted-foreground line-clamp-2">
              {npc.description}
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-3 gap-1 text-xs">
          <div className="flex items-center space-x-1">
            <Heart className="h-3 w-3 text-red-500" />
            <span>{npc.hp}</span>
          </div>
          <div className="flex items-center space-x-1">
            <Shield className="h-3 w-3 text-blue-500" />
            <span>{npc.ac}</span>
          </div>
          <div className="flex items-center space-x-1">
            <Sword className="h-3 w-3 text-orange-500" />
            <span>+{Math.floor((npc.stats.str - 10) / 2)}</span>
          </div>
        </div>

        <div className="grid grid-cols-6 gap-1 text-xs">
          <div className="text-center">
            <div className="font-medium">FUE</div>
            <div>{npc.stats.str}</div>
          </div>
          <div className="text-center">
            <div className="font-medium">DES</div>
            <div>{npc.stats.dex}</div>
          </div>
          <div className="text-center">
            <div className="font-medium">CON</div>
            <div>{npc.stats.con}</div>
          </div>
          <div className="text-center">
            <div className="font-medium">INT</div>
            <div>{npc.stats.int}</div>
          </div>
          <div className="text-center">
            <div className="font-medium">SAB</div>
            <div>{npc.stats.wis}</div>
          </div>
          <div className="text-center">
            <div className="font-medium">CAR</div>
            <div>{npc.stats.cha}</div>
          </div>
        </div>

        <div className="flex space-x-1">
          <Button 
            size="sm" 
            variant="outline" 
            className="flex-1 text-xs"
            onClick={() => onSelect?.(npc)}
          >
            Seleccionar
          </Button>
          <Button 
            size="sm" 
            className="flex-1 text-xs"
            onClick={() => onAddToBoard?.(npc)}
          >
            Al Tablero
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}