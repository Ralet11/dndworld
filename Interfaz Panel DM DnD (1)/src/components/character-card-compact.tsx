import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";

interface Character {
  id: string;
  name: string;
  class: string;
  level: number;
  hp: number;
  maxHp: number;
  ac: number;
  status: 'healthy' | 'injured' | 'critical' | 'unconscious';
  avatar?: string;
}

interface CharacterCardProps {
  character: Character;
  onMove?: (character: Character) => void;
}

export function CharacterCard({ character, onMove }: CharacterCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-500';
      case 'injured': return 'bg-yellow-500';
      case 'critical': return 'bg-orange-500';
      case 'unconscious': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'healthy': return 'OK';
      case 'injured': return 'Herido';
      case 'critical': return 'Crítico';
      case 'unconscious': return 'KO';
      default: return 'N/A';
    }
  };

  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow">
      <CardHeader className="pb-1 px-3 pt-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs font-medium truncate flex-1 mr-2">{character.name}</CardTitle>
          <Badge variant="outline" className="text-xs h-4 px-1">
            Nv {character.level}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-1 px-3 pb-2">
        <div className="flex items-center space-x-2">
          <Avatar className="h-6 w-6">
            <AvatarImage src={character.avatar} />
            <AvatarFallback className="text-xs">{character.name.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="flex-1 text-xs">
            <div className="truncate">{character.class}</div>
            <div className="text-muted-foreground text-xs">CA: {character.ac}</div>
          </div>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span>PV:</span>
            <span>{character.hp}/{character.maxHp}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div 
              className="bg-red-600 h-1.5 rounded-full transition-all"
              style={{ width: `${(character.hp / character.maxHp) * 100}%` }}
            />
          </div>
          <div className="flex justify-center">
            <Badge 
              variant="secondary" 
              className={`text-xs h-4 px-1 ${getStatusColor(character.status)} text-white`}
            >
              {getStatusText(character.status)}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}