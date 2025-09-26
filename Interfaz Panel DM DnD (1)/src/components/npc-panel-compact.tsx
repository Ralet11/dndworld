import { useState } from "react";
import { NPCCard } from "./npc-card-compact";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { ScrollArea } from "./ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Plus, Search, Crown, Sword, MessageCircle } from "lucide-react";

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

interface NPCPanelProps {
  npcs: NPC[];
  selectedNPC?: NPC;
  activeNPCs?: string[];
  onNPCSelect?: (npc: NPC) => void;
  onAddToBoard?: (npc: NPC) => void;
  onActivateNPC?: (npc: NPC) => void;
}

export function NPCPanel({ npcs, selectedNPC, activeNPCs = [], onNPCSelect, onAddToBoard, onActivateNPC }: NPCPanelProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("browse");

  const filteredNPCs = npcs.filter(npc => {
    const matchesSearch = npc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         npc.type.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "all" || npc.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const activeNPCList = npcs.filter(npc => activeNPCs.includes(npc.id));

  const categories = [
    { value: "all", label: "Todos" },
    { value: "humanoid", label: "Humanoides" },
    { value: "beast", label: "Bestias" },
    { value: "undead", label: "No Muertos" },
    { value: "dragon", label: "Dragones" },
    { value: "fiend", label: "Demonios" },
    { value: "celestial", label: "Celestiales" }
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium flex items-center">
          <Crown className="h-4 w-4 mr-1" />
          NPCs
        </h2>
        <Button size="sm" className="text-xs h-7">
          <Plus className="h-3 w-3 mr-1" />
          Crear NPC
        </Button>
      </div>

      <div className="text-xs text-muted-foreground">
        Este panel muestra los NPCs disponibles. 
        <strong>Arrastra</strong> los NPCs directamente al tablero táctico o usa el botón "Al Tablero". 
        Los NPCs pueden activarse para diálogos usando el botón "Activar".
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 h-8">
          <TabsTrigger value="browse" className="text-xs">
            <Search className="h-3 w-3 mr-1" />
            Explorar
          </TabsTrigger>
          <TabsTrigger value="active" className="text-xs">
            <MessageCircle className="h-3 w-3 mr-1" />
            Activos ({activeNPCs.length})
          </TabsTrigger>
          <TabsTrigger value="board" className="text-xs">
            <Sword className="h-3 w-3 mr-1" />
            Tablero
          </TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="space-y-3 mt-3">
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <Input
                placeholder="Buscar NPCs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-7 text-xs h-8"
              />
            </div>

            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="text-xs h-8">
                <SelectValue placeholder="Filtrar por categoría" />
              </SelectTrigger>
              <SelectContent>
                {categories.map(category => (
                  <SelectItem key={category.value} value={category.value} className="text-xs">
                    {category.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <ScrollArea className="h-[400px]">
            <div className="space-y-2">
              {filteredNPCs.map((npc) => (
                <NPCCard
                  key={npc.id}
                  npc={npc}
                  onSelect={onNPCSelect}
                  onAddToBoard={onAddToBoard}
                  onActivate={onActivateNPC}
                  isSelected={selectedNPC?.id === npc.id}
                  isActive={activeNPCs.includes(npc.id)}
                />
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="active" className="space-y-3 mt-3">
          {activeNPCList.length > 0 ? (
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {activeNPCList.map((npc) => (
                  <NPCCard
                    key={npc.id}
                    npc={npc}
                    onSelect={onNPCSelect}
                    onAddToBoard={onAddToBoard}
                    onActivate={onActivateNPC}
                    isSelected={selectedNPC?.id === npc.id}
                    isActive={true}
                  />
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-xs">No hay NPCs activos</p>
              <p className="text-xs">Activa NPCs desde la pestaña "Explorar"</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="board" className="space-y-3 mt-3">
          <div className="text-center py-8 text-muted-foreground">
            <Sword className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-xs">No hay NPCs en el tablero</p>
            <p className="text-xs">Arrastra NPCs desde "Explorar"</p>
          </div>
        </TabsContent>
      </Tabs>

      {selectedNPC && (
        <div className="border-t pt-2">
          <div className="text-xs">
            <div className="font-medium mb-1">NPC Seleccionado:</div>
            <div className="text-muted-foreground">{selectedNPC.name}</div>
            <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {selectedNPC.description}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}