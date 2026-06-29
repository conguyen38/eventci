import { query, send, sendError } from './_db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return sendError(res, 405, 'Method not allowed');
  try {
    const [events, guests] = await Promise.all([
      query('SELECT * FROM oh_events ORDER BY created_at DESC'),
      query('SELECT * FROM oh_guests ORDER BY created_at ASC')
    ]);
    send(res, 200, { ok: true, events, guests, serverTime: Date.now() });
  } catch (error) {
    console.error(error);
    sendError(res, 500, error.message || 'Database error');
  }
}
