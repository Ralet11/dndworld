import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { X, MessageCircle, Heart, Shield, Sword } from "lucide-react";

interface ActiveNPC {
  id: string;
  name: string;
  type: string;
  cr: string;
  hp: number;
  ac: number;
  description: string;
  avatar?: string;
  stats: {
    str: number;
    dex: number;
    con: number;
    int: number;
    wis: number;
    cha: number;
  };
  isFocused?: boolean;
}

interface ActiveNPCOverlayProps {
  activeNPCs: ActiveNPC[];
  onDeactivate: (npcId: string) => void;
  onFocus: (npcId: string) => void;
}

export function ActiveNPCOverlay({ activeNPCs, onDeactivate, onFocus }: ActiveNPCOverlayProps) {
  const [selectedNPC, setSelectedNPC] = useState<ActiveNPC | null>(null);

  if (activeNPCs.length === 0) return null;

  const handleNPCClick = (npc: ActiveNPC) => {
    if (npc.isFocused) {
      // Si ya está enfocado, abrir modal con detalles
      setSelectedNPC(npc);
    } else {
      // Si no está enfocado, cambiar foco
      onFocus(npc.id);
    }
  };

  return (
    <>
      {/* NPCs Cards fullscreen */}
      <div className="absolute right-4 top-4 bottom-4 z-50 w-80 space-y-2">
        <AnimatePresence>
          {activeNPCs.map((npc, index) => (
            <motion.div
              key={npc.id}
              initial={{ 
                x: 350,
                opacity: 0,
                scale: 0.9
              }}
              animate={{ 
                x: npc.isFocused ? -8 : 0,
                opacity: npc.isFocused ? 1 : 0.8,
                scale: npc.isFocused ? 1.02 : 0.95,
                transition: {
                  type: "spring",
                  stiffness: 300,
                  damping: 30,
                  delay: index * 0.1
                }
              }}
              exit={{ 
                x: 350,
                opacity: 0,
                scale: 0.9,
                transition: {
                  duration: 0.3
                }
              }}
              whileHover={{ 
                scale: npc.isFocused ? 1.03 : 0.97,
                x: npc.isFocused ? -12 : -6
              }}
              className="relative h-40"
            >
              {/* Card fullscreen del NPC */}
              <div
                className={`
                  relative w-full h-full rounded-xl overflow-hidden cursor-pointer
                  shadow-2xl transition-all duration-300 group
                  ${npc.isFocused 
                    ? 'ring-4 ring-blue-400/50 shadow-blue-500/30' 
                    : 'hover:ring-2 hover:ring-white/30'
                  }
                `}
                onClick={() => handleNPCClick(npc)}
                style={{
                  backgroundImage: `url(${npc.avatar})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat'
                }}
              >
                {/* Overlay oscuro para legibilidad */}
                <div className={`
                  absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent
                  ${npc.isFocused ? 'from-black/60' : 'from-black/80'}
                  transition-all duration-300
                `} />

                {/* Indicador de que está hablando */}
                {npc.isFocused && (
                  <div className="absolute left-4 top-4 z-10 flex items-center space-x-2">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                    </div>
                    <span className="text-blue-300 text-xs font-medium">Hablando</span>
                  </div>
                )}

                {/* Nombre del NPC */}
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <h3 className={`
                    font-bold text-xl text-white drop-shadow-lg
                    ${npc.isFocused ? 'text-blue-100' : 'text-white'}
                    transition-colors duration-300
                  `}>
                    {npc.name}
                  </h3>
                  {npc.isFocused && (
                    <p className="text-blue-200 text-sm opacity-90 mt-1">
                      {npc.type} • CR {npc.cr}
                    </p>
                  )}
                </div>

                {/* Icono de habla si está enfocado */}
                {npc.isFocused && (
                  <div className="absolute right-4 top-4">
                    <div className="w-8 h-8 bg-blue-500/80 backdrop-blur-sm rounded-full flex items-center justify-center">
                      <MessageCircle className="h-4 w-4 text-white" />
                    </div>
                  </div>
                )}

                {/* Botón cerrar */}
                <button
                  className="absolute top-4 right-4 w-8 h-8 bg-red-500/80 backdrop-blur-sm hover:bg-red-600 
                           rounded-full flex items-center justify-center transition-all duration-200
                           text-white shadow-lg opacity-0 group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeactivate(npc.id);
                  }}
                >
                  <X className="h-4 w-4" />
                </button>

                {/* Efecto de brillo y border si está enfocado */}
                {npc.isFocused && (
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 via-transparent to-purple-500/20 pointer-events-none" />
                )}

                {/* Efecto de hover para NPCs no enfocados */}
                {!npc.isFocused && (
                  <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Modal con información detallada del NPC */}
      <Dialog open={!!selectedNPC} onOpenChange={() => setSelectedNPC(null)}>
        <DialogContent className="max-w-md">
          {selectedNPC && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center space-x-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={selectedNPC.avatar} />
                    <AvatarFallback>{selectedNPC.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-bold text-lg">{selectedNPC.name}</h3>
                    <p className="text-sm text-muted-foreground">{selectedNPC.type}</p>
                  </div>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                {/* Stats básicas */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-2 bg-muted rounded">
                    <Heart className="h-4 w-4 mx-auto text-red-500 mb-1" />
                    <div className="text-sm font-medium">{selectedNPC.hp}</div>
                    <div className="text-xs text-muted-foreground">PV</div>
                  </div>
                  <div className="text-center p-2 bg-muted rounded">
                    <Shield className="h-4 w-4 mx-auto text-blue-500 mb-1" />
                    <div className="text-sm font-medium">{selectedNPC.ac}</div>
                    <div className="text-xs text-muted-foreground">CA</div>
                  </div>
                  <div className="text-center p-2 bg-muted rounded">
                    <Sword className="h-4 w-4 mx-auto text-orange-500 mb-1" />
                    <div className="text-sm font-medium">CR {selectedNPC.cr}</div>
                    <div className="text-xs text-muted-foreground">Desafío</div>
                  </div>
                </div>

                {/* Estadísticas */}
                <div>
                  <h4 className="font-medium mb-2">Atributos</h4>
                  <div className="grid grid-cols-6 gap-2 text-xs">
                    <div className="text-center p-2 bg-muted rounded">
                      <div className="font-medium">FUE</div>
                      <div>{selectedNPC.stats.str}</div>
                    </div>
                    <div className="text-center p-2 bg-muted rounded">
                      <div className="font-medium">DES</div>
                      <div>{selectedNPC.stats.dex}</div>
                    </div>
                    <div className="text-center p-2 bg-muted rounded">
                      <div className="font-medium">CON</div>
                      <div>{selectedNPC.stats.con}</div>
                    </div>
                    <div className="text-center p-2 bg-muted rounded">
                      <div className="font-medium">INT</div>
                      <div>{selectedNPC.stats.int}</div>
                    </div>
                    <div className="text-center p-2 bg-muted rounded">
                      <div className="font-medium">SAB</div>
                      <div>{selectedNPC.stats.wis}</div>
                    </div>
                    <div className="text-center p-2 bg-muted rounded">
                      <div className="font-medium">CAR</div>
                      <div>{selectedNPC.stats.cha}</div>
                    </div>
                  </div>
                </div>

                {/* Descripción */}
                <div>
                  <h4 className="font-medium mb-2">Descripción</h4>
                  <p className="text-sm text-muted-foreground">
                    {selectedNPC.description}
                  </p>
                </div>

                {/* Acciones */}
                <div className="flex space-x-2">
                  <Button 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => onFocus(selectedNPC.id)}
                  >
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Enfocar
                  </Button>
                  <Button 
                    variant="destructive" 
                    className="flex-1"
                    onClick={() => {
                      onDeactivate(selectedNPC.id);
                      setSelectedNPC(null);
                    }}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Desactivar
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}