import { useState } from "react";
import { NPCCard } from "./npc-card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { ScrollArea } from "./ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Plus, Search, Crown, Sword } from "lucide-react";

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
  onNPCSelect?: (npc: NPC) => void;
  onAddToBoard?: (npc: NPC) => void;
}

export function NPCPanel({ npcs, selectedNPC, onNPCSelect, onAddToBoard }: NPCPanelProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("browse");

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center">
          <Crown className="h-5 w-5 mr-2" />
          NPCs
        </h2>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Crear NPC
        </Button>
      </div>

      <div className="text-sm text-muted-foreground">
        Este panel está orientado a poder ver los NPCs que existen en la base de datos. 
        Podrás seleccionar un NPC para arrastrar su ficha al tablero y ver sus estadísticas.
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="browse">
            <Search className="h-4 w-4 mr-1" />
            Explorar
          </TabsTrigger>
          <TabsTrigger value="active">
            <Sword className="h-4 w-4 mr-1" />
            En Tablero
          </TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="space-y-4">
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar NPCs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>

            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por categoría" />
              </SelectTrigger>
              <SelectContent>
                {categories.map(category => (
                  <SelectItem key={category.value} value={category.value}>
                    {category.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <ScrollArea className="h-[500px]">
            <div className="space-y-3">
              {filteredNPCs.map((npc) => (
                <NPCCard
                  key={npc.id}
                  npc={npc}
                  onSelect={onNPCSelect}
                  onAddToBoard={onAddToBoard}
                  isSelected={selectedNPC?.id === npc.id}
                />
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="active" className="space-y-4">
          <div className="text-center py-8 text-muted-foreground">
            <Sword className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No hay NPCs activos en el tablero</p>
            <p className="text-sm">Selecciona NPCs de la pestaña "Explorar" para añadirlos</p>
          </div>
        </TabsContent>
      </Tabs>

      {selectedNPC && (
        <div className="border-t pt-4">
          <div className="text-sm">
            <div className="font-medium mb-2">NPC Seleccionado:</div>
            <div className="text-muted-foreground">{selectedNPC.name}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {selectedNPC.description}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}