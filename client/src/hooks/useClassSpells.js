import { useEffect, useState } from 'react';

const EMPTY_SPELLS = [];

export function useClassSpells(socket, classNames) {
  const requestKey = JSON.stringify(classNames);
  const [result, setResult] = useState(null);
  useEffect(() => {
    const names = JSON.parse(requestKey);
    if (!socket || names.length === 0) return undefined;
    let active = true;
    const handle = spells => {
      if (!active) return;
      setResult({ socket, requestKey, spells: [...spells].sort((a, b) => a.level - b.level || a.name.localeCompare(b.name)) });
    };
    socket.on('class-spells-result', handle);
    socket.emit('get-class-spells', { class_names: names });
    return () => {
      active = false;
      socket.off('class-spells-result', handle);
    };
  }, [socket, requestKey]);
  const current = result?.socket === socket && result?.requestKey === requestKey;
  const requested = Boolean(socket) && classNames.length > 0;
  return {
    spells: requested && current ? result.spells : EMPTY_SPELLS,
    loading: requested && !current,
  };
}
