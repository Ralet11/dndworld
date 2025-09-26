import { useState } from "react";
import { DraggableCharacterCard } from "./draggable-character-card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { ScrollArea } from "./ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Plus, Search, Users } from "lucide-react";

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
}

interface CharacterPanelProps {
  characters: Character[];
  onCharacterMove?: (character: Character, newScenario: string) => void;
}

export function CharacterPanel({ characters, onCharacterMove }: CharacterPanelProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTab, setSelectedTab] = useState("all");

  const filteredCharacters = characters.filter(character =>
    character.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    character.class.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeCharacters = filteredCharacters.filter(c => c.scenario === "active");
  const reserveCharacters = filteredCharacters.filter(c => c.scenario !== "active");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center">
          <Users className="h-5 w-5 mr-2" />
          Personajes
        </h2>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Nuevo
        </Button>
      </div>

      <div className="text-sm text-muted-foreground">
        Aquí verás el registro de los personajes. Podrás moverlos entre los escenarios 
        y gestionar su estado durante la partida.
      </div>

      <div className="relative">
        <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar personajes..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-8"
        />
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all">Todos ({filteredCharacters.length})</TabsTrigger>
          <TabsTrigger value="active">En Juego ({activeCharacters.length})</TabsTrigger>
          <TabsTrigger value="reserve">Reserva ({reserveCharacters.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4">
          <ScrollArea className="h-[400px]">
            <div className="space-y-3">
              {filteredCharacters.map((character) => (
                <DraggableCharacterCard
                  key={character.id}
                  character={character}
                  onMove={onCharacterMove}
                />
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="active" className="mt-4">
          <ScrollArea className="h-[400px]">
            <div className="space-y-3">
              {activeCharacters.map((character) => (
                <DraggableCharacterCard
                  key={character.id}
                  character={character}
                  onMove={onCharacterMove}
                />
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="reserve" className="mt-4">
          <ScrollArea className="h-[400px]">
            <div className="space-y-3">
              {reserveCharacters.map((character) => (
                <DraggableCharacterCard
                  key={character.id}
                  character={character}
                  onMove={onCharacterMove}
                />
              ))}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>

      <div className="pt-2 border-t">
        <Button variant="outline" size="sm" className="w-full">
          Gestionar Escenarios
        </Button>
      </div>
    </div>
  );
}