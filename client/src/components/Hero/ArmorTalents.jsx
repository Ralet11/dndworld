import { useState } from 'react';
import { ChevronDown, ChevronRight, Lock, Sparkles } from 'lucide-react';
import { useSocket } from '../../context/SocketContext';
import { DOTE_TREES } from './doteTrees';

const TREE_COLOR = {
  agilidad: '#5BA86B',
  aguante: '#C2452F',
  espiritu: '#3E84D6',
};

export default function ArmorTalents({ character }) {
  const { socket } = useSocket();
  const [open, setOpen] = useState({});

  const talents = character?.talents ?? { espiritu: 0, agilidad: 0, aguante: 0 };
  const thresholds = character?.talentThresholds ?? { espiritu: [], agilidad: [], aguante: [] };
  const choices = character?.talent_choices ?? {};

  const toggle = (key) => {
    setOpen((previous) => ({ ...previous, [key]: !previous[key] }));
  };

  const choose = (tree, threshold, option) => {
    if (!socket || !character?.id) return;
    socket.emit('choose-talent', { characterId: character.id, tree, threshold, option });
  };

  return (
    <div style={styles.container}>
      <div style={styles.summaryStrip}>
        {DOTE_TREES.map((tree) => {
          const value = talents[tree.key] || 0;
          const color = TREE_COLOR[tree.key];

          return (
            <div key={tree.key} style={styles.summaryChip}>
              <span style={{ ...styles.summaryValue, color }}>{value}</span>
              <span style={styles.summaryName}>{tree.name}</span>
            </div>
          );
        })}
      </div>

      {DOTE_TREES.map((tree) => {
        const value = talents[tree.key] || 0;
        const unlocked = thresholds[tree.key] || [];
        const color = TREE_COLOR[tree.key];
        const isOpen = !!open[tree.key];

        return (
          <div key={tree.key} style={{ ...styles.card, borderLeftColor: color }}>
            <button type="button" onClick={() => toggle(tree.key)} style={styles.header}>
              <div style={styles.headerLeft}>
                <span style={{ ...styles.title, color }}>Arbol de {tree.name}</span>
                <span style={styles.badge}>{unlocked.length}/4</span>
              </div>
              {isOpen
                ? <ChevronDown size={18} style={{ color }} />
                : <ChevronRight size={18} style={{ color: '#6B6557' }} />}
            </button>

            {isOpen && (
              <div style={styles.treeBody}>
                <p style={styles.treeBlurb}>{tree.blurb}</p>

                {tree.tiers.map((tier) => {
                  const reached = value >= tier.th;
                  const chosen = choices[tree.key]?.[String(tier.th)];
                  const options = [
                    { key: 'a', dote: tier.a },
                    { key: 'b', dote: tier.b },
                    { key: 'c', dote: tier.c },
                  ];

                  return (
                    <div key={tier.th} style={{ ...styles.tier, ...(reached ? null : styles.tierLocked) }}>
                      <div style={styles.tierHead}>
                        {reached
                          ? <Sparkles size={13} style={{ color }} />
                          : <Lock size={13} style={{ color: '#6B6557' }} />}
                        <span style={{ ...styles.tierTitle, color: reached ? color : '#6B6557' }}>
                          Umbral {tier.th}
                          {reached
                            ? chosen ? ' - elegido' : ' - elige uno'
                            : ` - requiere ${tier.th} ${tree.name.toLowerCase()}`}
                        </span>
                      </div>

                      {reached && options.map(({ key, dote }) => {
                        const isChosen = chosen === key;
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => choose(tree.key, tier.th, key)}
                            style={{
                              ...styles.option,
                              ...(isChosen
                                ? { borderColor: color, background: `${color}1A` }
                                : null),
                            }}
                          >
                            <div style={styles.optionHead}>
                              <span style={{ ...styles.optionName, ...(isChosen ? { color } : null) }}>
                                {key.toUpperCase()} - {dote.name}
                              </span>
                              {isChosen && <span style={{ ...styles.optionTag, color }}>elegido</span>}
                            </div>
                            <span style={styles.optionDesc}>{dote.desc}</span>
                          </button>
                        );
                      })}

                      {reached && <p style={styles.pickHint}>Toca una opcion para elegirla o repetirla para quitarla.</p>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    paddingBottom: 8,
  },
  summaryStrip: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
  },
  summaryChip: {
    flex: '1 1 140px',
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
    padding: '10px 12px',
    borderRadius: 14,
    border: '1px solid #2A332F',
    background: '#1E2A28',
  },
  summaryValue: {
    fontSize: 24,
    lineHeight: 1,
    fontWeight: 900,
  },
  summaryName: {
    fontSize: 10,
    color: '#6B6557',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  card: {
    borderRadius: 18,
    border: '1px solid #2A332F',
    borderLeft: '4px solid',
    background: '#16211F',
    overflow: 'hidden',
  },
  header: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    padding: 16,
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  title: {
    fontSize: 14,
    fontWeight: 900,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  badge: {
    padding: '3px 8px',
    borderRadius: 999,
    background: '#1E2A28',
    color: '#A89F8E',
    fontSize: 10,
    fontWeight: 800,
    whiteSpace: 'nowrap',
  },
  treeBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    padding: '0 16px 16px',
  },
  treeBlurb: {
    margin: 0,
    color: '#6B6557',
    fontSize: 12,
    fontStyle: 'italic',
    lineHeight: 1.5,
  },
  tier: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    paddingTop: 14,
    borderTop: '1px solid #2A332F',
  },
  tierLocked: {
    opacity: 0.55,
  },
  tierHead: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  tierTitle: {
    fontSize: 12,
    fontWeight: 800,
  },
  option: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    padding: 12,
    borderRadius: 12,
    border: '1px solid #2A332F',
    background: '#1E2A28',
    textAlign: 'left',
    cursor: 'pointer',
  },
  optionHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  optionName: {
    color: '#EDE6D8',
    fontSize: 13,
    fontWeight: 800,
  },
  optionTag: {
    fontSize: 10,
    fontWeight: 900,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    flexShrink: 0,
  },
  optionDesc: {
    color: '#A89F8E',
    fontSize: 12,
    lineHeight: 1.5,
  },
  pickHint: {
    margin: 0,
    color: '#6B6557',
    fontSize: 11,
    fontStyle: 'italic',
  },
};
