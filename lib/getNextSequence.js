import dbConnect from './dbConnect';
import mongoose from 'mongoose';

export default async function getNextSequence(sequenceName) {
  await dbConnect();
  const db = mongoose.connection.db;
  const counters = db.collection('counters');

  let result;
  try {
    result = await counters.findOneAndUpdate(
      { _id: sequenceName },
      { $inc: { sequence_value: 1 } },
      {
        upsert: true,
        returnDocument: 'after', // For MongoDB Node Driver v4+
      }
    );
  } catch (err) {
    console.error('⚠️ Mongo error during findOneAndUpdate:', err);
  }

  const value = result?.value?.sequence_value;

  if (typeof value !== 'number') {
    const fallback = await counters.findOne({ _id: sequenceName });
    if (!fallback || typeof fallback.sequence_value !== 'number') {
      throw new Error('ไม่สามารถดึงเลขลำดับได้จาก fallback');
    }
    const fallbackNumber = fallback.sequence_value.toString().padStart(6, '0');
    return `TKC-68${fallbackNumber}`;
  }

  const number = value.toString().padStart(4, '0');
  return `TKC-68${number}`;
}