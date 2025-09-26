import { useState, useRef } from "react";
import { Token } from "./token";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { Button } from "./ui/button";
import { RotateCcw, ZoomIn, ZoomOut } from "lucide-react";

interface BoardToken {
  id: string;
  name: string;
  type: 'player' | 'npc';
  avatar?: string;
  position: { x: number; y: number };
  hp?: number;
  maxHp?: number;
  status?: 'healthy' | 'injured' | 'critical' | 'unconscious';
}

interface TacticalBoardProps {
  backgroundImage: string;
  tokens: BoardToken[];
  onTokenMove?: (tokenId: string, position: { x: number; y: number }) => void;
  onTokenAdd?: (token: Omit<BoardToken, 'id' | 'position'>, position: { x: number; y: number }) => void;
  onTokenSelect?: (tokenId: string) => void;
  selectedToken?: string;
}

export function TacticalBoard({ 
  backgroundImage, 
  tokens, 
  onTokenMove, 
  onTokenAdd, 
  onTokenSelect,
  selectedToken 
}: TacticalBoardProps) {
  const [zoom, setZoom] = useState(1);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const boardRef = useRef<HTMLDivElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    
    if (!boardRef.current) return;
    
    const rect = boardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;
    
    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain'));
      
      if (data.source === 'board') {
        // Moving existing token
        onTokenMove?.(data.id, { x, y });
      } else {
        // Adding new token from panel
        onTokenAdd?.(data, { x, y });
      }
    } catch (error) {
      console.error('Error parsing drop data:', error);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.2, 3));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.2, 0.5));
  };

  const handleResetView = () => {
    setZoom(1);
    setDragOffset({ x: 0, y: 0 });
  };

  return (
    <div className="relative w-full h-full bg-gray-100 rounded-lg overflow-hidden">
      {/* Controls */}
      <div className="absolute top-2 right-2 z-10 flex space-x-1">
        <Button size="sm" variant="secondary" onClick={handleZoomIn}>
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="secondary" onClick={handleZoomOut}>
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="secondary" onClick={handleResetView}>
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      {/* Zoom indicator */}
      <div className="absolute top-2 left-2 z-10 bg-black/70 text-white px-2 py-1 rounded text-sm">
        {Math.round(zoom * 100)}%
      </div>

      {/* Board */}
      <div
        ref={boardRef}
        className="relative w-full h-full cursor-crosshair"
        style={{
          transform: `scale(${zoom}) translate(${dragOffset.x}px, ${dragOffset.y}px)`,
          transformOrigin: 'center center'
        }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        {/* Background */}
        <ImageWithFallback
          src={backgroundImage}
          alt="Tactical Board"
          className="w-full h-full object-cover select-none"
          draggable={false}
        />

        {/* Grid overlay (optional) */}
        <div 
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px'
          }}
        />

        {/* Tokens */}
        {tokens.map((token) => (
          <Token
            key={token.id}
            {...token}
            onMove={onTokenMove}
            onSelect={onTokenSelect}
            isSelected={selectedToken === token.id}
          />
        ))}
      </div>

      {/* Drop zone indicator */}
      <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 text-sm text-muted-foreground bg-black/70 text-white px-2 py-1 rounded">
        Arrastra fichas aquí para añadirlas al tablero
      </div>
    </div>
  );
}