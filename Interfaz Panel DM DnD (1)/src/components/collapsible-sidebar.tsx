import { useState } from "react";
import { CollapsibleMenu } from "./collapsible-menu";
import { DraggableNPCCard } from "./draggable-npc-card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { ScrollArea } from "./ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { 
  Crown, 
  Dice6, 
  Map, 
  Settings, 
  Search, 
  Plus,
  ChevronLeft,
  ChevronRight
} from "lucide-react";

interface NPC {
  id: string;
  name: string;
  type: string;
  cr: string;
  hp: number;
  ac: number;
  description: string;
  category: 'humanoid' | 'beast' | 'undead' | 'dragon' | 'fiend' | 'celestial';
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

interface CollapsibleSidebarProps {
  npcs: NPC[];
  selectedNPC?: NPC;
  onNPCSelect?: (npc: NPC) => void;
  onAddToBoard?: (npc: NPC) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function CollapsibleSidebar({ 
  npcs, 
  selectedNPC, 
  onNPCSelect, 
  onAddToBoard,
  isCollapsed = false,
  onToggleCollapse
}: CollapsibleSidebarProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const filteredNPCs = npcs.filter(npc => {
    const matchesSearch = npc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         npc.type.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "all" || npc.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = [
    { value: "all", label: "Todos" },
    { value: "humanoid", label: "Humanoides" },
    { value: "beast", label: "Bestias" },
    { value: "undead", label: "No Muertos" },
    { value: "dragon", label: "Dragones" },
    { value: "fiend", label: "Demonios" },
    { value: "celestial", label: "Celestiales" }
  ];

  if (isCollapsed) {
    return (
      <div className="w-12 bg-card border-l flex flex-col items-center py-4 space-y-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleCollapse}
          className="p-2"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" className="p-2">
          <Crown className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" className="p-2">
          <Dice6 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" className="p-2">
          <Map className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" className="p-2">
          <Settings className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="w-80 bg-card border-l p-4 overflow-hidden flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">Menús</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleCollapse}
          className="p-2"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-2 flex-1 overflow-hidden">
        <CollapsibleMenu
          title="NPCs"
          icon={<Crown className="h-4 w-4" />}
          defaultOpen={true}
        >
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar NPCs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 text-xs"
                size="sm"
              />
            </div>

            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="text-xs">
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                {categories.map(category => (
                  <SelectItem key={category.value} value={category.value} className="text-xs">
                    {category.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <ScrollArea className="h-64">
              <div className="space-y-2">
                {filteredNPCs.map((npc) => (
                  <DraggableNPCCard
                    key={npc.id}
                    npc={npc}
                    onSelect={onNPCSelect}
                    onAddToBoard={onAddToBoard}
                    isSelected={selectedNPC?.id === npc.id}
                  />
                ))}
              </div>
            </ScrollArea>

            <Button size="sm" className="w-full">
              <Plus className="h-3 w-3 mr-1" />
              Crear NPC
            </Button>
          </div>
        </CollapsibleMenu>

        <CollapsibleMenu
          title="Dados y Utilidades"
          icon={<Dice6 className="h-4 w-4" />}
        >
          <div className="space-y-2">
            <Button size="sm" variant="outline" className="w-full justify-start">
              <Dice6 className="h-3 w-3 mr-2" />
              Tirador de Dados
            </Button>
            <Button size="sm" variant="outline" className="w-full justify-start">
              Generador de Nombres
            </Button>
            <Button size="sm" variant="outline" className="w-full justify-start">
              Tabla de Encuentros
            </Button>
          </div>
        </CollapsibleMenu>

        <CollapsibleMenu
          title="Mapas y Escenarios"
          icon={<Map className="h-4 w-4" />}
        >
          <div className="space-y-2">
            <Button size="sm" variant="outline" className="w-full justify-start">
              Biblioteca de Mapas
            </Button>
            <Button size="sm" variant="outline" className="w-full justify-start">
              Crear Escenario
            </Button>
            <Button size="sm" variant="outline" className="w-full justify-start">
              Configurar Ambiente
            </Button>
          </div>
        </CollapsibleMenu>

        <CollapsibleMenu
          title="Configuración"
          icon={<Settings className="h-4 w-4" />}
        >
          <div className="space-y-2">
            <Button size="sm" variant="outline" className="w-full justify-start">
              Opciones de Sesión
            </Button>
            <Button size="sm" variant="outline" className="w-full justify-start">
              Configurar Audio
            </Button>
            <Button size="sm" variant="outline" className="w-full justify-start">
              Preferencias
            </Button>
          </div>
        </CollapsibleMenu>
      </div>
    </div>
  );
}