# Archivo del experimento de modelos 3D (img2threejs)

Todo el trabajo de la sesión donde probamos generar modelos 3D (espada y ballesta)
con la skill `img2threejs`, sacado de la app para que vuelva a andar como antes.
Nada se borró — está todo acá, listo para retomar.

## Qué hay en cada carpeta

- **`mobile-screens/`** — las 2 pantallas de prueba (`dev-3d-test.tsx`, `dev-3d-test-2.tsx`)
  que se usaban en la app mobile para ver los modelos en el celular real. Para
  reactivarlas: copiarlas de nuevo a `mobile/app/`, reinstalar `expo-gl`, `expo-three`,
  `three` y `@types/three` en `mobile/`, y volver a agregar los botones flotantes en
  `mobile/app/_layout.tsx` (buscar `Dev3DButton` en el historial de git si hace falta
  el código exacto).
- **`mobile-utils/`** — los modelos generados (`createEspadaCortaModel.ts`,
  `createBallestaModel.ts`), ya parcheados para andar en React Native.
- **`reference-images/`** — la imagen de referencia de la ballesta (hoja con varios
  ángulos, generada con IA) y el ejemplo de referencia técnica de una pistola
  (`createGlockGhostProtocolModel.ts`, de donde salió la técnica del "loft" de
  espesor variable que se usó en la hoja y la guarda de la espada).
- **`pipeline-work/espada-corta/`** y **`pipeline-work/ballesta/`** — todo el proceso
  de autoría de cada asset: imagen de referencia, análisis, `object-sculpt-spec.json`
  (el spec completo y validado), el código TypeScript generado por la skill, los
  scripts de parche (`patch_factory.py`) que corrigen los bugs conocidos, y las
  capturas de cada intento de render.

## Estado en el que quedó cada uno

**Espada Corta:** pasada `blockout` cerrada y revisada. Hoja y pomo con geometría
real (nervadura de la hoja, guarda con bloque diamante), generada con la técnica de
loft de espesor variable. Guarda y empuñadura con perfiles reales (torno/lathe).
Faltan las 6 pasadas restantes (material, superficie, iluminación, etc.) para un
resultado terminado.

**Ballesta:** más cruda — solo una pasada rápida sin el ciclo de revisión completo.
Le falta afinar la curva del arco, la posición del guardamonte (agregado pero sin
confirmar que quede bien ubicado), y todo el resto del proceso de pulido. Quedó
identificada como el caso donde más se notó la diferencia entre "boceto rápido" y
"resultado terminado".

## Bugs reales que se encontraron y cómo se resolvieron (van a reaparecer si se retoma)

1. **Componentes sin eje de acople (`root`) generan una caja 1×1×1 fija** sin
   importar las dimensiones del spec — hay que forzarla a un tamaño despreciable.
2. **Componentes CON eje de acople siempre usan un cilindro genérico**, nunca la
   geometría de perfil real (extrude/lathe/curve-sweep), sin importar la pasada —
   hay que parchar la línea de construcción de geometría directamente en el código
   generado (ver `patch_factory.py` en cada carpeta).
3. **React Native tiene un `document` global mínimo** que engaña el chequeo
   `typeof document === 'undefined'` del código generado — hace falta detectar RN
   explícitamente (`navigator.product === 'ReactNative'`) antes de intentar generar
   texturas procedurales.
4. **El gate de admisión de referencia de la skill rechaza fondos con viñeta/color**,
   sin importar cuán oscuros sean — solo acepta fondos genuinamente acromáticos. Hubo
   que agregarle un margen blanco a las imágenes de referencia para pasarlo (esto
   degrada la fidelidad de la extracción automática de color, hay que usar valores
   estimados a mano en su lugar).
5. **SwiftShader (WebGL por software, sin GPU) pierde el contexto** al compilar
   `MeshPhysicalMaterial` completo — para capturas de evidencia automatizadas hace
   falta cambiar a `MeshStandardMaterial` como workaround, o renderizar en un
   navegador con GPU real en vez de headless.

## Para retomar

Lo más simple: pedirle a Claude que lea este archivo y siga desde acá.
