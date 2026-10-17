/**
 * Catalog definitions. Adding a new kind of thing for admins to manage is a
 * matter of adding an entry here - the API and the admin UI are both driven
 * by these definitions.
 *
 * Field types: string | text | number | boolean | select | strings | ref | refOne
 *  - select:  `options: [{ label, value }]`
 *  - strings: free-form list of strings
 *  - ref:     list of `key`s from another catalog (`catalog`). Not enforced by
 *             the API as some references predate the catalogs.
 *  - refOne:  a single `key` from another catalog (`catalog`)
 *
 * Other field settings:
 *  - showWhen: `{ field, in: [...] }` - only shown (and stored) while another
 *              field has one of these values
 *  - inTable:  `false` keeps the field out of the admin table
 */

const catalogField = {
  key: {
    name: 'key',
    label: 'Key',
    type: 'string',
    required: true,
    pattern: '^[a-z0-9][a-z0-9 \\-]*$',
    patternMessage:
      'Use only lower case letters, numbers, spaces and dashes, starting with a letter or number',
    help: 'Stable identifier (lower case letters, numbers, spaces and dashes). Other data refers to this, so avoid changing it.',
  },
  label: { name: 'label', label: 'Label', type: 'string', required: true },
  description: { name: 'description', label: 'Description', type: 'text' },
  active: {
    name: 'active',
    label: 'Active',
    type: 'boolean',
    default: true,
    help: 'Inactive items are kept but hidden from users.',
  },
};

const simpleCatalog = (title, collection, extraFields = [], options = {}) => ({
  title,
  collection,
  ...options,
  keyed: true,
  titleField: 'label',
  fields: [
    catalogField.key,
    catalogField.label,
    catalogField.description,
    ...extraFields,
    catalogField.active,
  ],
});

// How a task is proven or logged. Each needs its own screen and validation,
// so this list lives in code rather than being admin-editable.
export const CONTACT_TOPICS = [
  { label: 'A question', value: 'question' },
  { label: 'Remove my data', value: 'data-request' },
  { label: 'Report a problem', value: 'problem' },
  { label: 'A suggestion', value: 'suggestion' },
  { label: 'Something else', value: 'other' },
];

const PROOF_TYPES = [
  { label: 'Attestation (checkbox)', value: 'attestation' },
  { label: 'Photo / video / audio', value: 'media' },
  { label: 'Number (measurement)', value: 'numeric' },
  { label: 'Journal / long text', value: 'text' },
  { label: 'Repeated lines', value: 'lines' },
  { label: 'Timer (hold)', value: 'timer' },
  { label: 'Choice (or permission)', value: 'choice' },
  { label: 'Quiz / memorisation', value: 'quiz' },
  { label: 'Time-stamped check-in', value: 'checkin' },
  { label: 'Location check-in', value: 'location' },
];

// Settings that only apply to some proof types
const forProof = (proofs, field) => ({
  ...field,
  showWhen: { field: 'proof', in: proofs },
  inTable: false,
});

// Where an item sits on the "What's in bounds?" screen
const placement = [
  {
    name: 'order',
    label: 'Position',
    type: 'number',
    help: 'Lower numbers are shown first on the setup screen',
  },
  {
    name: 'group',
    label: 'Group',
    type: 'string',
    help: 'Listed under this heading on the setup screen',
  },
];

const catalogs = {
  taskCategories: simpleCatalog('Task categories', 'catalog-task-categories'),
  // Offered on the optional "Me" tab - people can also just describe themselves
  genders: simpleCatalog(
    'Genders',
    'catalog-genders',
    [
      {
        name: 'pronouns',
        label: 'Pronouns',
        type: 'strings',
        help: 'e.g. "she/her"',
      },
    ],
    { public: true },
  ),
  // People rate each kink on the scale in worker/limits.js, separately for
  // giving and receiving (`sides`). A step on the setup screen appears once
  // at least one kink is active.
  kinks: simpleCatalog(
    'Kinks',
    'catalog-kinks',
    [
      {
        name: 'order',
        label: 'Position',
        type: 'number',
        help: 'Lower numbers are shown first on the setup screen',
      },
      {
        name: 'category',
        label: 'Category',
        type: 'string',
        help: 'Kinks are listed under their category on the setup screen',
      },
      {
        name: 'sides',
        label: 'Ask about',
        type: 'select',
        default: 'both',
        options: [
          { label: 'Giving and receiving', value: 'both' },
          { label: 'Receiving only', value: 'receive' },
          { label: 'Giving only', value: 'give' },
          { label: 'One answer (no sides)', value: 'any' },
        ],
      },
      {
        name: 'giveLabel',
        label: 'Name for the "giving" side',
        type: 'string',
        help: 'e.g. "As Dominant" - shown instead of "Giving". Leave blank for the default.',
      },
      {
        name: 'receiveLabel',
        label: 'Name for the "receiving" side',
        type: 'string',
        help: 'e.g. "As submissive" - shown instead of "Receiving". Leave blank for the default.',
      },
      {
        name: 'intensity',
        label: 'Intensity',
        type: 'select',
        options: [
          { label: 'Mild', value: 'mild' },
          { label: 'Moderate', value: 'moderate' },
          { label: 'Intense', value: 'intense' },
        ],
      },
      {
        name: 'requiresEquipment',
        label: 'Equipment',
        type: 'ref',
        catalog: 'equipment',
      },
      {
        name: 'requiresBodyPart',
        label: 'Body parts',
        type: 'ref',
        catalog: 'bodyParts',
      },
    ],
    { public: true },
  ),
  // Quick starts on the kinks screen. They mark these as "Like", and only where
  // nothing has been answered yet.
  kinkPresets: simpleCatalog(
    'Kink quick starts',
    'catalog-kink-presets',
    [
      {
        name: 'order',
        label: 'Position',
        type: 'number',
        help: 'Lower numbers are shown first',
      },
      {
        name: 'kinks',
        label: 'Kinks',
        type: 'ref',
        catalog: 'kinks',
        required: true,
      },
    ],
    { public: true },
  ),
  // `public` catalogs are readable by everyone (active items only) at
  // /api/catalog/:name - the site uses them to build its lists.
  bodyParts: simpleCatalog(
    'Body parts',
    'catalog-body-parts',
    [
      {
        name: 'order',
        label: 'Position',
        type: 'number',
        help: 'Lower numbers are shown first on the setup screen',
      },
      {
        name: 'group',
        label: 'Group',
        type: 'string',
        help: 'Parts are listed under their group on the setup screen, e.g. "Genitals"',
      },
    ],
    { public: true },
  ),
  // Quick starts on the My Body screen. They only add to what a person has
  // ticked, so name them for the parts they contain, not for a kind of person.
  bodyPartPresets: simpleCatalog(
    'Body part presets',
    'catalog-body-part-presets',
    [
      {
        name: 'parts',
        label: 'Parts',
        type: 'ref',
        catalog: 'bodyParts',
        required: true,
      },
    ],
    { public: true },
  ),
  // "What's in bounds?" is its own screen (separate from My Body, and it replaces
  // the old My Equipment): four lists a person can put in bounds for tasks - body
  // & anatomy, clothing, items (the equipment list) and spaces. Each has its own
  // catalog so a task can ask for any of them.
  boundsBody: simpleCatalog(
    'In bounds: body & anatomy',
    'catalog-bounds-body',
    placement,
    { public: true },
  ),
  boundsClothing: simpleCatalog(
    'In bounds: clothing',
    'catalog-bounds-clothing',
    placement,
    { public: true },
  ),
  equipment: simpleCatalog(
    'In bounds: items (equipment)',
    'catalog-equipment',
    placement,
    { public: true },
  ),
  boundsSpaces: simpleCatalog(
    'In bounds: spaces',
    'catalog-bounds-spaces',
    placement,
    { public: true },
  ),
  // Quick starts on the "What's in bounds?" screen. They only ever add to what a
  // person has ticked, so name them for what they contain, never for a kind of
  // person. A quick start can reach into any of the four lists.
  boundsPresets: simpleCatalog(
    'In bounds: quick starts',
    'catalog-bounds-presets',
    [
      {
        name: 'order',
        label: 'Position',
        type: 'number',
        help: 'Lower numbers are shown first',
      },
      {
        name: 'parts',
        label: 'Body & anatomy',
        type: 'ref',
        catalog: 'boundsBody',
      },
      {
        name: 'clothing',
        label: 'Clothing',
        type: 'ref',
        catalog: 'boundsClothing',
      },
      { name: 'equipment', label: 'Items', type: 'ref', catalog: 'equipment' },
      { name: 'spaces', label: 'Spaces', type: 'ref', catalog: 'boundsSpaces' },
    ],
    { public: true },
  ),
  // The key is the tool's address, e.g. "slave-training" for /tools/slave-training
  featureFlags: {
    title: 'Feature flags',
    collection: 'feature-flags',
    keyed: true,
    titleField: 'label',
    fields: [
      {
        ...catalogField.key,
        help: "Matches the tool's address: /tools/<key>. Changing it breaks the tool.",
      },
      catalogField.label,
      {
        name: 'enabled',
        label: 'Enabled',
        type: 'boolean',
        default: true,
        help: 'Switch off to hide the tool from everyone.',
      },
      {
        name: 'reason',
        label: 'Reason shown when disabled',
        type: 'text',
      },
    ],
  },
  // What people send from the contact form. Read and tidy them in the admin tool.
  messages: {
    title: 'Messages',
    collection: 'contact-messages',
    keyed: false,
    newestFirst: true,
    // managed in the admin tool's own Messages screen (it holds the conversation)
    hidden: true,
    titleField: 'message',
    fields: [
      {
        name: 'status',
        label: 'Status',
        type: 'select',
        default: 'new',
        options: [
          { label: 'New', value: 'new' },
          { label: 'Handled', value: 'handled' },
        ],
      },
      {
        name: 'topic',
        label: 'Topic',
        type: 'select',
        options: CONTACT_TOPICS,
      },
      { name: 'message', label: 'Message', type: 'text', required: true },
      {
        name: 'replyTo',
        label: 'Reply to',
        type: 'string',
        help: 'Where they asked to be answered (empty if they did not)',
      },
      {
        name: 'username',
        label: 'Username',
        type: 'string',
        help: 'Only there if they were logged in and chose to include it',
      },
      { name: 'received', label: 'Received', type: 'string' },
    ],
  },
  // Existing collection used by the Slave Training tool. Its documents also
  // carry `rating` and `added`, which the admin API never overwrites.
  tasks: {
    title: 'Task library',
    collection: 'slave-training-tasks',
    keyed: false,
    titleField: 'task',
    fields: [
      { name: 'task', label: 'Task', type: 'text', required: true },
      {
        name: 'category',
        label: 'Category',
        type: 'refOne',
        catalog: 'taskCategories',
      },
      {
        name: 'proof',
        label: 'How it is proven',
        type: 'select',
        options: PROOF_TYPES,
        default: 'attestation',
      },
      forProof(['numeric'], {
        name: 'unit',
        label: 'Unit',
        type: 'string',
        help: 'e.g. "ounces", "hours"',
      }),
      forProof(['numeric'], {
        name: 'minValue',
        label: 'Minimum',
        type: 'number',
      }),
      forProof(['numeric'], {
        name: 'maxValue',
        label: 'Maximum',
        type: 'number',
      }),
      forProof(['text'], {
        name: 'prompt',
        label: 'Prompt',
        type: 'text',
        help: 'What to write about',
      }),
      forProof(['text'], {
        name: 'minLength',
        label: 'Minimum length (characters)',
        type: 'number',
      }),
      forProof(['lines'], {
        name: 'phrase',
        label: 'Phrase to write',
        type: 'text',
        required: true,
      }),
      forProof(['lines'], {
        name: 'repetitions',
        label: 'Times to write it',
        type: 'number',
        required: true,
      }),
      forProof(['timer'], {
        name: 'seconds',
        label: 'Duration (seconds)',
        type: 'number',
        required: true,
      }),
      forProof(['choice'], {
        name: 'choices',
        label: 'Choices',
        type: 'strings',
        required: true,
      }),
      forProof(['quiz'], {
        name: 'questions',
        label: 'Questions',
        type: 'strings',
        required: true,
        help: 'One per entry, as "Question | Answer"',
      }),
      forProof(['media'], {
        name: 'allowedMedia',
        label: 'Accepted proof',
        type: 'select',
        default: 'photo',
        options: [
          { label: 'Photo', value: 'photo' },
          { label: 'Video', value: 'video' },
          { label: 'Audio', value: 'audio' },
          { label: 'Any', value: 'any' },
        ],
      }),
      forProof(['checkin'], {
        name: 'graceMinutes',
        label: 'Minutes of grace',
        type: 'number',
        help: 'Checking in later than the due time plus this is noted as late (never refused)',
      }),
      forProof(['location'], {
        name: 'place',
        label: 'Place',
        type: 'string',
        required: true,
        help: 'e.g. "the gym"',
      }),
      forProof(['location'], {
        name: 'placeLat',
        label: 'Place latitude',
        type: 'number',
        help: 'Optional. With the longitude, how far away they were is noted',
      }),
      forProof(['location'], {
        name: 'placeLng',
        label: 'Place longitude',
        type: 'number',
      }),
      forProof(['location'], {
        name: 'radiusMeters',
        label: 'Allowed distance (metres)',
        type: 'number',
      }),
      { name: 'timeOptions', label: 'Time options', type: 'strings' },
      {
        name: 'requiresBodyPart',
        label: 'Requires body parts',
        type: 'ref',
        catalog: 'bodyParts',
      },
      {
        name: 'requiresEquipment',
        label: 'Requires equipment',
        type: 'ref',
        catalog: 'equipment',
      },
      {
        name: 'requiresBoundsBody',
        label: 'Requires in bounds: body & anatomy',
        type: 'ref',
        catalog: 'boundsBody',
        help: 'The finer list on "What\'s in bounds?" (not My Body)',
      },
      {
        name: 'requiresClothing',
        label: 'Requires in bounds: clothing',
        type: 'ref',
        catalog: 'boundsClothing',
      },
      {
        name: 'requiresSpaces',
        label: 'Requires in bounds: spaces',
        type: 'ref',
        catalog: 'boundsSpaces',
      },
      // From the point of view of the person doing the task. A task is never
      // given to someone with a hard limit on one of these.
      {
        name: 'kinksReceiving',
        label: 'Kinks they receive',
        type: 'ref',
        catalog: 'kinks',
        help: 'Things done to the person doing this task',
      },
      {
        name: 'kinksGiving',
        label: 'Kinks they give',
        type: 'ref',
        catalog: 'kinks',
        help: 'Things the person doing this task does to someone else',
      },
      {
        name: 'kinksGeneral',
        label: 'Kinks with no sides',
        type: 'ref',
        catalog: 'kinks',
        help: 'Themes that have a single answer, such as exhibitionism',
      },
    ],
  },
};

/** What the UI is allowed to see (no server-only details). */
const describe = () =>
  Object.fromEntries(
    Object.entries(catalogs)
      .filter(([, catalog]) => !catalog.hidden)
      .map(([id, catalog]) => {
        const publicCatalog = { ...catalog };
        delete publicCatalog.collection;
        return [id, publicCatalog];
      }),
  );

/**
 * Validate and normalise a request body against a catalog's fields.
 * Returns `{ value }` containing only known fields, or `{ errors }`.
 */
function validate(catalog, body) {
  const errors = [];
  const value = {};

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { errors: ['Body must be a JSON object'] };
  }

  for (const field of catalog.fields) {
    // Settings for a different proof type are neither required nor kept
    if (
      field.showWhen &&
      !field.showWhen.in.includes(value[field.showWhen.field])
    ) {
      continue;
    }

    let v = body[field.name];
    const missing =
      v === undefined ||
      v === null ||
      (typeof v === 'string' && !v.trim()) ||
      (Array.isArray(v) && v.length === 0);

    if (missing) {
      if (field.required) errors.push(`${field.label} is required`);
      else if (field.default !== undefined) value[field.name] = field.default;
      else if (field.type === 'boolean') value[field.name] = false;
      else if (field.type === 'strings' || field.type === 'ref')
        value[field.name] = [];
      continue;
    }

    switch (field.type) {
      case 'string':
      case 'text':
      case 'refOne':
        if (typeof v !== 'string') {
          errors.push(`${field.label} must be text`);
          continue;
        }
        v = v.trim();
        if (field.name === 'key') v = v.toLowerCase().replace(/\s+/g, ' ');
        if (v.length > (field.type === 'string' ? 200 : 4000)) {
          errors.push(`${field.label} is too long`);
          continue;
        }
        if (field.pattern && !new RegExp(field.pattern).test(v)) {
          errors.push(
            field.patternMessage ?? `${field.label} has an invalid format`,
          );
          continue;
        }
        break;
      case 'number':
        if (typeof v !== 'number' || !Number.isFinite(v)) {
          errors.push(`${field.label} must be a number`);
          continue;
        }
        break;
      case 'boolean':
        if (typeof v !== 'boolean') {
          errors.push(`${field.label} must be true or false`);
          continue;
        }
        break;
      case 'select':
        if (!field.options.some((o) => o.value === v)) {
          errors.push(`${field.label} must be one of the available options`);
          continue;
        }
        break;
      case 'strings':
      case 'ref':
        if (
          !Array.isArray(v) ||
          v.length > 100 ||
          v.some((s) => typeof s !== 'string' || !s.trim() || s.length > 200)
        ) {
          errors.push(`${field.label} must be a list of text values`);
          continue;
        }
        v = [...new Set(v.map((s) => s.trim()))];
        break;
    }
    value[field.name] = v;
  }

  return errors.length ? { errors } : { value };
}

export { catalogs, describe, validate };
