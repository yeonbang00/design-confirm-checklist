// POST /api/detectFaces
// Body: { base64, mediaType, imageWidth?, imageHeight? }
// Returns: { faces: [{ label, x, y, width, height }, ...] }
//
// Lightweight preliminary vision call used only to locate faces so the
// client can crop+zoom each one and send it back on the main /api/analyze
// request as a separate, context-free image — see _faceDetect.js for why.
// Fails soft: on any error this returns an empty faces array rather than
// a 5xx, since a missing face crop must never block the main analysis.

import { detectFaces } from './_faceDetect.js';
import { rejectIfNotSameOrigin } from './_originCheck.js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (rejectIfNotSameOrigin(req, res)) return;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(200).json({ faces: [] });
    return;
  }

  const { base64, mediaType, imageWidth, imageHeight } = req.body || {};
  if (!base64 || !mediaType) {
    res.status(200).json({ faces: [] });
    return;
  }

  const faces = await detectFaces(apiKey, base64, mediaType, imageWidth, imageHeight);
  res.status(200).json({ faces });
}
