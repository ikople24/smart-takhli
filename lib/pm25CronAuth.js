export function requireCronSecret(req) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return { ok: false, status: 500, message: "Server misconfigured: CRON_SECRET is missing" };
  }
  const provided = req.headers["x-cron-secret"] || req.query?.secret || "";
  if (String(provided) !== String(expected)) {
    return { ok: false, status: 401, message: "Unauthorized" };
  }
  return { ok: true };
}
