const digest = async (text) =>
  new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)),
  );

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Requires `Authorization: Bearer <ADMIN_TOKEN>` */
export const requireAdmin = async (c, next) => {
  const expected = c.env.ADMIN_TOKEN;
  const [scheme, token] = (c.req.header('authorization') ?? '').split(' ');

  const ok =
    !!expected &&
    scheme === 'Bearer' &&
    !!token &&
    crypto.subtle.timingSafeEqual(await digest(token), await digest(expected));

  if (!ok) {
    await sleep(500); // blunt brute-force protection
    return c.json({ error: 'Invalid or missing admin token' }, 401);
  }
  await next();
};
