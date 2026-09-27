import type { KeyboardEvent } from 'react';
import { useRef } from 'react';
import { motion } from 'motion/react';
import type { AppointmentView } from '../hooks/useAppointmentsView';
import styles from './AppointmentTabs.module.css';

export interface AppointmentTab {
  view: AppointmentView;
  label: string;
  count: number;
}

interface AppointmentTabsProps {
  tabs: readonly AppointmentTab[];
  selected: AppointmentView;
  onSelect: (view: AppointmentView) => void;
  panelId: string;
  tabId: (view: AppointmentView) => string;
}

const KEY_STEPS: Partial<Record<string, number>> = { ArrowRight: 1, ArrowLeft: -1 };

/**
 * Pestañas de "Mis citas" (Figma B9) con el patrón de WAI-ARIA: las flechas, Inicio y Fin mueven
 * la pestaña activa, y solo la activa entra en el orden de tabulación.
 */
export function AppointmentTabs({
  tabs,
  selected,
  onSelect,
  panelId,
  tabId,
}: Readonly<AppointmentTabsProps>) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  /** Enfoca y activa la pestaña en esa posición (da la vuelta en los extremos). */
  function focusTab(index: number) {
    const button = buttons.current[(index + tabs.length) % tabs.length];
    button?.focus();
    button?.click();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const step = KEY_STEPS[event.key];
    if (step !== undefined) {
      event.preventDefault();
      focusTab(index + step);
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      focusTab(event.key === 'Home' ? 0 : tabs.length - 1);
    }
  }

  return (
    <div className={styles.tabs} role="tablist" aria-label="Tus citas">
      {tabs.map((tab, index) => {
        const active = tab.view === selected;
        return (
          <button
            key={tab.view}
            ref={(node) => {
              buttons.current[index] = node;
            }}
            id={tabId(tab.view)}
            type="button"
            role="tab"
            className={styles.tab}
            aria-selected={active}
            aria-controls={panelId}
            tabIndex={active ? 0 : -1}
            onClick={() => {
              onSelect(tab.view);
            }}
            onKeyDown={(event) => {
              handleKeyDown(event, index);
            }}
          >
            {`${tab.label} · ${String(tab.count)}`}
            {active && (
              <motion.span
                layoutId="appointments-tab-indicator"
                className={styles.indicator}
                transition={{ type: 'spring', stiffness: 500, damping: 40 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
