import API_URL from '../../config';

function mediaUrl(value) {
  if (!value || /^(?:https?:|data:|blob:)/i.test(value)) return value;
  return `${API_URL}${value.startsWith('/') ? value : `/${value}`}`;
}

function reactionCopy(notice) {
  const reaction = notice.reaction || {};
  const save = reaction.save;
  if (!save) {
    const succeeded = notice.attack?.hit === false || reaction.effect !== 'AC_BONUS';
    return {
      succeeded,
      title: succeeded ? 'Reacción exitosa' : 'Reacción sin efecto',
      detail: notice.summary || `${reaction.name} fue resuelta.`,
    };
  }

  const succeeded = save.success === false;
  const targetName = reaction.targetName || notice.actor_name || 'El atacante';
  const rollText = `${save.total} contra CD ${save.dc}`;
  const consequences = [];
  if (reaction.pushFeet) consequences.push(`es empujado ${reaction.pushFeet} pies`);
  if (reaction.condition) consequences.push(`queda ${String(reaction.condition).toLowerCase()}`);
  return {
    succeeded,
    title: succeeded ? 'Reacción exitosa' : 'Reacción sin efecto',
    detail: succeeded
      ? `${reaction.name}: ${targetName} falla la salvación ${save.ability} (${rollText}); ${consequences.join(' y ') || 'sufre el efecto de la reacción'}.`
      : `${reaction.name}: ${targetName} supera la salvación ${save.ability} (${rollText}) y evita sus efectos.`,
  };
}

export default function CombatResultPrompt({ notice, canRollDamage, onRollDamage, onDismiss, showActor = false }) {
  if (!notice) return null;
  const isReaction = Boolean(notice.reaction?.name && !notice.reaction?.passed && !notice.reaction?.savePending);
  const isEnemy = isReaction ? notice.reaction?.reactorIsNpc !== false : Boolean(notice.actor_is_npc);
  const hit = notice.attack?.hit !== false;
  const reaction = isReaction ? reactionCopy(notice) : null;
  const className = isReaction
    ? `game-combat-result-prompt is-reaction${reaction.succeeded ? ' is-reaction-success' : ' is-reaction-no-effect'}`
    : `game-combat-result-prompt${isEnemy ? ' is-enemy' : ''}${hit ? ' is-success' : ' is-failure'}`;

  return (
    <div className={className} role="dialog" aria-live="assertive">
      <div>
        {isReaction ? (
          <>
            <div className="game-combat-reaction-identity">
              <div className="game-combat-reaction-avatar">
                {notice.reaction.reactorImage
                  ? <img src={mediaUrl(notice.reaction.reactorImage)} alt="" />
                  : <span>{notice.reaction.reactorName?.slice(0, 1) || '?'}</span>}
              </div>
              <div><small>Reacción enemiga</small><strong>{notice.reaction.reactorName || 'Enemigo'}</strong></div>
            </div>
            <span>{notice.reaction.reactorName || 'El enemigo'} usa {notice.reaction.name}</span>
            <h2>{reaction.title}</h2>
            <p>{reaction.detail}</p>
          </>
        ) : (
          <>
            {isEnemy && (
              <div className="game-combat-reaction-identity">
                <div className="game-combat-reaction-avatar">
                  {notice.actor_image
                    ? <img src={mediaUrl(notice.actor_image)} alt="" />
                    : <span>{notice.actor_name?.slice(0, 1) || '?'}</span>}
                </div>
                <div><small>Acción enemiga</small><strong>{notice.actor_name || 'Enemigo'}</strong></div>
              </div>
            )}
            <span>{notice.reaction?.passed ? 'La reacción se deja pasar' : hit ? 'Impacto confirmado' : 'El ataque no impacta'}</span>
            <h2>{hit ? '¡Éxito!' : 'Fallo'}</h2>
            <p>{showActor ? `${notice.actor_name} · ` : ''}{notice.action_name}{notice.attack ? ` · ${notice.attack.total} contra CA ${notice.attack.targetAc}` : ''}</p>
          </>
        )}
        {canRollDamage ? (
          <button onClick={() => onRollDamage(notice)}>Tirar daño ({notice.damage_formula || 'daño'})</button>
        ) : (
          <button onClick={() => onDismiss(notice)}>Continuar</button>
        )}
      </div>
    </div>
  );
}
