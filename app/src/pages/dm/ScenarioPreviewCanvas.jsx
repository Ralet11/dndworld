"use client"

import { useEffect, useRef, useState, useCallback } from "react"

const ScenarioPreviewCanvas = ({
  scenario,
  layer, // Recibe la capa actual en lugar del escenario completo
  mode = "constructor",
  selectedTool = "select",
  showGrid = true,
  gridSize = 25,
  elements = [],
  onElementsChange,
  npcs = [],
  items = [],
  minimap = false,
  onBackgroundChange, // Callback para cambiar imagen de fondo
  selectedNpcForPlacement = null, // NPC seleccionado para colocar en el tablero
}) => {
  const canvasRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [selectedElement, setSelectedElement] = useState(null)
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })
  const [backgroundImage, setBackgroundImage] = useState(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const updateCanvasSize = () => {
      const rect = canvas.parentElement.getBoundingClientRect()
      canvas.width = rect.width
      canvas.height = rect.height
      setCanvasSize({ width: rect.width, height: rect.height })
    }

    updateCanvasSize()
    window.addEventListener("resize", updateCanvasSize)
    return () => window.removeEventListener("resize", updateCanvasSize)
  }, [])

  useEffect(() => {
    if (layer?.backgroundImage) {
      const img = new Image()
      img.onload = () => setBackgroundImage(img)
      img.src = layer.backgroundImage
    } else {
      setBackgroundImage(null)
    }
  }, [layer?.backgroundImage])

  const drawGrid = useCallback(
    (ctx, width, height) => {
      if (!showGrid) return

      ctx.strokeStyle = mode === "player" ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.2)"
      ctx.lineWidth = 0.5

      for (let x = 0; x <= width; x += gridSize) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, height)
        ctx.stroke()
      }

      for (let y = 0; y <= height; y += gridSize) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(width, y)
        ctx.stroke()
      }
    },
    [showGrid, gridSize, mode],
  )

  const drawElements = useCallback(
    (ctx) => {
      elements.forEach((element, index) => {
        ctx.save()

        // Aplicar transformaciones según el modo
        if (mode === "3d") {
          // Vista isométrica
          const isoX = element.x - element.y
          const isoY = (element.x + element.y) * 0.5
          ctx.translate(isoX, isoY)
        } else {
          ctx.translate(element.x, element.y)
        }

        // Dibujar según el tipo de elemento
        switch (element.type) {
          case "npc":
            if (element.avatar && mode !== "player") {
              // Dibujar avatar del NPC si está disponible
              const img = new Image()
              img.onload = () => {
                ctx.save()
                ctx.beginPath()
                ctx.arc(0, 0, element.size || 15, 0, Math.PI * 2)
                ctx.clip()
                ctx.drawImage(
                  img,
                  -(element.size || 15),
                  -(element.size || 15),
                  (element.size || 15) * 2,
                  (element.size || 15) * 2,
                )
                ctx.restore()

                // Borde del avatar
                ctx.strokeStyle = selectedElement === index ? "#ff6b6b" : "#4ecdc4"
                ctx.lineWidth = 2
                ctx.beginPath()
                ctx.arc(0, 0, element.size || 15, 0, Math.PI * 2)
                ctx.stroke()
              }
              img.src = element.avatar
            } else {
              // Círculo por defecto
              ctx.fillStyle = selectedElement === index ? "#ff6b6b" : "#4ecdc4"
              ctx.beginPath()
              ctx.arc(0, 0, element.size || 15, 0, Math.PI * 2)
              ctx.fill()
            }

            // Nombre del NPC
            if (mode !== "player" || element.visible) {
              ctx.fillStyle = "#ffffff"
              ctx.font = "12px sans-serif"
              ctx.textAlign = "center"
              ctx.shadowColor = "rgba(0,0,0,0.8)"
              ctx.shadowBlur = 2
              ctx.fillText(element.name || "NPC", 0, -25)
              ctx.shadowBlur = 0
            }

            if (element.stats && element.stats.hp && mode === "constructor") {
              ctx.fillStyle = "#ff4757"
              ctx.font = "10px sans-serif"
              ctx.textAlign = "center"
              ctx.fillText(`HP: ${element.stats.currentHp || element.stats.hp}/${element.stats.hp}`, 0, 30)
            }
            break

          case "object":
            ctx.fillStyle = selectedElement === index ? "#ffd93d" : "#6c5ce7"
            ctx.fillRect(-10, -10, 20, 20)

            if (mode !== "player" || element.visible) {
              ctx.fillStyle = "#ffffff"
              ctx.font = "10px sans-serif"
              ctx.textAlign = "center"
              ctx.fillText(element.name || "Objeto", 0, -20)
            }
            break

          case "terrain":
            ctx.fillStyle = selectedElement === index ? "#00b894" : "#00a085"
            ctx.globalAlpha = 0.7
            ctx.fillRect(
              -element.width / 2 || -25,
              -element.height / 2 || -25,
              element.width || 50,
              element.height || 50,
            )
            ctx.globalAlpha = 1
            break

          case "light":
            const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, element.radius || 50)
            gradient.addColorStop(0, `rgba(255, 255, 200, ${element.intensity || 0.3})`)
            gradient.addColorStop(1, "rgba(255, 255, 200, 0)")
            ctx.fillStyle = gradient
            ctx.beginPath()
            ctx.arc(0, 0, element.radius || 50, 0, Math.PI * 2)
            ctx.fill()
            break
        }

        ctx.restore()
      })
    },
    [elements, selectedElement, mode],
  )

  const render = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    if (layer?.type === "ambient" && backgroundImage) {
      // Capa de ambiente: imagen de fondo completa
      ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height)

      // Solo mostrar elementos si estamos en modo constructor
      if (mode === "constructor") {
        ctx.globalAlpha = 0.7
        drawElements(ctx)
        ctx.globalAlpha = 1
      }
    } else if (layer?.type === "tactical") {
      // Capa táctica: fondo oscuro + grilla + elementos
      ctx.fillStyle = mode === "constructor" ? "#1a1a2e" : "#16213e"
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Imagen de fondo opcional para mapas tácticos
      if (backgroundImage) {
        ctx.globalAlpha = 0.6
        ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height)
        ctx.globalAlpha = 1
      }

      drawGrid(ctx, canvas.width, canvas.height)
      drawElements(ctx)
    } else {
      // Fondo por defecto
      ctx.fillStyle = "#1a1a2e"
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      drawGrid(ctx, canvas.width, canvas.height)
      drawElements(ctx)
    }
  }, [layer, backgroundImage, mode, drawGrid, drawElements])

  useEffect(() => {
    render()
  }, [render])

  const handleCanvasClick = useCallback(
    (e) => {
      if (minimap) return

      const canvas = canvasRef.current
      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      if (selectedTool === "select") {
        // Buscar elemento clickeado
        const clickedIndex = elements.findIndex((element) => {
          const distance = Math.sqrt((x - element.x) ** 2 + (y - element.y) ** 2)
          return distance < (element.size || 20)
        })
        setSelectedElement(clickedIndex >= 0 ? clickedIndex : null)
      } else {
        let newElement = {
          id: Date.now(),
          type: selectedTool,
          x: Math.round(x / gridSize) * gridSize,
          y: Math.round(y / gridSize) * gridSize,
          visible: true,
        }

        if (selectedTool === "npc") {
          if (selectedNpcForPlacement) {
            // Usar datos del NPC seleccionado de la base de datos
            newElement = {
              ...newElement,
              name: selectedNpcForPlacement.name,
              description: selectedNpcForPlacement.description,
              avatar: selectedNpcForPlacement.avatar,
              stats: selectedNpcForPlacement.stats
                ? {
                    ...selectedNpcForPlacement.stats,
                    currentHp: selectedNpcForPlacement.stats.hp, // Inicializar HP actual
                  }
                : null,
              originalNpcId: selectedNpcForPlacement.originalNpcId,
              scenarioNpcId: selectedNpcForPlacement.id,
              size: 15,
            }
          } else {
            // NPC genérico si no hay uno seleccionado
            newElement = {
              ...newElement,
              name: "Nuevo NPC",
              size: 15,
            }
          }
        } else if (selectedTool === "object") {
          newElement.name = "Nuevo Objeto"
        } else if (selectedTool === "terrain") {
          newElement.name = "Terreno"
          newElement.width = 50
          newElement.height = 50
        } else if (selectedTool === "light") {
          newElement.name = "Elemento"
          newElement.radius = 50
          newElement.intensity = 0.3
        }

        onElementsChange([...elements, newElement])
      }
    },
    [selectedTool, elements, onElementsChange, gridSize, minimap, selectedNpcForPlacement],
  )

  const handleMouseDown = useCallback(
    (e) => {
      if (minimap || selectedTool !== "select" || selectedElement === null) return

      const canvas = canvasRef.current
      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      const element = elements[selectedElement]
      setDragOffset({ x: x - element.x, y: y - element.y })
      setIsDragging(true)
    },
    [selectedElement, elements, selectedTool, minimap],
  )

  const handleMouseMove = useCallback(
    (e) => {
      if (!isDragging || selectedElement === null) return

      const canvas = canvasRef.current
      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left - dragOffset.x
      const y = e.clientY - rect.top - dragOffset.y

      const newElements = [...elements]
      newElements[selectedElement] = {
        ...newElements[selectedElement],
        x: Math.round(x / gridSize) * gridSize,
        y: Math.round(y / gridSize) * gridSize,
      }

      onElementsChange(newElements)
    },
    [isDragging, selectedElement, elements, onElementsChange, dragOffset, gridSize],
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault()
      if (minimap) return

      const files = Array.from(e.dataTransfer.files)
      const imageFile = files.find((file) => file.type.startsWith("image/"))

      if (imageFile && onBackgroundChange) {
        const reader = new FileReader()
        reader.onload = (event) => {
          onBackgroundChange(event.target.result)
        }
        reader.readAsDataURL(imageFile)
      }
    },
    [minimap, onBackgroundChange],
  )

  const handleDragOver = useCallback((e) => {
    e.preventDefault()
  }, [])

  return (
    <div className={`relative w-full h-full ${minimap ? "pointer-events-none" : ""}`}>
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-crosshair"
        onClick={handleCanvasClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        style={{
          cursor: selectedTool === "select" ? "default" : "crosshair",
          transform: minimap ? "scale(0.25)" : "none",
          transformOrigin: "top left",
        }}
      />

      {!minimap && (
        <div className="absolute top-4 left-4 gaming-card p-2 bg-surface/90 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                layer?.type === "ambient"
                  ? "bg-secondary animate-pulse"
                  : layer?.type === "tactical"
                    ? "bg-accent animate-pulse"
                    : "bg-primary"
              }`}
            />
            <span className="text-xs font-medium">
              {layer?.type === "ambient"
                ? "Capa de Ambiente"
                : layer?.type === "tactical"
                  ? "Mapa Táctico"
                  : "Modo Constructor"}
            </span>
          </div>
        </div>
      )}

      {!minimap && selectedNpcForPlacement && selectedTool === "npc" && (
        <div className="absolute top-4 right-4 gaming-card p-3 bg-secondary/90 backdrop-blur-sm border border-secondary/30">
          <div className="flex items-center gap-2 mb-2">
            {selectedNpcForPlacement.avatar && (
              <img
                src={selectedNpcForPlacement.avatar || "/placeholder.svg"}
                alt={selectedNpcForPlacement.name}
                className="w-6 h-6 rounded-full object-cover"
              />
            )}
            <div>
              <h4 className="text-sm font-semibold text-secondary">{selectedNpcForPlacement.name}</h4>
              <p className="text-xs text-text-muted">Listo para colocar</p>
            </div>
          </div>
          {selectedNpcForPlacement.stats && (
            <div className="text-xs text-text-muted">
              HP: {selectedNpcForPlacement.stats.hp} | AC: {selectedNpcForPlacement.stats.ac || "N/A"}
            </div>
          )}
        </div>
      )}

      {!minimap && layer && (
        <div className="absolute bottom-4 left-4 gaming-card p-2 bg-surface/90 backdrop-blur-sm">
          <p className="text-xs text-text-muted">
            💡 Arrastra una imagen aquí para {layer.type === "ambient" ? "el fondo" : "el mapa base"}
          </p>
        </div>
      )}

      {!minimap && selectedElement !== null && elements[selectedElement] && (
        <div className="absolute top-4 right-4 gaming-card p-3 bg-surface/90 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-2">
            {elements[selectedElement].avatar && (
              <img
                src={elements[selectedElement].avatar || "/placeholder.svg"}
                alt={elements[selectedElement].name}
                className="w-6 h-6 rounded-full object-cover"
              />
            )}
            <div>
              <h4 className="text-sm font-semibold text-text-primary">{elements[selectedElement].name}</h4>
              <div className="text-xs text-text-muted">
                {elements[selectedElement].type} • X: {elements[selectedElement].x} • Y: {elements[selectedElement].y}
              </div>
            </div>
          </div>

          {elements[selectedElement].type === "npc" && elements[selectedElement].stats && (
            <div className="mb-2 p-2 rounded bg-surface border border-border/50">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  HP: {elements[selectedElement].stats.currentHp || elements[selectedElement].stats.hp}/
                  {elements[selectedElement].stats.hp}
                </div>
                <div>AC: {elements[selectedElement].stats.ac || "N/A"}</div>
                <div>CR: {elements[selectedElement].stats.challengeRating || "N/A"}</div>
                <div>Speed: {elements[selectedElement].stats.speed || "N/A"}</div>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            {elements[selectedElement].type === "npc" && elements[selectedElement].stats && (
              <button
                onClick={() => {
                  const newElements = [...elements]
                  const currentHp =
                    newElements[selectedElement].stats.currentHp || newElements[selectedElement].stats.hp
                  const newHp = Math.max(0, currentHp - 1)
                  newElements[selectedElement].stats.currentHp = newHp
                  onElementsChange(newElements)
                }}
                className="flex-1 gaming-button-danger text-xs py-1"
              >
                -1 HP
              </button>
            )}
            <button
              onClick={() => {
                const newElements = elements.filter((_, i) => i !== selectedElement)
                onElementsChange(newElements)
                setSelectedElement(null)
              }}
              className="flex-1 gaming-button-danger text-xs py-1"
            >
              Eliminar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default ScenarioPreviewCanvas
