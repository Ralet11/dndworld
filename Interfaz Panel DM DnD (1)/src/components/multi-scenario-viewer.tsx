import { useState } from "react";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { ChevronLeft, ChevronRight, Eye, Settings, Crosshair, X, Plus } from "lucide-react";
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

interface ScenarioState {
  currentIndex: number;
  notes: string;
  boardTokens: BoardToken[];
  selectedToken?: string;
  initiative: InitiativeEntry[];
  currentTurn: number;
}

interface ActiveScenario {
  id: string;
  scenario: Scenario;
  state: ScenarioState;
}

interface MultiScenarioViewerProps {
  scenarios: Scenario[];
  onScenarioChange?: (scenario: Scenario) => void;
}

export function MultiScenarioViewer({ scenarios, onScenarioChange }: MultiScenarioViewerProps) {
  const [activeScenarios, setActiveScenarios] = useState<ActiveScenario[]>([
    {
      id: '1',
      scenario: scenarios[0],
      state: {
        currentIndex: 0,
        notes: "",
        boardTokens: [],
        selectedToken: undefined,
        initiative: [],
        currentTurn: 0
      }
    }
  ]);
  const [currentTab, setCurrentTab] = useState('1');

  const addNewScenario = () => {
    if (activeScenarios.length >= 2) return; // Máximo 2 escenarios
    
    const newId = String(activeScenarios.length + 1);
    const newActiveScenario: ActiveScenario = {
      id: newId,
      scenario: scenarios[0], // Empieza con el primer escenario disponible
      state: {
        currentIndex: 0,
        notes: "",
        boardTokens: [],
        selectedToken: undefined,
        initiative: [],
        currentTurn: 0
      }
    };
    
    setActiveScenarios([...activeScenarios, newActiveScenario]);
    setCurrentTab(newId);
  };

  const removeScenario = (tabId: string) => {
    if (activeScenarios.length <= 1) return; // Siempre mantener al menos uno
    
    const newActiveScenarios = activeScenarios.filter(scenario => scenario.id !== tabId);
    setActiveScenarios(newActiveScenarios);
    
    if (currentTab === tabId) {
      setCurrentTab(newActiveScenarios[0].id);
    }
  };

  const updateScenarioState = (tabId: string, newState: Partial<ScenarioState>) => {
    setActiveScenarios(prev => prev.map(activeScenario => 
      activeScenario.id === tabId 
        ? { ...activeScenario, state: { ...activeScenario.state, ...newState } }
        : activeScenario
    ));
  };

  const changeScenario = (tabId: string, direction: 'next' | 'prev') => {
    const activeScenario = activeScenarios.find(s => s.id === tabId);
    if (!activeScenario) return;

    const currentIndex = activeScenario.state.currentIndex;
    let nextIndex;
    
    if (direction === 'next') {
      nextIndex = (currentIndex + 1) % scenarios.length;
    } else {
      nextIndex = currentIndex === 0 ? scenarios.length - 1 : currentIndex - 1;
    }

    const newScenario = scenarios[nextIndex];
    
    setActiveScenarios(prev => prev.map(activeScenario => 
      activeScenario.id === tabId 
        ? { 
            ...activeScenario, 
            scenario: newScenario,
            state: { 
              ...activeScenario.state, 
              currentIndex: nextIndex,
              boardTokens: [], // Clear tokens when changing scenario
              initiative: [],
              currentTurn: 0
            }
          }
        : activeScenario
    ));
    
    onScenarioChange?.(newScenario);
  };

  const handleTokenMove = (tabId: string, tokenId: string, position: { x: number; y: number }) => {
    updateScenarioState(tabId, {
      boardTokens: activeScenarios.find(s => s.id === tabId)?.state.boardTokens.map(token => 
        token.id === tokenId ? { ...token, position } : token
      ) || []
    });
  };

  const handleTokenAdd = (tabId: string, tokenData: Omit<BoardToken, 'id' | 'position'>, position: { x: number; y: number }) => {
    const activeScenario = activeScenarios.find(s => s.id === tabId);
    if (!activeScenario) return;

    const newToken: BoardToken = {
      ...tokenData,
      id: `${tokenData.name}-${Date.now()}`,
      position
    };

    const newBoardTokens = [...activeScenario.state.boardTokens, newToken];
    
    // Add to initiative if not already there
    let newInitiative = [...activeScenario.state.initiative];
    if (!newInitiative.find(entry => entry.name === tokenData.name)) {
      const newInitiativeEntry: InitiativeEntry = {
        id: newToken.id,
        name: tokenData.name,
        type: tokenData.type,
        initiative: Math.floor(Math.random() * 20) + 1,
        hp: tokenData.hp || 10,
        maxHp: tokenData.maxHp || 10,
        ac: 12,
        avatar: tokenData.avatar,
        status: 'active'
      };
      newInitiative = [...newInitiative, newInitiativeEntry];
    }

    updateScenarioState(tabId, {
      boardTokens: newBoardTokens,
      initiative: newInitiative
    });
  };

  const handleTokenSelect = (tabId: string, tokenId: string) => {
    updateScenarioState(tabId, { selectedToken: tokenId });
  };

  const handleNextTurn = (tabId: string) => {
    const activeScenario = activeScenarios.find(s => s.id === tabId);
    if (!activeScenario) return;

    const currentTurn = activeScenario.state.currentTurn;
    const initiative = activeScenario.state.initiative;
    
    const newInitiative = initiative.map((entry, index) => ({
      ...entry,
      isCurrentTurn: index === (currentTurn + 1) % initiative.length
    }));

    updateScenarioState(tabId, {
      initiative: newInitiative,
      currentTurn: (currentTurn + 1) % initiative.length
    });
  };

  const handleResetInitiative = (tabId: string) => {
    updateScenarioState(tabId, {
      initiative: [],
      currentTurn: 0
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Gestión de Escenarios</h2>
        <div className="flex items-center space-x-2">
          <Button size="sm" variant="outline" className="text-xs h-7">
            <Eye className="h-3 w-3 mr-1" />
            Vista Jugadores
          </Button>
          <Button size="sm" variant="outline" className="text-xs h-7">
            <Settings className="h-3 w-3 mr-1" />
            Configurar
          </Button>
        </div>
      </div>

      <div className="text-xs text-muted-foreground">
        Aquí el DM podrá setear los escenarios. Cada escenario tendrá muchas imágenes o mapas estáticos 
        y con las flechas podrá ir cambiando las imágenes.
      </div>

      <Tabs value={currentTab} onValueChange={setCurrentTab}>
        <div className="flex items-center justify-between">
          <TabsList className="h-8">
            {activeScenarios.map((activeScenario, index) => (
              <TabsTrigger 
                key={activeScenario.id} 
                value={activeScenario.id}
                className="text-xs h-6 px-2 relative group"
              >
                <span className="max-w-24 truncate">
                  Escenario {index + 1}
                </span>
                {activeScenarios.length > 1 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-4 w-4 p-0 ml-1 opacity-0 group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeScenario(activeScenario.id);
                    }}
                  >
                    <X className="h-2 w-2" />
                  </Button>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
          
          {activeScenarios.length < 2 && (
            <Button
              size="sm"
              variant="outline"
              onClick={addNewScenario}
              className="text-xs h-7"
            >
              <Plus className="h-3 w-3 mr-1" />
              Añadir Escenario
            </Button>
          )}
        </div>

        {activeScenarios.map((activeScenario) => {
          const { scenario, state } = activeScenario;
          
          return (
            <TabsContent key={activeScenario.id} value={activeScenario.id} className="mt-3">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <h3 className="text-sm font-medium">{scenario.name}</h3>
                    {scenario.isTactical && (
                      <Badge variant="secondary" className="text-xs h-5 px-1">
                        <Crosshair className="h-2 w-2 mr-1" />
                        Táctico
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Initiative Tracker - only show for tactical boards */}
                {scenario.isTactical && (
                  <InitiativeTracker
                    entries={state.initiative}
                    onNextTurn={() => handleNextTurn(activeScenario.id)}
                    onResetInitiative={() => handleResetInitiative(activeScenario.id)}
                    isActive={state.initiative.length > 0}
                  />
                )}

                <Card>
                  <CardContent className="p-0">
                    <div className="relative">
                      <div className="aspect-video bg-gray-100 rounded-t-lg overflow-hidden">
                        {scenario.isTactical ? (
                          <TacticalBoard
                            backgroundImage={scenario.imageUrl}
                            tokens={state.boardTokens}
                            onTokenMove={(tokenId, position) => handleTokenMove(activeScenario.id, tokenId, position)}
                            onTokenAdd={(tokenData, position) => handleTokenAdd(activeScenario.id, tokenData, position)}
                            onTokenSelect={(tokenId) => handleTokenSelect(activeScenario.id, tokenId)}
                            selectedToken={state.selectedToken}
                          />
                        ) : (
                          <ImageWithFallback
                            src={scenario.imageUrl}
                            alt={scenario.name}
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                      
                      {scenarios.length > 1 && (
                        <>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="absolute left-2 top-1/2 transform -translate-y-1/2 rounded-full p-1 h-7 w-7"
                            onClick={() => changeScenario(activeScenario.id, 'prev')}
                          >
                            <ChevronLeft className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="absolute right-2 top-1/2 transform -translate-y-1/2 rounded-full p-1 h-7 w-7"
                            onClick={() => changeScenario(activeScenario.id, 'next')}
                          >
                            <ChevronRight className="h-3 w-3" />
                          </Button>
                        </>
                      )}

                      <div className="absolute bottom-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-xs">
                        {state.currentIndex + 1} / {scenarios.length}
                      </div>
                    </div>

                    <div className="p-3 space-y-2">
                      <div>
                        <p className="text-xs text-muted-foreground">{scenario.description}</p>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-medium">Notas del DM:</label>
                        <textarea
                          value={state.notes}
                          onChange={(e) => updateScenarioState(activeScenario.id, { notes: e.target.value })}
                          placeholder="Esta geopolítedaria no me parece bien pero que podra usarse..."
                          className="w-full p-2 border rounded-md text-xs min-h-[60px] resize-none"
                        />
                      </div>

                      <div className="flex space-x-1">
                        <Button size="sm" variant="outline" className="flex-1 text-xs h-7">
                          Añadir Imagen
                        </Button>
                        <Button size="sm" variant="outline" className="flex-1 text-xs h-7">
                          Editar Escenario
                        </Button>
                        <Button size="sm" className="flex-1 text-xs h-7">
                          Activar Escenario
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}