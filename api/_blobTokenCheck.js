// TEMPORARY diagnostic endpoint — GET /api/_blobTokenCheck
// Tries a real (tiny, harmless) Blob write using the same _blobPut.js
// helper saveBrandGuideState.js uses, to verify BLOB_READ_WRITE_TOKEN
// works in the deployed environment without needing the edit password.
// Delete this file once the token issue is confirmed fixed.

import { put } from './_blobPut.js';
import { rejectIfNotSameOrigin } from './_originCheck.js';

export default async function handler(req, res) {
  if (rejectIfNotSameOrigin(req, res)) return;
  try {
    const url = await put('diagnostic/token-check.json', Buffer.from('{"ok":true}'), 'application/json', { allowOverwrite: true });
    res.status(200).json({ success: true, url });
  } catch (err) {
    res.status(500).json({ success: false, error: err && err.message ? err.message : String(err) });
  }
}
