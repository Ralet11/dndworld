import { Scroll, Sparkles } from 'lucide-react';

export default function Chronicles() {
  return (
    <div className="chronicle-empty">
      <div className="chronicle-empty-content">
        <div className="chronicle-empty-icon"><Scroll size={33} strokeWidth={1.2} /></div>
        <p className="section-kicker">Archivo de campaña</p>
        <h1 className="section-title">Crónicas</h1>
        <div className="ornament-divider my-5"><Sparkles size={12} /></div>
        <p className="mx-auto max-w-md text-sm leading-7 text-[#8c877d]">
          Aquí quedará escrito el relato de la mesa: escenas, decisiones, diálogos y tiradas que cambien el destino del grupo.
        </p>
        <p className="mt-6 font-serif text-[9px] uppercase tracking-[0.18em] text-[#a8884f]">El archivo aún no ha sido abierto</p>
      </div>
    </div>
  );
}
