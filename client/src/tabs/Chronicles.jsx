import { Scroll, Hammer } from 'lucide-react';

export default function Chronicles() {
  return (
    <div className="flex flex-1 items-center justify-center px-8 py-16 text-center min-h-[60vh]">
      <div className="flex flex-col items-center max-w-md">
        <div
          className="w-24 h-24 rounded-full flex items-center justify-center mb-6"
          style={{
            background: '#16211F',
            border: '1.5px solid #8A6A3B',
            boxShadow: '0 0 24px rgba(255,122,26,0.2)',
          }}
        >
          <Scroll size={44} style={{ color: '#F59E0B' }} />
        </div>

        <h1 className="text-4xl md:text-5xl font-black" style={{ color: '#EDE6D8' }}>Chronicles</h1>
        <p className="text-sm md:text-base mt-2" style={{ color: '#A89F8E' }}>La crónica de la aventura</p>

        <div
          className="flex items-center gap-2 mt-6 px-4 py-2 rounded-full"
          style={{ background: '#1E2A28', border: '1px solid #5A4424' }}
        >
          <Hammer size={14} style={{ color: '#C8A36A' }} />
          <span className="label-caps" style={{ color: '#C8A36A' }}>En construcción</span>
        </div>

        <p className="mt-6 leading-relaxed" style={{ color: '#6B6557', fontSize: 14, maxWidth: 320 }}>
          Aquí vivirá el relato de la mesa: escenas, diálogo y tiradas en tiempo real.
          Estamos forjándolo. Por ahora, explorá tu héroe, el equipo y el mundo.
        </p>
      </div>
    </div>
  );
}
