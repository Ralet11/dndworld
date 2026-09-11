import { useState } from 'react';
import { ArrowLeft, BookOpen, CalendarDays, MapPin, Scroll, Share2 } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const CHRONICLE_PATH = '/chronicles/informes-de-herbolago';

const story = `Aurel Venn intentaba recuperar un sello de cobre de una rata.

—Devuélvemelo —dijo.

La rata, sentada sobre el libro mayor de suministros, continuó mordiendo el sello.

—Cronista —dijo Lysa Marek desde la puerta—, eso no parece un procedimiento oficial.

—Esta rata ha robado propiedad de Prontera.

—También parece que ha comido el informe de recaudación.

Aurel entrecerró los ojos.

—Entonces tiene antecedentes.

La rata tomó el sello entre los dientes y desapareció bajo un estante.

Aurel miró a Lysa.

—No lo menciones en el registro.

Lysa dejó un tubo de cuero sobre el escritorio. El sello de Prontera, intacto, brillaba en la cera.

—Este llegó desde Herbolago. Y, para su tranquilidad, ninguna rata lo trajo.

El humor abandonó el rostro de Aurel.

Rompió el sello.

El informe era breve. Demasiado breve para una derrota.

Las huestes del comandante Harven Taal habían sido vencidas al otro lado de Thanemor. La retirada había roto las compañías, dispersado a los heridos y dejado el camino lleno de uniformes de Prontera sin hombres dentro.

Durante días, supervivientes habían alcanzado Herbolago en grupos pequeños: sin oficiales, sin equipo, con heridas mal vendadas y silencios demasiado largos.

Pero entre ellos habían llegado cuatro con una noticia distinta.

Tres soldados. Un mago de pelotón.

Aurel leyó sobre Valnevar: nieve bajo un cielo que no debía producirla; granizo sobre los techos; una niebla que congelaba cerraduras y pulmones. Criaturas de hielo que bajaban cada noche para exigir sacrificios.

Luego, una fractura.

Una cámara bajo tierra. Un muro de hielo. Una figura enorme detrás de él, más alta que un orco, con colmillos pálidos y los ojos cerrados. Un portal abierto junto a la criatura. Una tormenta naciendo de aquella herida.

Y, al final:

El mago de pelotón cerró la senda. Método desconocido. Los cuatro supervivientes llegaron a Herbolago con vida.

—Un mago cerró una senda —dijo Lysa.

—Eso parece.

—¿Es una buena noticia?

Aurel abrió el armario de mapas y sacó una tablilla cubierta por una tela gris. Sus signos eran viejos, angulosos, imposibles de leer sin sentir que algo los leía de vuelta.

—Los Urdh-Akan —dijo—. Una raza olvidada antes de la Fractura. Sus prisiones no tenían guardias. Tenían hielo.

Lysa observó la tablilla.

—¿Y la criatura?

—Un prisionero.

Aurel señaló uno de los símbolos.

—Su senda se llama Vael Khur, la Quietud Blanca. Congela procesos. Una tormenta. Una vida. A veces, una época entera.

Un escalofrío le recorrió el cuerpo.

Si el informe era correcto, la criatura había gobernado el hielo de Valnevar desde el interior de su prisión. Había creado sirvientes. Había extendido la tormenta. Había usado la fractura para empujar contra sus muros.

Aurel no dijo lo que eso sugería.

Sólo volvió a leer la descripción de los colmillos, del muro de hielo y del portal abierto junto a la criatura.

—Tenemos que encontrar a esos soldados —dijo.

—¿Para premiarlos?

—Para preguntarles qué fue lo que vieron. Y qué estaba intentando abrirse.

Lysa miró hacia el agujero bajo el estante, donde la rata había desaparecido con el sello.

—Cronista, antes de enviar gente a Herbolago… ¿qué hacemos con las ratas de Prontera?

Aurel suspiró.

Bajo la ciudad, las alcantarillas ya no eran sólo alcantarillas. Había nidos demasiado grandes, mordidas en tuberías de brumante y animales que aprendían a no caer dos veces en la misma trampa. Nadie hablaba aún de mutaciones. Nadie quería ser el primero.

—Manda otra cuadrilla —dijo.

—La última volvió sin botas.

—Entonces manda una cuadrilla con botas mejores.

Lysa anotó la orden.`.split('\n\n');

export default function Chronicles() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const canShare = user?.role === 'DM' || user?.role === 'ADMIN';
  return pathname.replace(/\/$/, '') === CHRONICLE_PATH ? <ChronicleReader canShare={canShare} /> : <ChronicleArchive />;
}

function ChronicleArchive() {
  return <section className="chronicle-archive">
    <header className="chronicle-archive-header"><div><p className="section-kicker">Archivo central · Prontera</p><h1 className="section-title">Crónicas</h1><p className="section-lead">Relatos preservados de los sucesos que han dejado una marca en el mundo.</p></div><div className="chronicle-archive-count"><Scroll size={17} /><span>01</span><small>registro</small></div></header>
    <div className="chronicle-archive-rule" />
    <div className="chronicle-grid"><Link to={CHRONICLE_PATH} className="chronicle-card">
      <div className="chronicle-card-image"><img src="/chronicles/informes-de-herbolago.png" alt="Aurel Venn y Lysa Marek revisando informes en el Archivo Central" /><span className="chronicle-card-number">01.</span></div>
      <div className="chronicle-card-body"><p className="chronicle-card-kicker">Registro del Archivo Central</p><h2>Informes de Herbolago</h2><p className="chronicle-card-excerpt">La guerra dejó de rugir en los campos: ahora avanza en silencio bajo las ruinas del mundo.</p><div className="chronicle-card-meta"><span><MapPin size={13} />Prontera, Westamar</span><span><CalendarDays size={13} />Día 127 · Año 203 d.F.</span></div><span className="chronicle-read-link">Abrir crónica <BookOpen size={14} /></span></div>
    </Link></div>
  </section>;
}

function ChronicleReader({ canShare }) {
  const [shareNotice, setShareNotice] = useState('');
  const [isSharing, setIsSharing] = useState(false);
  const shareChronicle = async () => {
    const url = window.location.href;
    const title = 'Informes de Herbolago';
    const text = 'La guerra dejó de rugir en los campos: ahora avanza en silencio bajo las ruinas del mundo.';
    const shareData = { title, text, url };
    setIsSharing(true);
    setShareNotice('');
    try {
      let imageFile = null;
      const imageResponse = await fetch('/chronicles/informes-de-herbolago.png');
      if (imageResponse.ok) {
        const imageBlob = await imageResponse.blob();
        imageFile = new File([imageBlob], 'informes-de-herbolago.png', { type: imageBlob.type || 'image/png' });
      }
      if (imageFile && navigator.canShare?.({ files: [imageFile] })) {
        await navigator.share({ ...shareData, files: [imageFile] });
        setShareNotice('Imagen y enlace listos para compartir.');
      } else if (navigator.share) {
        await navigator.share(shareData);
        setShareNotice('Enlace listo para compartir.');
      } else {
        window.open(`https://wa.me/?text=${encodeURIComponent(`${title}\n${text}\n${url}`)}`, '_blank', 'noopener,noreferrer');
        setShareNotice('Se abrió WhatsApp con el enlace.');
      }
    } catch (error) {
      if (error?.name !== 'AbortError') setShareNotice('No se pudo abrir el menú para compartir.');
    } finally { setIsSharing(false); }
  };
  return <article className="chronicle-reader">
    <header className="chronicle-reader-bar"><Link className="chronicle-back" to="/chronicles"><ArrowLeft size={16} /> Volver a Crónicas</Link><p>Archivo Central · Prontera</p>{canShare ? <div className="chronicle-reader-share"><button type="button" onClick={shareChronicle} disabled={isSharing}><Share2 size={14} />{isSharing ? 'Preparando…' : 'Compartir'}</button>{shareNotice && <small aria-live="polite">{shareNotice}</small>}</div> : <span>Registro 01</span>}</header>
    <main className="chronicle-book"><section className="chronicle-page chronicle-page-story">
      <div className="chronicle-page-head"><span>01.</span><div><small>Archivo Central · Prontera</small><small>Año 203 d.F. · Día 127</small></div></div>
      <h1>Informes de Herbolago</h1><div className="chronicle-flourish">✦</div>
      <p className="chronicle-dek">La guerra dejó de rugir en los campos:<br />ahora avanza en silencio bajo las ruinas del mundo.</p>
      <div className="chronicle-prose">{story.map((paragraph, index) => <p key={`${index}-${paragraph.slice(0, 12)}`} className={`${index === 0 ? 'chronicle-dropcap ' : ''}${paragraph.startsWith('El mago de pelotón cerró') ? 'chronicle-quoted-line' : ''}`}>{paragraph}</p>)}</div>
      <figure className="chronicle-illustration chronicle-feature-illustration"><img src="/chronicles/informes-de-herbolago.png" alt="Aurel y Lysa revisando los informes de Herbolago" /><figcaption>Aurel Venn y Lysa Marek revisando los informes en el Archivo Central de Prontera.</figcaption></figure>
    </section></main>
  </article>;
}
