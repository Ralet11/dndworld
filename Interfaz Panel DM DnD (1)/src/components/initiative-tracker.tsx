import { useState } from "react";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { RotateCcw, Play, Pause, SkipForward } from "lucide-react";

interface InitiativeEntry {
  id: string;
  name: string;
  type: 'player' | 'npc';
  initiative: number;
  hp: number;
  maxHp: number;
  ac: number;
  avatar?: string;
  status: 'active' | 'injured' | 'critical' | 'unconscious';
  isCurrentTurn?: boolean;
}

interface InitiativeTrackerProps {
  entries: InitiativeEntry[];
  onNextTurn?: () => void;
  onResetInitiative?: () => void;
  isActive?: boolean;
}

export function InitiativeTracker({ entries, onNextTurn, onResetInitiative, isActive }: InitiativeTrackerProps) {
  const [selectedEntry, setSelectedEntry] = useState<InitiativeEntry | null>(null);

  const sortedEntries = [...entries].sort((a, b) => b.initiative - a.initiative);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'injured': return 'bg-yellow-500';
      case 'critical': return 'bg-orange-500';
      case 'unconscious': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const InitiativeCard = ({ entry }: { entry: InitiativeEntry }) => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Dialog>
            <DialogTrigger asChild>
              <Card 
                className={`cursor-pointer transition-all hover:shadow-md ${
                  entry.isCurrentTurn ? 'ring-2 ring-primary bg-primary/5' : ''
                }`}
                onClick={() => setSelectedEntry(entry)}
              >
                <CardContent className="p-2">
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline" className="text-xs min-w-[2rem] justify-center">
                      {entry.initiative}
                    </Badge>
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={entry.avatar} />
                      <AvatarFallback className="text-xs">{entry.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">{entry.name}</div>
                      <div className="flex items-center space-x-1">
                        <span className="text-xs text-muted-foreground">{entry.hp}/{entry.maxHp}</span>
                        <div 
                          className={`w-2 h-2 rounded-full ${getStatusColor(entry.status)}`}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{entry.name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex items-center space-x-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={entry.avatar} />
                    <AvatarFallback>{entry.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="space-y-2">
                    <div>
                      <span className="font-medium">Tipo: </span>
                      <Badge variant={entry.type === 'player' ? 'default' : 'secondary'}>
                        {entry.type === 'player' ? 'Jugador' : 'NPC'}
                      </Badge>
                    </div>
                    <div>
                      <span className="font-medium">Iniciativa: </span>
                      <Badge variant="outline">{entry.initiative}</Badge>
                    </div>
                    <div>
                      <span className="font-medium">CA: </span>
                      <span>{entry.ac}</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="font-medium">Puntos de Vida:</span>
                    <span>{entry.hp}/{entry.maxHp}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-red-600 h-2 rounded-full transition-all"
                      style={{ width: `${(entry.hp / entry.maxHp) * 100}%` }}
                    />
                  </div>
                  <div>
                    <span className="font-medium">Estado: </span>
                    <Badge className={getStatusColor(entry.status) + " text-white"}>
                      {entry.status === 'active' ? 'Activo' : 
                       entry.status === 'injured' ? 'Herido' :
                       entry.status === 'critical' ? 'Crítico' : 'Inconsciente'}
                    </Badge>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-xs">
            <div className="font-medium">{entry.name}</div>
            <div>Iniciativa: {entry.initiative}</div>
            <div>PV: {entry.hp}/{entry.maxHp}</div>
            <div>CA: {entry.ac}</div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  if (!isActive || entries.length === 0) {
    return null;
  }

  return (
    <Card className="mb-4">
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium">Orden de Iniciativa</h3>
          <div className="flex space-x-1">
            <Button size="sm" variant="outline" onClick={onResetInitiative}>
              <RotateCcw className="h-3 w-3" />
            </Button>
            <Button size="sm" onClick={onNextTurn}>
              <SkipForward className="h-3 w-3" />
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
          {sortedEntries.map((entry) => (
            <InitiativeCard key={entry.id} entry={entry} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}