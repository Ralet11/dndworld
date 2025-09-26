import { CharacterCard } from "./character-card-compact";

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

interface DraggableCharacterCardProps {
  character: Character;
  onMove?: (character: Character) => void;
}

export function DraggableCharacterCard({ character, onMove }: DraggableCharacterCardProps) {
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
    <div
      draggable
      onDragStart={handleDragStart}
      className="cursor-grab active:cursor-grabbing"
    >
      <CharacterCard character={character} onMove={onMove} />
    </div>
  );
}