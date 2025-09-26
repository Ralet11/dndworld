import { useState } from "react";
import { CharacterMiniCard } from "./character-mini-card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { ScrollArea } from "./ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Badge } from "./ui/badge";
import { Plus, Search, Users, Wifi, Crown } from "lucide-react";

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
  isConnected?: boolean;
}

interface CharacterPanelProps {
  characters: Character[];
  onCharacterMove?: (character: Character, newScenario: string) => void;
}

export function CharacterPanel({ characters, onCharacterMove }: CharacterPanelProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTab, setSelectedTab] = useState("connected");

  // Simular algunos personajes como conectados
  const charactersWithConnection = characters.map(char => ({
    ...char,
    isConnected: char.scenario === "active" || Math.random() > 0.3 // Simular conexiones
  }));

  const filteredCharacters = charactersWithConnection.filter(character =>
    character.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    character.class.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const connectedCharacters = filteredCharacters.filter(c => c.isConnected);
  const activeCharacters = filteredCharacters.filter(c => c.scenario === "active");
  const allCharacters = filteredCharacters;

  return (
    <div className="space-y-3 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium flex items-center">
          <Users className="h-4 w-4 mr-1" />
          Personajes
          <Badge variant="secondary" className="ml-2 text-xs">
            {connectedCharacters.length} conectados
          </Badge>
        </h2>
        <Button size="sm" className="text-xs h-7">
          <Plus className="h-3 w-3 mr-1" />
          Nuevo
        </Button>
      </div>

      {/* Connection Status */}
      <div className="flex items-center space-x-2 text-xs">
        <div className="flex items-center text-green-600">
          <div className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse"></div>
          <Wifi className="h-3 w-3 mr-1" />
          Sesión en vivo
        </div>
        <span className="text-muted-foreground">
          {connectedCharacters.length}/{characters.length} jugadores
        </span>
      </div>

      <div className="relative">
        <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
        <Input
          placeholder="Buscar personajes..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-7 text-xs h-8"
        />
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-3 h-8">
          <TabsTrigger value="connected" className="text-xs flex items-center">
            <Wifi className="h-3 w-3 mr-1" />
            Conectados ({connectedCharacters.length})
          </TabsTrigger>
          <TabsTrigger value="active" className="text-xs flex items-center">
            <Crown className="h-3 w-3 mr-1" />
            En Juego ({activeCharacters.length})
          </TabsTrigger>
          <TabsTrigger value="all" className="text-xs">
            Todos ({allCharacters.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="connected" className="mt-3 flex-1">
          <ScrollArea className="h-full">
            <div className="space-y-3">
              {connectedCharacters.length > 0 ? (
                connectedCharacters.map((character) => (
                  <CharacterMiniCard
                    key={character.id}
                    character={character}
                    onMove={onCharacterMove}
                  />
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Wifi className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-xs">No hay jugadores conectados</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="active" className="mt-3 flex-1">
          <ScrollArea className="h-full">
            <div className="space-y-3">
              {activeCharacters.length > 0 ? (
                activeCharacters.map((character) => (
                  <CharacterMiniCard
                    key={character.id}
                    character={character}
                    onMove={onCharacterMove}
                  />
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Crown className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-xs">No hay personajes en juego</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="all" className="mt-3 flex-1">
          <ScrollArea className="h-full">
            <div className="space-y-3">
              {allCharacters.map((character) => (
                <CharacterMiniCard
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
        <Button variant="outline" size="sm" className="w-full text-xs h-7">
          <Crown className="h-3 w-3 mr-1" />
          Gestionar Sesión
        </Button>
      </div>
    </div>
  );
}