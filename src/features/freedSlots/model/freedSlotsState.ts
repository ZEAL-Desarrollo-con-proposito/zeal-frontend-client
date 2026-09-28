import type { FreedSlotOffer } from './freedSlot';

/**
 * Dónde va cada cupo en la competencia. Solo `available` deja pulsar "Tomar el cupo": tras el
 * primer clic pasa a `claiming` y ya no hay vuelta atrás, salvo que la conexión falle.
 */
export type ClaimState =
  /** `error`: el último intento no llegó al servidor; se puede volver a intentar. */
  | { status: 'available'; error: string | null }
  | { status: 'claiming' }
  | { status: 'won' }
  /** Otra persona lo tomó primero. `detail`: la explicación del servidor, si la dio. */
  | { status: 'lost'; detail: string | undefined }
  /** El cupo ya no existe, venció o no es para esta persona. */
  | { status: 'gone'; detail: string | undefined };

export type ClaimStatus = ClaimState['status'];

export interface OfferEntry {
  offer: FreedSlotOffer;
  claim: ClaimState;
}

export type FreedSlotsAction =
  | { type: 'offered'; offer: FreedSlotOffer }
  | { type: 'claim-start'; id: string }
  | { type: 'claim-won'; id: string }
  | { type: 'claim-lost'; id: string; detail: string | undefined }
  | { type: 'claim-gone'; id: string; detail: string | undefined }
  | { type: 'claim-failed'; id: string; error: string }
  /** Otra persona tomó el cupo (evento en vivo). */
  | { type: 'taken'; id: string }
  | { type: 'dismiss'; id: string };

/** Alertas a la vez: la más antigua sale para que no tapen la pantalla (como los avisos). */
export const MAX_VISIBLE_OFFERS = 3;

export const INITIAL_FREED_SLOTS_STATE: readonly OfferEntry[] = [];

/** Cambia el cupo `id` solo si está en el estado `from`: un evento atrasado nunca pisa un resultado. */
function transition(
  state: readonly OfferEntry[],
  id: string,
  from: ClaimStatus,
  next: ClaimState,
): OfferEntry[] {
  return state.map((entry) =>
    entry.offer.id === id && entry.claim.status === from ? { ...entry, claim: next } : entry,
  );
}

export function freedSlotsReducer(
  state: readonly OfferEntry[],
  action: FreedSlotsAction,
): readonly OfferEntry[] {
  switch (action.type) {
    case 'offered': {
      const entry: OfferEntry = {
        offer: action.offer,
        claim: { status: 'available', error: null },
      };
      return [...state, entry].slice(-MAX_VISIBLE_OFFERS);
    }
    case 'claim-start':
      return transition(state, action.id, 'available', { status: 'claiming' });
    case 'claim-won':
      return transition(state, action.id, 'claiming', { status: 'won' });
    case 'claim-lost':
      return transition(state, action.id, 'claiming', { status: 'lost', detail: action.detail });
    case 'claim-gone':
      return transition(state, action.id, 'claiming', { status: 'gone', detail: action.detail });
    case 'claim-failed':
      return transition(state, action.id, 'claiming', { status: 'available', error: action.error });
    case 'taken':
      return transition(state, action.id, 'available', { status: 'lost', detail: undefined });
    case 'dismiss':
      return state.filter(({ offer }) => offer.id !== action.id);
  }
}
