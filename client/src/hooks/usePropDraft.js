import { useCallback, useState } from 'react';

// Keep local edits until the authoritative prop changes. Reset during render so
// children never see a stale draft for a new source, rather than in an effect.
export function usePropDraft(source) {
  const [draft, setDraft] = useState(() => ({ source, value: source }));
  if (!Object.is(draft.source, source)) {
    setDraft({ source, value: source });
  }
  const setValue = useCallback(next => {
    setDraft(current => {
      const previous = Object.is(current.source, source) ? current.value : source;
      return { source, value: typeof next === 'function' ? next(previous) : next };
    });
  }, [source]);
  return [Object.is(draft.source, source) ? draft.value : source, setValue];
}
