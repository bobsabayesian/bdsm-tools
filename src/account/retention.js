// The kinds of proof a partner can be shown, in the order they are listed
export const PROOF_LABELS = {
  attestation: 'Attestation (checkbox)',
  media: 'Photo / video / audio',
  numeric: 'Number (measurement)',
  text: 'Journal / long text',
  lines: 'Repeated lines',
  timer: 'Timer (hold)',
  choice: 'Choice (or permission)',
  quiz: 'Quiz / memorisation',
  checkin: 'Time-stamped check-in',
  location: 'Location check-in',
};

// Parts of a task the person doing it can require before it is assigned to them
export const TASK_FIELD_LABELS = {
  guardrails:
    'Guardrail tags (the anatomy, gear, clothing and spaces it needs)',
  kinks: 'Kinks & themes',
  due: 'A due time',
};
