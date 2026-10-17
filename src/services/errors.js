/** Pull the most useful message out of a failed request */
export const errorMessage = (e) =>
  e?.response?.data?.errors?.join('. ') ??
  e?.response?.data?.error ??
  e?.message ??
  'Unknown error';
