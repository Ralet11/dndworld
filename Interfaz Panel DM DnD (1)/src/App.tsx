import { useState } from "react";
import { CharacterPanel } from "./components/character-panel-compact";
import { MultiScenarioViewer } from "./components/multi-scenario-viewer";
import { CollapsibleSidebar } from "./components/collapsible-sidebar-compact";
import { ActiveNPCOverlay } from "./components/active-npc-overlay";
import { Button } from "./components/ui/button";
import { Separator } from "./components/ui/separator";
import { 
  ResizablePanelGroup, 
  ResizablePanel, 
  ResizableHandle 
} from "./components/ui/resizable";
import { Dice6, Settings, Save, Play } from "lucide-react";

// Mock data para personajes
const mockCharacters = [
  {
    id: "1",
    name: "Aragorn",
    class: "Guardabosques",
    level: 8,
    hp: 68,
    maxHp: 80,
    ac: 16,
    status: "injured" as const,
    scenario: "active",
    avatar: "/avatars/aragorn.jpg"
  },
  {
    id: "2", 
    name: "Legolas",
    class: "Arquero Élfico",
    level: 7,
    hp: 52,
    maxHp: 52,
    ac: 17,
    status: "healthy" as const,
    scenario: "active",
    avatar: "/avatars/legolas.jpg"
  },
  {
    id: "3",
    name: "Gimli",
    class: "Guerrero Enano",
    level: 7,
    hp: 15,
    maxHp: 65,
    ac: 18,
    status: "critical" as const,
    scenario: "active",
    avatar: "/avatars/gimli.jpg"
  },
  {
    id: "4",
    name: "Gandalf",
    class: "Mago",
    level: 12,
    hp: 45,
    maxHp: 45,
    ac: 13,
    status: "healthy" as const,
    scenario: "reserve",
    avatar: "/avatars/gandalf.jpg"
  },
  {
    id: "5",
    name: "Boromir",
    class: "Guerrero",
    level: 6,
    hp: 0,
    maxHp: 58,
    ac: 19,
    status: "unconscious" as const,
    scenario: "reserve",
    avatar: "/avatars/boromir.jpg"
  }
];

// Mock data para escenarios - agregando tableros tácticos
const mockScenarios = [
  {
    id: "1",
    name: "Mazmorra Ancestral",
    description: "Una antigua mazmorra llena de trampas y criaturas peligrosas",
    imageUrl: "https://images.unsplash.com/photo-1677295922463-147d7f2f718c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmYW50YXN5JTIwZHVuZ2VvbiUyMG1hcHxlbnwxfHx8fDE3NTg4MTgxMjd8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    isActive: true,
    isTactical: false
  },
  {
    id: "2",
    name: "Taberna del Jabalí Dorado",
    description: "El lugar de encuentro de aventureros y comerciantes",
    imageUrl: "https://images.unsplash.com/photo-1719620131173-f5c51fe23ed0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtZWRpZXZhbCUyMGZhbnRhc3klMjB0YXZlcm58ZW58MXx8fHwxNzU4ODE4MTMxfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    isTactical: false
  },
  {
    id: "3",
    name: "Sendero del Bosque Sombrio",
    description: "Un camino serpenteante a través de un bosque encantado",
    imageUrl: "https://images.unsplash.com/photo-1593410733607-4fe72c8f3f73?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmYW50YXN5JTIwZm9yZXN0JTIwcGF0aHxlbnwxfHx8fDE3NTg4MTgxMzR8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    isTactical: false
  },
  {
    id: "4",
    name: "Tablero Táctico - Sala del Tesoro",
    description: "Tablero para combate táctico en la cámara del tesoro",
    imageUrl: "https://images.unsplash.com/photo-1643796980977-c62d29741f75?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0YWN0aWNhbCUyMGJhdHRsZSUyMGdyaWQlMjBtYXB8ZW58MXx8fHwxNzU4ODE5NDQzfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    isTactical: true
  }
];

// Mock data para NPCs
const mockNPCs = [
  {
    id: "1",
    name: "Goblin Explorador",
    type: "Humanoide (goblinoide)",
    cr: "1/4",
    hp: 7,
    ac: 15,
    description: "Un pequeño goblin astuto que actúa como explorador para su tribu",
    category: "humanoid" as const,
    stats: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 },
    avatar: "https://images.unsplash.com/photo-1637715925533-4c33bd22908e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmYW50YXN5JTIwZ29ibGluJTIwY2hhcmFjdGVyfGVufDF8fHx8MTc1ODgyNDY0OHww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
  },
  {
    id: "2",
    name: "Oso Pardo",
    type: "Bestia",
    cr: "1",
    hp: 19,
    ac: 11,
    description: "Un gran oso salvaje territorial y agresivo",
    category: "beast" as const,
    stats: { str: 19, dex: 10, con: 16, int: 2, wis: 13, cha: 7 },
    avatar: "https://images.unsplash.com/photo-1604429860647-58a940b46855?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmYW50YXN5JTIwYmVhciUyMGNyZWF0dXJlfGVufDF8fHx8MTc1ODgyNDY1Mnww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
  },
  {
    id: "3",
    name: "Esqueleto Guerrero",
    type: "No muerto",
    cr: "1/4",
    hp: 13,
    ac: 13,
    description: "Los restos animados de un guerrero caído",
    category: "undead" as const,
    stats: { str: 10, dex: 14, con: 15, int: 6, wis: 8, cha: 5 },
    avatar: "https://images.unsplash.com/photo-1706399488574-0badc247ffc0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxza2VsZXRvbiUyMHdhcnJpb3IlMjBmYW50YXN5fGVufDF8fHx8MTc1ODgyNDY1N3ww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
  },
  {
    id: "4",
    name: "Mago Oscuro",
    type: "Humanoide (humano)",
    cr: "3",
    hp: 40,
    ac: 12,
    description: "Un hechicero que ha sucumbido a las artes oscuras",
    category: "humanoid" as const,
    stats: { str: 9, dex: 14, con: 13, int: 17, wis: 12, cha: 11 },
    avatar: "https://images.unsplash.com/photo-1634409884980-a30da0b2b010?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkYXJrJTIwd2l6YXJkJTIwZmFudGFzeXxlbnwxfHx8fDE3NTg4MjQ2NjF8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
  },
  {
    id: "5",
    name: "Dragón Joven",
    type: "Dragón",
    cr: "10",
    hp: 178,
    ac: 18,
    description: "Un dragón en la flor de la vida, poderoso y astuto",
    category: "dragon" as const,
    stats: { str: 23, dex: 10, con: 21, int: 14, wis: 11, cha: 19 },
    avatar: "https://images.unsplash.com/photo-1610926597998-fc7f2c1b89b0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmYW50YXN5JTIwZHJhZ29ufGVufDF8fHx8MTc1ODgyNDY2NXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
  },
  {
    id: "6",
    name: "Orco Berserker",
    type: "Humanoide (orco)",
    cr: "1",
    hp: 15,
    ac: 13,
    description: "Un feroz guerrero orco que entra en furia durante el combate",
    category: "humanoid" as const,
    stats: { str: 16, dex: 12, con: 16, int: 7, wis: 11, cha: 10 },
    avatar: "https://images.unsplash.com/photo-1750092701416-174aaa737e55?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmYW50YXN5JTIwb3JjJTIwd2FycmlvcnxlbnwxfHx8fDE3NTg3NTczNzh8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
  },
  {
    id: "7",
    name: "Bandido",
    type: "Humanoide (humano)",
    cr: "1/8",
    hp: 11,
    ac: 12,
    description: "Un ladrón común que asalta a los viajeros en los caminos",
    category: "humanoid" as const,
    stats: { str: 11, dex: 12, con: 12, int: 10, wis: 10, cha: 10 },
    avatar: "https://images.unsplash.com/photo-1711389627156-00f709ee7112?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmYW50YXN5JTIwYmFuZGl0JTIwcm9ndWV8ZW58MXx8fHwxNzU4ODI0NjcxfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
  },
  {
    id: "8",
    name: "Araña Gigante",
    type: "Bestia",
    cr: "1",
    hp: 26,
    ac: 14,
    description: "Una araña del tamaño de un perro con veneno paralizante",
    category: "beast" as const,
    stats: { str: 14, dex: 16, con: 13, int: 2, wis: 11, cha: 4 },
    avatar: "https://images.unsplash.com/photo-1667992340537-2b258a46bef5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmYW50YXN5JTIwc3BpZGVyJTIwY3JlYXR1cmV8ZW58MXx8fHwxNzU4ODI0Njc2fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
  }
];

export default function App() {
  const [selectedNPC, setSelectedNPC] = useState(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeNPCs, setActiveNPCs] = useState([]);
  const [focusedNPCId, setFocusedNPCId] = useState(null);

  const handleCharacterMove = (character, newScenario) => {
    console.log(`Moving ${character.name} to ${newScenario}`);
  };

  const handleScenarioChange = (scenario) => {
    console.log(`Changed to scenario: ${scenario.name}`);
  };

  const handleNPCSelect = (npc) => {
    setSelectedNPC(npc);
  };

  const handleAddToBoard = (npc) => {
    console.log(`Adding ${npc.name} to board`);
  };

  const handleToggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  const handleActivateNPC = (npc) => {
    if (activeNPCs.find(activeNPC => activeNPC.id === npc.id)) {
      // Deactivate NPC
      setActiveNPCs(prev => prev.filter(activeNPC => activeNPC.id !== npc.id));
      if (focusedNPCId === npc.id) {
        const remainingNPCs = activeNPCs.filter(activeNPC => activeNPC.id !== npc.id);
        setFocusedNPCId(remainingNPCs.length > 0 ? remainingNPCs[0].id : null);
      }
    } else {
      // Activate NPC
      const newActiveNPC = { ...npc, isFocused: activeNPCs.length === 0 };
      setActiveNPCs(prev => [...prev, newActiveNPC]);
      if (activeNPCs.length === 0) {
        setFocusedNPCId(npc.id);
      }
    }
  };

  const handleFocusNPC = (npcId) => {
    setActiveNPCs(prev => prev.map(npc => ({
      ...npc,
      isFocused: npc.id === npcId
    })));
    setFocusedNPCId(npcId);
  };

  const handleDeactivateNPC = (npcId) => {
    setActiveNPCs(prev => prev.filter(npc => npc.id !== npcId));
    if (focusedNPCId === npcId) {
      const remainingNPCs = activeNPCs.filter(npc => npc.id !== npcId);
      setFocusedNPCId(remainingNPCs.length > 0 ? remainingNPCs[0].id : null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="flex items-center justify-between p-3">
          <div className="flex items-center space-x-3">
            <h1 className="text-lg font-medium flex items-center">
              <Dice6 className="h-5 w-5 mr-2 text-primary" />
              Panel de DM - D&D
            </h1>
            <div className="text-xs text-muted-foreground">
              Sesión: La Mazmorra del Rey Brujo
            </div>
          </div>
          <div className="flex items-center space-x-1">
            <Button size="sm" variant="outline" className="text-xs h-7">
              <Save className="h-3 w-3 mr-1" />
              Guardar
            </Button>
            <Button size="sm" variant="outline" className="text-xs h-7">
              <Settings className="h-3 w-3 mr-1" />
              Configuración
            </Button>
            <Button 
              size="sm" 
              className={`text-xs h-7 ${gameStarted ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"}`}
              onClick={() => setGameStarted(!gameStarted)}
            >
              <Play className="h-3 w-3 mr-1" />
              {gameStarted ? "Pausar Sesión" : "Iniciar Sesión"}
            </Button>
          </div>
        </div>
      </header>

      {/* Main Layout - Resizable */}
      <ResizablePanelGroup direction="horizontal" className="h-[calc(100vh-61px)]">
        {/* Panel Izquierdo - Personajes */}
        <ResizablePanel defaultSize={20} minSize={15} maxSize={35}>
          <div className="h-full border-r bg-card p-3 overflow-hidden">
            <CharacterPanel 
              characters={mockCharacters}
              onCharacterMove={handleCharacterMove}
            />
          </div>
        </ResizablePanel>

        <ResizableHandle />

        {/* Panel Central - Escenarios */}
        <ResizablePanel defaultSize={sidebarCollapsed ? 80 : 55} minSize={40}>
          <div className="h-full p-4 overflow-auto relative">
            <MultiScenarioViewer 
              scenarios={mockScenarios}
              onScenarioChange={handleScenarioChange}
            />
            
            {/* Active NPCs Overlay dentro del área del escenario */}
            <ActiveNPCOverlay
              activeNPCs={activeNPCs}
              onDeactivate={handleDeactivateNPC}
              onFocus={handleFocusNPC}
            />
          </div>
        </ResizablePanel>

        {/* Resizable Handle solo cuando el sidebar no está colapsado */}
        {!sidebarCollapsed && <ResizableHandle />}

        {/* Panel Derecho - Menús Colapsables */}
        {!sidebarCollapsed ? (
          <ResizablePanel defaultSize={25} minSize={20} maxSize={40}>
            <div className="h-full">
              <CollapsibleSidebar
                npcs={mockNPCs}
                selectedNPC={selectedNPC}
                activeNPCs={activeNPCs.map(npc => npc.id)}
                onNPCSelect={handleNPCSelect}
                onAddToBoard={handleAddToBoard}
                onActivateNPC={handleActivateNPC}
                isCollapsed={sidebarCollapsed}
                onToggleCollapse={handleToggleSidebar}
              />
            </div>
          </ResizablePanel>
        ) : (
          <div className="w-10 h-full">
            <CollapsibleSidebar
              npcs={mockNPCs}
              selectedNPC={selectedNPC}
              activeNPCs={activeNPCs.map(npc => npc.id)}
              onNPCSelect={handleNPCSelect}
              onAddToBoard={handleAddToBoard}
              onActivateNPC={handleActivateNPC}
              isCollapsed={sidebarCollapsed}
              onToggleCollapse={handleToggleSidebar}
            />
          </div>
        )}
      </ResizablePanelGroup>

      {/* Status Bar */}
      <footer className="border-t bg-muted/50 px-3 py-1">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center space-x-3">
            <span>
              Jugadores conectados: {mockCharacters.filter(c => c.scenario === "active").length}/{mockCharacters.length}
            </span>
            <Separator orientation="vertical" className="h-3" />
            <span>Turno: {mockCharacters.find(c => c.scenario === "active")?.name || "N/A"}</span>
            <Separator orientation="vertical" className="h-3" />
            <span>Ronda: 3</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className={`w-1.5 h-1.5 rounded-full ${gameStarted ? 'bg-green-500' : 'bg-red-500'}`} />
            <span>{gameStarted ? "Sesión Activa" : "Sesión Pausada"}</span>
          </div>
        </div>
      </footer>


    </div>
  );
}