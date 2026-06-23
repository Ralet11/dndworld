import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Flame,
  Languages,
  Minus,
  Plus,
  Scroll,
  Search,
  X,
} from 'lucide-react';
import { useSocket } from '../../context/SocketContext';

const DEFAULT_COLLAPSED_GROUPS = {
  0: true,
  1: true,
  2: true,
  3: true,
  4: true,
  5: true,
  6: true,
  7: true,
  8: true,
  9: true,
};

const getSpellCastingType = (classSlug) => {
  const slug = classSlug?.toLowerCase() || '';
  if (slug.includes('wizard') || slug.includes('mago')) return 'wizard';
  if (slug.includes('cleric') || slug.includes('druid') || slug.includes('paladin') || slug.includes('clerigo')) {
    return 'divine';
  }
  return 'known';
};

const sortSpells = (spells) => [...(spells || [])].sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));

const getSlotUsed = (slotData) => {
  if (typeof slotData === 'number') return slotData;
  if (!slotData || typeof slotData !== 'object') return 0;
  if (typeof slotData.used === 'number') return slotData.used;
  if (typeof slotData.total === 'number' && typeof slotData.remaining === 'number') {
    return Math.max(0, slotData.total - slotData.remaining);
  }
  if (typeof slotData.max === 'number' && typeof slotData.remaining === 'number') {
    return Math.max(0, slotData.max - slotData.remaining);
  }
  return 0;
};

const getSlotMax = (slotData) => {
  if (!slotData || typeof slotData !== 'object') return null;
  if (typeof slotData.max === 'number') return slotData.max;
  if (typeof slotData.total === 'number') return slotData.total;
  return null;
};

const buildUpdatedSlot = (slotData, nextUsed) => {
  if (typeof slotData === 'number') return nextUsed;
  const next = { ...(slotData || {}) };
  next.used = nextUsed;

  if (typeof next.total === 'number') {
    next.remaining = Math.max(0, next.total - nextUsed);
  } else if (typeof next.max === 'number' && typeof next.remaining === 'number') {
    next.remaining = Math.max(0, next.max - nextUsed);
  }

  return next;
};

export default function SpellsManager({ character }) {
  const { socket } = useSocket();
  const casterType = useMemo(
    () => getSpellCastingType(character.class_slug || character.class),
    [character.class_slug, character.class],
  );

  const classNames = useMemo(() => {
    if (character.classes?.length) {
      return character.classes.map((entry) => entry.slug).filter(Boolean);
    }
    if (character.class_slug) return [character.class_slug];
    if (character.class) return [character.class];
    return [];
  }, [character.classes, character.class_slug, character.class]);

  const [activeTab, setActiveTab] = useState('book');
  const [classSpells, setClassSpells] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpell, setSelectedSpell] = useState(null);
  const [showTranslation, setShowTranslation] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [isSwitchingTab, setIsSwitchingTab] = useState(false);
  const [slots, setSlots] = useState(character.spell_slots || {});
  const [collapsedGroups, setCollapsedGroups] = useState(DEFAULT_COLLAPSED_GROUPS);
  const activeSpellRef = useRef(null);

  useEffect(() => {
    if (casterType === 'divine') setActiveTab('prepared');
    else setActiveTab('book');
  }, [casterType]);

  useEffect(() => {
    setSlots(character.spell_slots || {});
  }, [character.spell_slots]);

  useEffect(() => {
    if (!socket) return;
    if (!classNames.length) {
      setClassSpells([]);
      setIsFetching(false);
      return;
    }

    setIsFetching(true);
    const handleSpells = (spells) => {
      setClassSpells(sortSpells(spells));
      setIsFetching(false);
    };

    socket.on('class-spells-result', handleSpells);
    socket.emit('get-class-spells', { class_names: classNames });

    return () => {
      socket.off('class-spells-result', handleSpells);
    };
  }, [socket, classNames]);

  useEffect(() => {
    if (!socket) return;

    const handleDetails = (fullSpell) => {
      if (activeSpellRef.current?.slug === fullSpell.slug) {
        setSelectedSpell(fullSpell);
      }
    };

    socket.on('spell-details-result', handleDetails);
    return () => {
      socket.off('spell-details-result', handleDetails);
    };
  }, [socket]);

  useEffect(() => {
    if (!socket) return;

    const onTranslated = ({ slug, translation }) => {
      if (activeSpellRef.current?.slug === slug) {
        setSelectedSpell((previous) => (
          previous && previous.slug === slug ? { ...previous, translation } : previous
        ));
        setShowTranslation(true);
      }
      setTranslating(false);
    };

    const onTranslateError = ({ message }) => {
      setTranslating(false);
      if (message) window.alert(message);
    };

    socket.on('spell-translated', onTranslated);
    socket.on('spell-translate-error', onTranslateError);

    return () => {
      socket.off('spell-translated', onTranslated);
      socket.off('spell-translate-error', onTranslateError);
    };
  }, [socket]);

  const knownSlugs = useMemo(() => character.spells_known || [], [character.spells_known]);
  const preparedSlugs = useMemo(() => character.spells_prepared || [], [character.spells_prepared]);

  const groupedSpells = useMemo(() => {
    const filtered = classSpells.filter((spell) => {
      const isKnown = knownSlugs.includes(spell.slug);
      const isPrepared = preparedSlugs.includes(spell.slug);

      if (activeTab === 'book' && !isKnown) return false;
      if (activeTab === 'prepared' && !isPrepared) return false;

      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      const englishName = (spell.name || '').toLowerCase();
      const translatedName = (spell.translation?.name || '').toLowerCase();
      return englishName.includes(query) || translatedName.includes(query);
    });

    const groups = {};
    filtered.forEach((spell) => {
      if (!groups[spell.level]) groups[spell.level] = [];
      groups[spell.level].push(spell);
    });

    return groups;
  }, [activeTab, classSpells, knownSlugs, preparedSlugs, searchQuery]);

  const closeSpellDetail = () => {
    activeSpellRef.current = null;
    setSelectedSpell(null);
    setShowTranslation(false);
    setTranslating(false);
  };

  const handleTabChange = (nextTab) => {
    if (nextTab === activeTab) return;
    setIsSwitchingTab(true);
    window.setTimeout(() => {
      setActiveTab(nextTab);
      setIsSwitchingTab(false);
    }, 10);
  };

  const updateChar = (field, value) => {
    if (!socket) return;
    socket.emit('update-character-full', {
      characterId: character.id,
      diff: { [field]: value },
    });
  };

  const toggleKnown = (slug) => {
    const next = knownSlugs.includes(slug)
      ? knownSlugs.filter((entry) => entry !== slug)
      : [...knownSlugs, slug];
    updateChar('spells_known', next);
  };

  const togglePrepared = (slug) => {
    const next = preparedSlugs.includes(slug)
      ? preparedSlugs.filter((entry) => entry !== slug)
      : [...preparedSlugs, slug];
    updateChar('spells_prepared', next);
  };

  const updateSlots = (level, change) => {
    const slotKey = String(level);
    const currentSlots = { ...(slots || {}) };
    const previousSlot = currentSlots[slotKey] ?? currentSlots[level] ?? { max: 0, used: 0 };
    const previousUsed = getSlotUsed(previousSlot);
    const slotMax = getSlotMax(previousSlot);
    const unclamped = previousUsed + change;
    const nextUsed = slotMax == null
      ? Math.max(0, unclamped)
      : Math.max(0, Math.min(slotMax, unclamped));

    const nextSlots = {
      ...currentSlots,
      [slotKey]: buildUpdatedSlot(previousSlot, nextUsed),
    };

    setSlots(nextSlots);
    updateChar('spell_slots', nextSlots);
  };

  const toggleGroup = (level) => {
    setCollapsedGroups((previous) => ({ ...previous, [level]: !previous[level] }));
  };

  const openSpellDetail = (spell) => {
    setSelectedSpell(spell);
    activeSpellRef.current = spell;
    setShowTranslation(false);
    setTranslating(false);

    if (!spell.desc && socket) {
      socket.emit('get-spell-details', { slug: spell.slug });
    }
  };

  const handleTranslate = () => {
    if (!selectedSpell || !socket) return;
    if (selectedSpell.translation?.desc) {
      setShowTranslation((previous) => !previous);
      return;
    }
    setTranslating(true);
    socket.emit('translate-spell', { slug: selectedSpell.slug });
  };

  const translatedName = selectedSpell?.translation?.name || selectedSpell?.name;
  const translatedDesc = showTranslation && selectedSpell?.translation?.desc
    ? selectedSpell.translation.desc
    : selectedSpell?.desc;
  const translatedHigherLevel = showTranslation && selectedSpell?.translation?.higher_level
    ? selectedSpell.translation.higher_level
    : selectedSpell?.higher_level;

  const isEmpty = Object.values(groupedSpells).every((group) => !group || group.length === 0);

  const renderActionButton = (spell) => {
    const isKnown = knownSlugs.includes(spell.slug);
    const isPrepared = preparedSlugs.includes(spell.slug);

    if (casterType === 'known') {
      if (activeTab === 'library') {
        return (
          <button
            onClick={(event) => {
              event.stopPropagation();
              toggleKnown(spell.slug);
            }}
            style={isKnown ? styles.actionButtonKnown : styles.actionButtonAdd}
          >
            {isKnown ? <Check size={16} /> : <Plus size={16} />}
          </button>
        );
      }
      return (
        <button
          onClick={(event) => {
            event.stopPropagation();
            toggleKnown(spell.slug);
          }}
          style={styles.actionButtonRemoveKnown}
        >
          <X size={16} />
        </button>
      );
    }

    if (casterType === 'divine') {
      if (activeTab === 'library') {
        return (
          <button
            onClick={(event) => {
              event.stopPropagation();
              togglePrepared(spell.slug);
            }}
            style={isPrepared ? styles.actionButtonPrepared : styles.actionButtonAdd}
          >
            {isPrepared ? <Flame size={16} /> : <Plus size={16} />}
          </button>
        );
      }
      return (
        <button
          onClick={(event) => {
            event.stopPropagation();
            togglePrepared(spell.slug);
          }}
          style={styles.actionButtonRemovePrepared}
        >
          <X size={16} />
        </button>
      );
    }

    if (activeTab === 'library') {
      return (
        <button
          onClick={(event) => {
            event.stopPropagation();
            toggleKnown(spell.slug);
          }}
          style={isKnown ? styles.actionButtonKnown : styles.actionButtonAdd}
        >
          {isKnown ? <Scroll size={16} /> : <Plus size={16} />}
        </button>
      );
    }

    if (activeTab === 'book') {
      return (
        <button
          onClick={(event) => {
            event.stopPropagation();
            togglePrepared(spell.slug);
          }}
          style={isPrepared ? styles.actionButtonPreparedDark : styles.actionButtonAdd}
        >
          <Flame size={16} />
        </button>
      );
    }

    return (
      <button
        onClick={(event) => {
          event.stopPropagation();
          togglePrepared(spell.slug);
        }}
        style={styles.actionButtonRemovePrepared}
      >
        <X size={16} />
      </button>
    );
  };

  const renderTabLabel = (tabId) => {
    if (tabId === 'book') return casterType === 'wizard' ? 'Libro' : 'Conocidos';
    if (tabId === 'prepared') return 'Preparados';
    if (casterType === 'wizard') return 'Arcanos';
    if (casterType === 'divine') return 'Divinos';
    return 'Clase';
  };

  return (
    <div style={styles.container}>
      <div style={styles.topSection}>
        <p style={styles.headerTitle}>Gestion de Magia ({casterType.toUpperCase()})</p>

        <div style={styles.slotScroller}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((level) => {
            const slotData = slots?.[level] ?? slots?.[String(level)] ?? { used: 0 };
            return (
              <div key={level} style={styles.slotBadge}>
                <span style={styles.slotLevel}>Lvl {level}</span>
                <div style={styles.slotControls}>
                  <button onClick={() => updateSlots(level, -1)} style={styles.slotButton}>
                    <Minus size={14} />
                  </button>
                  <span
                    style={{
                      ...styles.slotValue,
                      color: getSlotUsed(slotData) > 0 ? '#E06A9A' : '#EDE6D8',
                    }}
                  >
                    {getSlotUsed(slotData)}
                  </span>
                  <button onClick={() => updateSlots(level, 1)} style={styles.slotButton}>
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={styles.tabs}>
        {casterType !== 'divine' && (
          <button
            onClick={() => handleTabChange('book')}
            style={activeTab === 'book' ? styles.activeTab : styles.tab}
          >
            <BookOpen size={16} />
            {renderTabLabel('book')}
          </button>
        )}

        {casterType !== 'known' && (
          <button
            onClick={() => handleTabChange('prepared')}
            style={activeTab === 'prepared' ? styles.activeTab : styles.tab}
          >
            <Flame size={16} />
            {renderTabLabel('prepared')}
          </button>
        )}

        <button
          onClick={() => handleTabChange('library')}
          style={activeTab === 'library' ? styles.activeTab : styles.tab}
        >
          <Search size={16} />
          {renderTabLabel('library')}
        </button>
      </div>

      <div style={styles.searchBar}>
        <Search size={16} style={{ color: '#6B6557' }} />
        <input
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Buscar hechizo..."
          className="input-base"
          style={styles.searchInput}
        />
      </div>

      {(isFetching || isSwitchingTab) ? (
        <div style={styles.loadingState}>
          <div className="animate-spin" style={styles.spinner} />
          <p style={styles.loadingText}>
            {isFetching ? 'Cargando grimorio...' : 'Cargando hechizos...'}
          </p>
        </div>
      ) : (
        <div style={styles.groupsWrap}>
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((level) => {
            const spells = groupedSpells[level] || [];
            if (!spells.length) return null;

            const isCollapsed = !!collapsedGroups[level];
            return (
              <div
                key={level}
                style={isCollapsed ? styles.levelGroup : styles.levelGroupOpen}
              >
                <button onClick={() => toggleGroup(level)} style={styles.groupHeader}>
                  <div style={styles.groupHeaderLeft}>
                    {isCollapsed
                      ? <ChevronRight size={18} style={{ color: '#6B6557' }} />
                      : <ChevronDown size={18} style={{ color: '#3E84D6' }} />}
                    <span style={isCollapsed ? styles.groupTitle : styles.groupTitleOpen}>
                      {level === 0 ? 'Trucos' : `Nivel ${level}`}
                    </span>
                  </div>
                  <span style={styles.groupBadge}>{spells.length}</span>
                </button>

                {!isCollapsed && (
                  <div style={styles.groupBody}>
                    {spells.map((spell) => {
                      const isActive = knownSlugs.includes(spell.slug) || preparedSlugs.includes(spell.slug);
                      return (
                        <button
                          key={spell.slug}
                          onClick={() => openSpellDetail(spell)}
                          style={isActive ? styles.spellRowActive : styles.spellRow}
                        >
                          <div style={styles.spellInfo}>
                            <span
                              style={{
                                ...styles.spellName,
                                color: activeTab === 'library' && isActive ? '#3E84D6' : '#EDE6D8',
                              }}
                            >
                              {spell.translation?.name || spell.name}
                            </span>
                            <span style={styles.spellSchool}>
                              {spell.school}
                              {spell.ritual === 'yes' ? ' • Ritual' : ''}
                              {spell.concentration === 'yes' ? ' • Conc.' : ''}
                            </span>
                            <div style={styles.spellStatsRow}>
                              <div style={styles.spellStatItem}>
                                <span style={styles.spellStatLabel}>TIEMPO</span>
                                <span style={styles.spellStatValue}>{spell.casting_time || '—'}</span>
                              </div>
                              <div style={styles.spellStatItem}>
                                <span style={styles.spellStatLabel}>ALCANCE</span>
                                <span style={styles.spellStatValue}>{spell.range || '—'}</span>
                              </div>
                              <div style={styles.spellStatItem}>
                                <span style={styles.spellStatLabel}>DURACION</span>
                                <span style={styles.spellStatValue}>{spell.duration || '—'}</span>
                              </div>
                            </div>
                          </div>
                          <div style={styles.spellAction}>{renderActionButton(spell)}</div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {isEmpty && (
            <p style={styles.emptyState}>
              {activeTab === 'library'
                ? 'No se encontraron hechizos.'
                : activeTab === 'book'
                  ? 'Grimorio vacio.'
                  : 'Ningun hechizo preparado.'}
            </p>
          )}
        </div>
      )}

      {selectedSpell && (
        <div style={styles.modalOverlay} onClick={closeSpellDetail}>
          <div style={styles.modalCard} onClick={(event) => event.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={{ flex: 1 }}>
                <h3 style={styles.modalTitle}>{translatedName}</h3>
                <p style={styles.modalSubtitle}>
                  {selectedSpell.level === 0 ? 'Truco' : `Nivel ${selectedSpell.level}`} • {selectedSpell.school}
                </p>
              </div>
              <button onClick={closeSpellDetail} style={styles.modalCloseButton}>
                <X size={22} />
              </button>
            </div>

            <button
              onClick={handleTranslate}
              disabled={translating}
              style={styles.translateButton}
            >
              {translating ? <div className="animate-spin" style={styles.translateSpinner} /> : <Languages size={15} />}
              <span>
                {translating
                  ? 'Traduciendo...'
                  : selectedSpell.translation?.desc
                    ? (showTranslation ? 'Ver original (ingles)' : 'Ver en espanol')
                    : 'Traducir al espanol'}
              </span>
            </button>

            <div style={styles.modalScroll}>
              <div style={styles.modalStatsGrid}>
                <div style={styles.modalStatBox}>
                  <span style={styles.modalStatLabel}>TIEMPO</span>
                  <span style={styles.modalStatValue}>{selectedSpell.casting_time || '—'}</span>
                </div>
                <div style={styles.modalStatBox}>
                  <span style={styles.modalStatLabel}>ALCANCE</span>
                  <span style={styles.modalStatValue}>{selectedSpell.range || '—'}</span>
                </div>
                <div style={styles.modalStatBox}>
                  <span style={styles.modalStatLabel}>DURACION</span>
                  <span style={styles.modalStatValue}>{selectedSpell.duration || '—'}</span>
                </div>
                <div style={styles.modalStatBox}>
                  <span style={styles.modalStatLabel}>COMPONENTES</span>
                  <span style={styles.modalStatValue}>{selectedSpell.components || '—'}</span>
                </div>
              </div>

              {selectedSpell.material && (
                <p style={styles.materialText}>
                  <strong>Material:</strong> {selectedSpell.material}
                </p>
              )}

              <div style={styles.modalDivider} />

              {translatedDesc ? (
                <p style={styles.modalDescription}>{translatedDesc}</p>
              ) : (
                <p style={styles.modalDescriptionMuted}>Cargando descripcion detallada...</p>
              )}

              {translatedHigherLevel && (
                <div style={styles.higherLevelBox}>
                  <p style={styles.higherLevelTitle}>A niveles superiores</p>
                  <p style={styles.higherLevelText}>{translatedHigherLevel}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const sharedButton = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  border: 'none',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
};

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  topSection: {
    padding: 16,
    borderRadius: 16,
    background: '#16211F',
    border: '1px solid #2A332F',
  },
  headerTitle: {
    color: '#EDE6D8',
    fontSize: 18,
    fontWeight: 900,
    marginBottom: 12,
    textTransform: 'capitalize',
  },
  slotScroller: {
    display: 'flex',
    gap: 8,
    overflowX: 'auto',
    paddingBottom: 4,
  },
  slotBadge: {
    minWidth: 72,
    padding: 10,
    borderRadius: 12,
    background: '#1E2A28',
    border: '1px solid #2A332F',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
  },
  slotLevel: {
    color: '#6B6557',
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
  },
  slotControls: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  slotButton: {
    ...sharedButton,
    padding: 0,
    width: 20,
    height: 20,
    borderRadius: 999,
    background: 'transparent',
    color: '#A89F8E',
  },
  slotValue: {
    minWidth: 18,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 800,
  },
  tabs: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  },
  tab: {
    ...sharedButton,
    padding: '10px 14px',
    borderRadius: 12,
    background: '#1E2A28',
    border: '1px solid #2A332F',
    color: '#A89F8E',
    fontSize: 12,
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  activeTab: {
    ...sharedButton,
    padding: '10px 14px',
    borderRadius: 12,
    background: 'rgba(62,132,214,0.12)',
    border: '1px solid rgba(62,132,214,0.35)',
    color: '#3E84D6',
    fontSize: 12,
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  searchBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '0 14px',
    height: 46,
    borderRadius: 12,
    background: '#16211F',
    border: '1px solid #2A332F',
  },
  searchInput: {
    background: 'transparent',
    border: 'none',
    padding: 0,
  },
  loadingState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 0',
    gap: 12,
  },
  spinner: {
    width: 28,
    height: 28,
    borderRadius: 999,
    border: '2px solid #3E84D6',
    borderTopColor: 'transparent',
  },
  loadingText: {
    color: '#6B6557',
    fontSize: 14,
  },
  groupsWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    paddingBottom: 32,
  },
  levelGroup: {
    borderRadius: 16,
    overflow: 'hidden',
    background: '#16211F',
    border: '1px solid #2A332F',
    borderLeft: '3px solid #2A332F',
  },
  levelGroupOpen: {
    borderRadius: 16,
    overflow: 'hidden',
    background: '#16211F',
    border: '1px solid rgba(62,132,214,0.35)',
    borderLeft: '3px solid #3E84D6',
  },
  groupHeader: {
    ...sharedButton,
    width: '100%',
    padding: '14px 16px',
    background: 'transparent',
    justifyContent: 'space-between',
    color: '#EDE6D8',
  },
  groupHeaderLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  groupTitle: {
    color: '#EDE6D8',
    fontSize: 14,
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  groupTitleOpen: {
    color: '#3E84D6',
    fontSize: 14,
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  groupBadge: {
    minWidth: 26,
    height: 22,
    padding: '0 7px',
    borderRadius: 999,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(62,132,214,0.15)',
    border: '1px solid rgba(62,132,214,0.35)',
    color: '#3E84D6',
    fontSize: 12,
    fontWeight: 800,
  },
  groupBody: {
    borderTop: '1px solid #2A332F',
  },
  spellRow: {
    ...sharedButton,
    width: '100%',
    padding: '14px 16px',
    background: 'transparent',
    justifyContent: 'space-between',
    alignItems: 'stretch',
    color: '#EDE6D8',
    borderBottom: '1px solid rgba(42,51,47,0.6)',
  },
  spellRowActive: {
    ...sharedButton,
    width: '100%',
    padding: '14px 16px',
    background: 'rgba(255,255,255,0.02)',
    justifyContent: 'space-between',
    alignItems: 'stretch',
    color: '#EDE6D8',
    borderBottom: '1px solid rgba(42,51,47,0.6)',
  },
  spellInfo: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 4,
    flex: 1,
    minWidth: 0,
  },
  spellName: {
    fontSize: 15,
    fontWeight: 800,
    textAlign: 'left',
  },
  spellSchool: {
    color: '#6B6557',
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'left',
  },
  spellStatsRow: {
    display: 'flex',
    width: '100%',
    gap: 12,
    flexWrap: 'wrap',
  },
  spellStatItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    minWidth: 90,
  },
  spellStatLabel: {
    color: '#6B6557',
    fontSize: 10,
    fontWeight: 800,
  },
  spellStatValue: {
    color: '#A89F8E',
    fontSize: 11,
    textAlign: 'left',
  },
  spellAction: {
    marginLeft: 12,
    display: 'flex',
    alignItems: 'center',
  },
  actionButtonAdd: {
    ...sharedButton,
    width: 36,
    height: 36,
    borderRadius: 10,
    background: '#1E2A28',
    color: '#A89F8E',
  },
  actionButtonKnown: {
    ...sharedButton,
    width: 36,
    height: 36,
    borderRadius: 10,
    background: '#3E84D6',
    color: '#EDE6D8',
  },
  actionButtonPrepared: {
    ...sharedButton,
    width: 36,
    height: 36,
    borderRadius: 10,
    background: '#F59E0B',
    color: '#EDE6D8',
  },
  actionButtonPreparedDark: {
    ...sharedButton,
    width: 36,
    height: 36,
    borderRadius: 10,
    background: '#F59E0B',
    color: '#0F1518',
  },
  actionButtonRemoveKnown: {
    ...sharedButton,
    width: 36,
    height: 36,
    borderRadius: 10,
    background: '#1E2A28',
    color: '#C2452F',
  },
  actionButtonRemovePrepared: {
    ...sharedButton,
    width: 36,
    height: 36,
    borderRadius: 10,
    background: '#1E2A28',
    color: '#F59E0B',
  },
  emptyState: {
    textAlign: 'center',
    color: '#6B6557',
    fontStyle: 'italic',
    paddingTop: 20,
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 90,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    padding: 16,
    background: 'rgba(0,0,0,0.8)',
    backdropFilter: 'blur(8px)',
  },
  modalCard: {
    width: '100%',
    maxWidth: 760,
    maxHeight: '85vh',
    borderRadius: 24,
    background: '#16211F',
    border: '1px solid #2A332F',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    padding: 24,
    paddingBottom: 18,
  },
  modalTitle: {
    color: '#EDE6D8',
    fontSize: 24,
    fontWeight: 900,
    lineHeight: 1.1,
  },
  modalSubtitle: {
    color: '#3E84D6',
    fontSize: 14,
    fontWeight: 700,
    marginTop: 4,
  },
  modalCloseButton: {
    ...sharedButton,
    width: 40,
    height: 40,
    borderRadius: 999,
    background: '#1E2A28',
    color: '#A89F8E',
    flexShrink: 0,
  },
  translateButton: {
    ...sharedButton,
    alignSelf: 'stretch',
    margin: '0 24px 18px',
    minHeight: 42,
    borderRadius: 12,
    background: '#1E2A28',
    border: '1px solid #8A6A3B',
    color: '#F59E0B',
    fontSize: 13,
    fontWeight: 700,
  },
  translateSpinner: {
    width: 16,
    height: 16,
    borderRadius: 999,
    border: '2px solid #F59E0B',
    borderTopColor: 'transparent',
  },
  modalScroll: {
    overflowY: 'auto',
    padding: '0 24px 28px',
  },
  modalStatsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: 8,
  },
  modalStatBox: {
    background: '#1E2A28',
    borderRadius: 12,
    padding: 12,
  },
  modalStatLabel: {
    display: 'block',
    color: '#6B6557',
    fontSize: 10,
    fontWeight: 800,
    marginBottom: 4,
  },
  modalStatValue: {
    color: '#A89F8E',
    fontSize: 13,
    fontWeight: 500,
  },
  materialText: {
    color: '#A89F8E',
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 1.5,
    marginTop: 14,
  },
  modalDivider: {
    height: 1,
    background: '#2A332F',
    margin: '16px 0',
  },
  modalDescription: {
    color: '#EDE6D8',
    fontSize: 15,
    lineHeight: 1.6,
    whiteSpace: 'pre-wrap',
  },
  modalDescriptionMuted: {
    color: '#6B6557',
    fontSize: 15,
    lineHeight: 1.6,
    fontStyle: 'italic',
  },
  higherLevelBox: {
    marginTop: 20,
    padding: 16,
    borderRadius: 12,
    background: 'rgba(58,90,140,0.1)',
    borderLeft: '3px solid #3E84D6',
  },
  higherLevelTitle: {
    color: '#3E84D6',
    fontWeight: 800,
    marginBottom: 4,
  },
  higherLevelText: {
    color: '#A89F8E',
    fontSize: 14,
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap',
  },
};
