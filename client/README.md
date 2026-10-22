# D&D World · cliente web

Interfaz React y Vite para las perspectivas del director de juego y del jugador.

La [guía principal](../README.md) documenta arquitectura, instalación, backend y límites de verificación. Consulta el [estado de calidad](../docs/verification.md) antes de preparar una demo.

```bash
npm ci --ignore-scripts
npm run dev
npm test
npm run build
npm run lint
```

El backend local se espera en `http://127.0.0.1:3001`. Se puede configurar `VITE_API_URL` usando `.env.example`; las variables `VITE_*` son públicas y no deben contener secretos.

`npm run lint` conserva las reglas del proyecto y pasa en la revisión documentada. `npm test` cubre hooks y providers con dependencias externas simuladas; no equivale a una prueba end-to-end.
