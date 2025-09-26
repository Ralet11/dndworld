import { useState } from "react";
import { CollapsibleMenu } from "./collapsible-menu";
import { NPCPanel } from "./npc-panel-compact";
import { Button } from "./ui/button";
import { 
  Crown, 
  Dice6, 
  Map, 
  Settings, 
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
  activeNPCs?: string[];
  onNPCSelect?: (npc: NPC) => void;
  onAddToBoard?: (npc: NPC) => void;
  onActivateNPC?: (npc: NPC) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function CollapsibleSidebar({ 
  npcs, 
  selectedNPC, 
  activeNPCs = [],
  onNPCSelect, 
  onAddToBoard,
  onActivateNPC,
  isCollapsed = false,
  onToggleCollapse
}: CollapsibleSidebarProps) {

  if (isCollapsed) {
    return (
      <div className="w-10 bg-card border-l flex flex-col items-center py-3 space-y-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleCollapse}
          className="p-1 h-7 w-7"
        >
          <ChevronLeft className="h-3 w-3" />
        </Button>
        <Button variant="ghost" size="sm" className="p-1 h-7 w-7">
          <Crown className="h-3 w-3" />
        </Button>
        <Button variant="ghost" size="sm" className="p-1 h-7 w-7">
          <Dice6 className="h-3 w-3" />
        </Button>
        <Button variant="ghost" size="sm" className="p-1 h-7 w-7">
          <Map className="h-3 w-3" />
        </Button>
        <Button variant="ghost" size="sm" className="p-1 h-7 w-7">
          <Settings className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <div className="w-72 bg-card border-l p-3 overflow-hidden flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-medium text-sm">Menús</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleCollapse}
          className="p-1 h-6 w-6"
        >
          <ChevronRight className="h-3 w-3" />
        </Button>
      </div>

      <div className="space-y-2 flex-1 overflow-hidden">
        <CollapsibleMenu
          title="NPCs"
          icon={<Crown className="h-4 w-4" />}
          defaultOpen={true}
        >
          <NPCPanel
            npcs={npcs}
            selectedNPC={selectedNPC}
            activeNPCs={activeNPCs}
            onNPCSelect={onNPCSelect}
            onAddToBoard={onAddToBoard}
            onActivateNPC={onActivateNPC}
          />
        </CollapsibleMenu>

        <CollapsibleMenu
          title="Dados y Utilidades"
          icon={<Dice6 className="h-4 w-4" />}
        >
          <div className="space-y-2">
            <Button size="sm" variant="outline" className="w-full justify-start text-xs h-7">
              <Dice6 className="h-3 w-3 mr-2" />
              Tirador de Dados
            </Button>
            <Button size="sm" variant="outline" className="w-full justify-start text-xs h-7">
              Generador de Nombres
            </Button>
            <Button size="sm" variant="outline" className="w-full justify-start text-xs h-7">
              Tabla de Encuentros
            </Button>
          </div>
        </CollapsibleMenu>

        <CollapsibleMenu
          title="Mapas y Escenarios"
          icon={<Map className="h-4 w-4" />}
        >
          <div className="space-y-2">
            <Button size="sm" variant="outline" className="w-full justify-start text-xs h-7">
              Biblioteca de Mapas
            </Button>
            <Button size="sm" variant="outline" className="w-full justify-start text-xs h-7">
              Crear Escenario
            </Button>
            <Button size="sm" variant="outline" className="w-full justify-start text-xs h-7">
              Configurar Ambiente
            </Button>
          </div>
        </CollapsibleMenu>

        <CollapsibleMenu
          title="Configuración"
          icon={<Settings className="h-4 w-4" />}
        >
          <div className="space-y-2">
            <Button size="sm" variant="outline" className="w-full justify-start text-xs h-7">
              Opciones de Sesión
            </Button>
            <Button size="sm" variant="outline" className="w-full justify-start text-xs h-7">
              Configurar Audio
            </Button>
            <Button size="sm" variant="outline" className="w-full justify-start text-xs h-7">
              Preferencias
            </Button>
          </div>
        </CollapsibleMenu>
      </div>
    </div>
  );
}