import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Badge } from "./ui/badge";

interface TokenProps {
  id: string;
  name: string;
  type: 'player' | 'npc';
  avatar?: string;
  position: { x: number; y: number };
  size?: 'small' | 'medium' | 'large';
  hp?: number;
  maxHp?: number;
  status?: 'healthy' | 'injured' | 'critical' | 'unconscious';
  onMove?: (id: string, position: { x: number; y: number }) => void;
  onSelect?: (id: string) => void;
  isSelected?: boolean;
}

export function Token({ 
  id, 
  name, 
  type, 
  avatar, 
  position, 
  size = 'medium',
  hp,
  maxHp,
  status = 'healthy',
  onMove,
  onSelect,
  isSelected
}: TokenProps) {
  const getSizeClass = () => {
    switch (size) {
      case 'small': return 'w-8 h-8';
      case 'large': return 'w-16 h-16';
      default: return 'w-12 h-12';
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'injured': return 'border-yellow-500';
      case 'critical': return 'border-orange-500';
      case 'unconscious': return 'border-red-500';
      default: return 'border-green-500';
    }
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({
      id,
      name,
      type,
      avatar,
      hp,
      maxHp,
      status,
      source: 'board'
    }));
  };

  return (
    <div
      className={`absolute cursor-pointer transition-all ${
        isSelected ? 'ring-2 ring-primary' : ''
      }`}
      style={{ 
        left: position.x, 
        top: position.y,
        transform: 'translate(-50%, -50%)'
      }}
      draggable
      onDragStart={handleDragStart}
      onClick={() => onSelect?.(id)}
    >
      <div className={`relative ${getSizeClass()}`}>
        <Avatar className={`${getSizeClass()} border-2 ${getStatusColor()}`}>
          <AvatarImage src={avatar} />
          <AvatarFallback className={size === 'small' ? 'text-xs' : 'text-sm'}>
            {name.charAt(0)}
          </AvatarFallback>
        </Avatar>
        
        {type === 'player' && (
          <Badge 
            variant="default" 
            className="absolute -top-1 -right-1 text-xs px-1 py-0 h-4 min-w-4"
          >
            P
          </Badge>
        )}
        
        {hp !== undefined && maxHp !== undefined && (
          <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2">
            <div className="bg-black/70 text-white px-1 rounded text-xs whitespace-nowrap">
              {hp}/{maxHp}
            </div>
          </div>
        )}
      </div>
      
      <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-1 bg-black/70 text-white px-1 rounded text-xs whitespace-nowrap">
        {name}
      </div>
    </div>
  );
}