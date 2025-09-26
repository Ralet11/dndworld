import { useState } from "react";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import { ChevronLeft, ChevronRight, Eye, Settings, Crosshair } from "lucide-react";
import { TacticalBoard } from "./tactical-board";
import { InitiativeTracker } from "./initiative-tracker";
import { ImageWithFallback } from "./figma/ImageWithFallback";

interface Scenario {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  isActive?: boolean;
  isTactical?: boolean;
}

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

interface ScenarioViewerProps {
  scenarios: Scenario[];
  onScenarioChange?: (scenario: Scenario) => void;
}

export function ScenarioViewer({ scenarios, onScenarioChange }: ScenarioViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [notes, setNotes] = useState("");
  const [boardTokens, setBoardTokens] = useState<BoardToken[]>([]);
  const [selectedToken, setSelectedToken] = useState<string>();
  const [initiative, setInitiative] = useState<InitiativeEntry[]>([]);
  const [currentTurn, setCurrentTurn] = useState(0);

  const currentScenario = scenarios[currentIndex];

  const navigateNext = () => {
    const nextIndex = (currentIndex + 1) % scenarios.length;
    setCurrentIndex(nextIndex);
    setBoardTokens([]); // Clear tokens when changing scenario
    setInitiative([]);
    onScenarioChange?.(scenarios[nextIndex]);
  };

  const navigatePrevious = () => {
    const prevIndex = currentIndex === 0 ? scenarios.length - 1 : currentIndex - 1;
    setCurrentIndex(prevIndex);
    setBoardTokens([]); // Clear tokens when changing scenario
    setInitiative([]);
    onScenarioChange?.(scenarios[prevIndex]);
  };

  const handleTokenMove = (tokenId: string, position: { x: number; y: number }) => {
    setBoardTokens(prev => prev.map(token => 
      token.id === tokenId ? { ...token, position } : token
    ));
  };

  const handleTokenAdd = (tokenData: Omit<BoardToken, 'id' | 'position'>, position: { x: number; y: number }) => {
    const newToken: BoardToken = {
      ...tokenData,
      id: `${tokenData.name}-${Date.now()}`,
      position
    };
    setBoardTokens(prev => [...prev, newToken]);
    
    // Add to initiative if not already there
    if (!initiative.find(entry => entry.name === tokenData.name)) {
      const newInitiative: InitiativeEntry = {
        id: newToken.id,
        name: tokenData.name,
        type: tokenData.type,
        initiative: Math.floor(Math.random() * 20) + 1, // Random initiative for demo
        hp: tokenData.hp || 10,
        maxHp: tokenData.maxHp || 10,
        ac: 12, // Default AC
        avatar: tokenData.avatar,
        status: 'active'
      };
      setInitiative(prev => [...prev, newInitiative]);
    }
  };

  const handleTokenSelect = (tokenId: string) => {
    setSelectedToken(tokenId);
  };

  const handleNextTurn = () => {
    setInitiative(prev => prev.map((entry, index) => ({
      ...entry,
      isCurrentTurn: index === (currentTurn + 1) % prev.length
    })));
    setCurrentTurn(prev => (prev + 1) % initiative.length);
  };

  const handleResetInitiative = () => {
    setInitiative([]);
    setCurrentTurn(0);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Gestión de Escenarios</h2>
        <div className="flex items-center space-x-2">
          <Button size="sm" variant="outline">
            <Eye className="h-4 w-4 mr-1" />
            Vista Jugadores
          </Button>
          <Button size="sm" variant="outline">
            <Settings className="h-4 w-4 mr-1" />
            Configurar
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Aquí el DM podrá setear los escenarios. Cada escenario tendrá muchas imágenes o mapas estáticos 
          y con las flechas podrá ir cambiando las imágenes.
        </div>
        {currentScenario?.isTactical && (
          <Badge variant="secondary" className="flex items-center space-x-1">
            <Crosshair className="h-3 w-3" />
            <span>Tablero Táctico</span>
          </Badge>
        )}
      </div>

      {/* Initiative Tracker - only show for tactical boards */}
      {currentScenario?.isTactical && (
        <InitiativeTracker
          entries={initiative}
          onNextTurn={handleNextTurn}
          onResetInitiative={handleResetInitiative}
          isActive={initiative.length > 0}
        />
      )}

      <Card>
        <CardContent className="p-0">
          <div className="relative">
            <div className="aspect-video bg-gray-100 rounded-t-lg overflow-hidden">
              {currentScenario && (
                currentScenario.isTactical ? (
                  <TacticalBoard
                    backgroundImage={currentScenario.imageUrl}
                    tokens={boardTokens}
                    onTokenMove={handleTokenMove}
                    onTokenAdd={handleTokenAdd}
                    onTokenSelect={handleTokenSelect}
                    selectedToken={selectedToken}
                  />
                ) : (
                  <ImageWithFallback
                    src={currentScenario.imageUrl}
                    alt={currentScenario.name}
                    className="w-full h-full object-cover"
                  />
                )
              )}
            </div>
            
            {scenarios.length > 1 && (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  className="absolute left-2 top-1/2 transform -translate-y-1/2 rounded-full p-2"
                  onClick={navigatePrevious}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 rounded-full p-2"
                  onClick={navigateNext}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </>
            )}

            <div className="absolute bottom-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-sm">
              {currentIndex + 1} / {scenarios.length}
            </div>
          </div>

          <div className="p-4 space-y-3">
            <div>
              <h3 className="font-medium">{currentScenario?.name}</h3>
              <p className="text-sm text-muted-foreground">{currentScenario?.description}</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Notas del DM:</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Esta geopolítedaria no me parece bien pero que podra usarse..."
                className="w-full p-2 border rounded-md text-sm min-h-[80px] resize-none"
              />
            </div>

            <div className="flex space-x-2">
              <Button size="sm" variant="outline" className="flex-1">
                Añadir Imagen
              </Button>
              <Button size="sm" variant="outline" className="flex-1">
                Editar Escenario
              </Button>
              <Button size="sm" className="flex-1">
                Activar Escenario
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}