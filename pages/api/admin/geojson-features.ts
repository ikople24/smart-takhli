import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuth } from '@clerk/nextjs/server';
import { clerkClient } from '@clerk/nextjs/server';
import dbConnect from '@/lib/dbConnect';
import GeoJSONFeature from '@/models/GeoJSONFeature';

const APP_ID = process.env.NEXT_PUBLIC_APP_ID || '';

async function verifyAdmin(req: NextApiRequest): Promise<{ ok: boolean; error?: string }> {
  try {
    const { userId } = getAuth(req);
    if (!userId) return { ok: false, error: 'Unauthorized' };

    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    const role = (user.publicMetadata as Record<string, string>)?.role;
    if (!role || (role !== 'admin' && role !== 'superadmin')) {
      return { ok: false, error: 'Forbidden' };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'Auth error' };
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await verifyAdmin(req);
  if (!auth.ok) return res.status(401).json({ success: false, message: auth.error });

  await dbConnect();

  // ─── GET ───────────────────────────────────────────────
  if (req.method === 'GET') {
    try {
      const features = await GeoJSONFeature.find({ appId: APP_ID })
        .sort({ createdAt: -1 })
        .lean();
      return res.status(200).json({ success: true, features });
    } catch (e: unknown) {
      return res.status(500).json({ success: false, message: (e as Error).message });
    }
  }

  // ─── POST ──────────────────────────────────────────────
  if (req.method === 'POST') {
    try {
      const { name, featureType, geometry, properties, color, active } = req.body;
      if (!name || !geometry) {
        return res.status(400).json({ success: false, message: 'name and geometry are required' });
      }
      const feature = await GeoJSONFeature.create({
        name,
        featureType: featureType || 'other',
        geometry,
        properties: properties || {},
        color: color || '#3B82F6',
        appId: APP_ID,
        active: active !== false,
      });
      return res.status(201).json({ success: true, feature });
    } catch (e: unknown) {
      return res.status(500).json({ success: false, message: (e as Error).message });
    }
  }

  // ─── PUT ───────────────────────────────────────────────
  if (req.method === 'PUT') {
    try {
      const { id, name, featureType, geometry, properties, color, active } = req.body;
      if (!id) return res.status(400).json({ success: false, message: 'id is required' });

      const feature = await GeoJSONFeature.findOneAndUpdate(
        { _id: id, appId: APP_ID },
        { $set: { name, featureType, geometry, properties, color, active } },
        { new: true, runValidators: true }
      );
      if (!feature) return res.status(404).json({ success: false, message: 'Not found' });
      return res.status(200).json({ success: true, feature });
    } catch (e: unknown) {
      return res.status(500).json({ success: false, message: (e as Error).message });
    }
  }

  // ─── DELETE ────────────────────────────────────────────
  if (req.method === 'DELETE') {
    try {
      const id = req.query.id as string;
      if (!id) return res.status(400).json({ success: false, message: 'id is required' });
      await GeoJSONFeature.deleteOne({ _id: id, appId: APP_ID });
      return res.status(200).json({ success: true });
    } catch (e: unknown) {
      return res.status(500).json({ success: false, message: (e as Error).message });
    }
  }

  return res.status(405).json({ success: false, message: 'Method not allowed' });
}
