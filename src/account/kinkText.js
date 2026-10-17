/**
 * Naming kinks and the side of them someone is talking about. A section can
 * name its two sides itself ("As Dominant" / "As submissive"); otherwise they
 * are Giving and Receiving. A kink with no sides ('any') has just one answer.
 */

export const DEFAULT_SIDE = { give: 'Giving', receive: 'Receiving' };

/** The sides a kink is answered on, in the order they are shown */
export const sidesOf = (kink) => {
  if (kink?.sides === 'any') return ['any'];
  if (kink?.sides === 'give' || kink?.sides === 'receive') return [kink.sides];
  return ['give', 'receive'];
};

/** "As Dominant", "Receiving", or '' for a kink with no sides */
export const sideName = (kink, direction) => {
  if (direction === 'give') return kink?.giveLabel || DEFAULT_SIDE.give;
  if (direction === 'receive')
    return kink?.receiveLabel || DEFAULT_SIDE.receive;
  return '';
};

/** "Discipline (as Dominant)", or just "Exhibitionism" when there are no sides */
export const kinkWithSide = (kink, direction, fallbackKey = '') => {
  const name = kink?.label ?? fallbackKey;
  const side = sideName(kink, direction).toLowerCase();
  return side ? `${name} (${side})` : name;
};
