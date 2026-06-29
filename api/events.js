import {
  patchRow,
  pickAllowed,
  query,
  readJson,
  rowsFromBody,
  send,
  sendError,
  upsertRows
} from './_db.js';

const COLUMNS = ['id', 'name', 'date_str', 'team', 'venue', 'event_pw', 'btc_members', 'created_at'];
const MUTABLE_COLUMNS = ['name', 'date_str', 'team', 'venue', 'event_pw', 'btc_members', 'created_at'];
const JSON_COLUMNS = ['btc_members'];

export default async function handler(req, res) {
  try {
    if (req.method === 'POST') {
      const rows = rowsFromBody(await readJson(req)).map((row) => pickAllowed(row, COLUMNS));
      if (rows.some((row) => !row.id || !row.name)) return sendError(res, 400, 'Event id and name are required');
      await upsertRows('oh_events', COLUMNS, rows, JSON_COLUMNS);
      return send(res, 200, { ok: true, count: rows.length });
    }

    const id = req.query.id;
    if (!id) return sendError(res, 400, 'Missing id');

    if (req.method === 'PATCH') {
      const fields = pickAllowed(await readJson(req), MUTABLE_COLUMNS);
      await patchRow('oh_events', id, fields, JSON_COLUMNS);
      return send(res, 200, { ok: true });
    }

    if (req.method === 'DELETE') {
      await query('DELETE FROM oh_events WHERE id = $1', [id]);
      return send(res, 200, { ok: true });
    }

    return sendError(res, 405, 'Method not allowed');
  } catch (error) {
    console.error(error);
    return sendError(res, 500, error.message || 'Database error');
  }
}
