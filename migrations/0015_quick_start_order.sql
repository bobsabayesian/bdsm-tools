-- Show the quick starts on the "What's in bounds?" screen in a sensible order
-- rather than alphabetically.
UPDATE docs SET doc = json_set(doc, '$.order', CASE id
    WHEN 'everything-except-genitals' THEN 1
    WHEN 'external-only' THEN 2
    WHEN 'penis-and-balls' THEN 3
    WHEN 'pussy' THEN 4
    WHEN 'everyday-clothing' THEN 5
    WHEN 'household-items' THEN 6
    WHEN 'private-indoor-spaces' THEN 7
    ELSE 99 END)
WHERE collection = 'catalog-bounds-presets';
