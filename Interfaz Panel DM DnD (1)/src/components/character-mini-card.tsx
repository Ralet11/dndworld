import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Badge } from "./ui/badge";
import { Card, CardContent } from "./ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Heart, Shield, Zap, Wifi, WifiOff } from "lucide-react";

interface Character {
  id: string;
  name: string;
  class: string;
  level: number;
  hp: number;
  maxHp: number;
  ac: number;
  status: 'healthy' | 'injured' | 'critical' | 'unconscious';
  scenario?: string;
  avatar?: string;
  isConnected?: boolean;
}

interface CharacterMiniCardProps {
  character: Character;
  onMove?: (character: Character) => void;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'healthy': return 'bg-green-500';
    case 'injured': return 'bg-yellow-500';
    case 'critical': return 'bg-red-500';
    case 'unconscious': return 'bg-gray-500';
    default: return 'bg-green-500';
  }
};

const getStatusText = (status: string) => {
  switch (status) {
    case 'healthy': return 'Saludable';
    case 'injured': return 'Herido';
    case 'critical': return 'Crítico';
    case 'unconscious': return 'Inconsciente';
    default: return 'Saludable';
  }
};

const getHpPercentage = (hp: number, maxHp: number) => {
  return Math.max(0, (hp / maxHp) * 100);
};

export function CharacterMiniCard({ character, onMove }: CharacterMiniCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const hpPercentage = getHpPercentage(character.hp, character.maxHp);
  const isConnected = character.isConnected ?? character.scenario === "active";

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({
      id: character.id,
      name: character.name,
      type: 'player',
      avatar: character.avatar,
      hp: character.hp,
      maxHp: character.maxHp,
      status: character.status,
      source: 'character-panel'
    }));
  };

  return (
    <>
      <Card 
        className={`
          relative cursor-pointer transition-all duration-200 hover:shadow-md
          ${isConnected ? 'ring-2 ring-green-400 ring-opacity-50' : 'opacity-70'}
          ${isHovered ? 'scale-105' : ''}
        `}
        draggable
        onDragStart={handleDragStart}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={() => setShowDetails(true)}
      >
        <CardContent className="p-3">
          {/* Connection Status Indicator */}
          <div className="absolute top-2 right-2">
            {isConnected ? (
              <Wifi className="h-3 w-3 text-green-500" />
            ) : (
              <WifiOff className="h-3 w-3 text-gray-400" />
            )}
          </div>

          <div className="flex items-center space-x-3">
            {/* Avatar with Status Ring */}
            <div className={`relative ring-2 rounded-full ${getStatusColor(character.status)} ring-opacity-60`}>
              <Avatar className="h-12 w-12">
                <AvatarImage src={character.avatar} />
                <AvatarFallback className="text-xs">
                  {character.name.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              
              {/* Status Dot */}
              <div 
                className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-white ${getStatusColor(character.status)}`}
              />
            </div>

            {/* Character Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <h4 className="font-medium truncate text-sm">{character.name}</h4>
                <Badge variant="outline" className="text-xs px-1 py-0">
                  Lv.{character.level}
                </Badge>
              </div>
              
              <p className="text-xs text-muted-foreground truncate mb-2">
                {character.class}
              </p>

              {/* Health Bar */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center">
                    <Heart className="h-3 w-3 text-red-500 mr-1" />
                    {character.hp}/{character.maxHp}
                  </span>
                  <span className="flex items-center">
                    <Shield className="h-3 w-3 text-blue-500 mr-1" />
                    {character.ac}
                  </span>
                </div>
                
                <div className="relative h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-300 ${
                      hpPercentage > 60 ? 'bg-green-500' :
                      hpPercentage > 30 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${hpPercentage}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Quick Status */}
          <div className="mt-2 flex items-center justify-between">
            <span className={`text-xs px-2 py-1 rounded-full text-white ${getStatusColor(character.status)}`}>
              {getStatusText(character.status)}
            </span>
            
            {isConnected && (
              <div className="flex items-center text-xs text-green-600">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse"></div>
                En línea
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Detailed Character Sheet Modal */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-3">
              <Avatar className="h-12 w-12">
                <AvatarImage src={character.avatar} />
                <AvatarFallback>
                  {character.name.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3>{character.name}</h3>
                <p className="text-sm text-muted-foreground font-normal">
                  {character.class} - Nivel {character.level}
                </p>
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Status & Connection */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className={`text-xs px-3 py-1 rounded-full text-white ${getStatusColor(character.status)}`}>
                  {getStatusText(character.status)}
                </span>
                {isConnected && (
                  <div className="flex items-center text-sm text-green-600">
                    <Wifi className="h-4 w-4 mr-1" />
                    Conectado
                  </div>
                )}
              </div>
            </div>

            {/* Health Details */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center text-sm">
                  <Heart className="h-4 w-4 text-red-500 mr-2" />
                  Puntos de Vida
                </span>
                <span className="font-medium">{character.hp} / {character.maxHp}</span>
              </div>
              <div className="relative h-3 w-full bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-300 ${
                    hpPercentage > 60 ? 'bg-green-500' :
                    hpPercentage > 30 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${hpPercentage}%` }}
                />
              </div>
              
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center">
                  <Shield className="h-4 w-4 text-blue-500 mr-2" />
                  Clase de Armadura
                </span>
                <span className="font-medium">{character.ac}</span>
              </div>
            </div>

            {/* Location */}
            <div className="border-t pt-3">
              <div className="flex items-center justify-between text-sm">
                <span>Ubicación:</span>
                <span className="font-medium">
                  {character.scenario === 'active' ? 'En Juego' : 'En Reserva'}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="border-t pt-3 space-y-2">
              <button
                className="w-full p-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
                onClick={() => {
                  // Simular cambio de estado
                  console.log(`Healing ${character.name}`);
                  setShowDetails(false);
                }}
              >
                <Zap className="h-4 w-4 inline mr-2" />
                Curar Personaje
              </button>
              
              <button
                className="w-full p-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors text-sm"
                onClick={() => {
                  onMove?.(character);
                  setShowDetails(false);
                }}
              >
                Mover a Escenario
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}