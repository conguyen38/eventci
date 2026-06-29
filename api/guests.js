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

const COLUMNS = [
  'id',
  'event_id',
  'guest_code',
  'system_code',
  'name',
  'phone',
  'prm_name',
  'tcb_region',
  'unit',
  'sih_name',
  'note',
  'companions',
  'checked_in',
  'checkin_time',
  'checkin_by',
  'cancelled',
  'cancel_note',
  'walkin',
  'created_at'
];
const MUTABLE_COLUMNS = COLUMNS.filter((column) => column !== 'id');
const JSON_COLUMNS = ['companions'];

export default async function handler(req, res) {
  try {
    if (req.method === 'POST') {
      const rows = rowsFromBody(await readJson(req)).map((row) => pickAllowed(row, COLUMNS));
      if (rows.some((row) => !row.id || !row.event_id || !row.name)) {
        return sendError(res, 400, 'Guest id, event_id and name are required');
      }
      await upsertRows('oh_guests', COLUMNS, rows, JSON_COLUMNS);
      return send(res, 200, { ok: true, count: rows.length });
    }

    const id = req.query.id;
    if (!id) return sendError(res, 400, 'Missing id');

    if (req.method === 'PATCH') {
      const fields = pickAllowed(await readJson(req), MUTABLE_COLUMNS);
      await patchRow('oh_guests', id, fields, JSON_COLUMNS);
      return send(res, 200, { ok: true });
    }

    if (req.method === 'DELETE') {
      await query('DELETE FROM oh_guests WHERE id = $1', [id]);
      return send(res, 200, { ok: true });
    }

    return sendError(res, 405, 'Method not allowed');
  } catch (error) {
    console.error(error);
    return sendError(res, 500, error.message || 'Database error');
  }
}
