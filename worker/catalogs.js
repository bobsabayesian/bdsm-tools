/**
 * Catalog definitions. Adding a new kind of thing for admins to manage is a
 * matter of adding an entry here - the API and the admin UI are both driven
 * by these definitions.
 *
 * Field types: string | text | number | boolean | select | strings | ref
 *  - select:  `options: [{ label, value }]`
 *  - strings: free-form list of strings
 *  - ref:     list of `key`s from another catalog (`catalog`). Not enforced by
 *             the API as some references predate the catalogs.
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

const catalogs = {
  taskTypes: simpleCatalog('Task types', 'catalog-task-types', [
    {
      name: 'defaultTimeOptions',
      label: 'Default time options',
      type: 'strings',
      help: 'e.g. "5 minutes", "1 hour"',
    },
  ]),
  genders: simpleCatalog('Genders', 'catalog-genders', [
    {
      name: 'pronouns',
      label: 'Pronouns',
      type: 'strings',
      help: 'e.g. "she/her"',
    },
  ]),
  kinks: simpleCatalog('Kinks', 'catalog-kinks', [
    { name: 'category', label: 'Category', type: 'string' },
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
  ]),
  // `public` catalogs are readable by everyone (active items only) at
  // /api/catalog/:name - the site uses them to build its lists.
  bodyParts: simpleCatalog('Body parts', 'catalog-body-parts', [], {
    public: true,
  }),
  equipment: simpleCatalog('Equipment', 'catalog-equipment', [], {
    public: true,
  }),
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
  // Existing collection used by the Slave Training tool. Its documents also
  // carry `rating` and `added`, which the admin API never overwrites.
  tasks: {
    title: 'Slave training tasks',
    collection: 'slave-training-tasks',
    keyed: false,
    titleField: 'task',
    fields: [
      { name: 'task', label: 'Task', type: 'text', required: true },
      { name: 'bonusTask', label: 'Bonus task', type: 'text' },
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
    ],
  },
};

/** What the UI is allowed to see (no server-only details). */
const describe = () =>
  Object.fromEntries(
    Object.entries(catalogs).map(([id, catalog]) => {
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
    let v = body[field.name];
    const missing =
      v === undefined || v === null || (typeof v === 'string' && !v.trim());

    if (missing) {
      if (field.required) errors.push(`${field.label} is required`);
      else if (field.type === 'boolean')
        value[field.name] = field.default ?? false;
      else if (field.type === 'strings' || field.type === 'ref')
        value[field.name] = [];
      continue;
    }

    switch (field.type) {
      case 'string':
      case 'text':
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
