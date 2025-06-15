import dbConnect from '@/lib/dbConnect';
import Assignment from '@/models/Assignment';
import mongoose from 'mongoose';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    await dbConnect();
    const { complaintId, userId, solution, solutionImages, completedAt,assignedAt
, note } = req.body;

    if (!complaintId || !userId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const newAssignment = await Assignment.create({
      complaintId: new mongoose.Types.ObjectId(complaintId),
      userId: new mongoose.Types.ObjectId(userId),
      solution,
      solutionImages,
      completedAt,
      assignedAt,
      note,
    });

    res.status(201).json({ message: 'Assignment created successfully', assignment: newAssignment });
  } catch (error) {
    console.error('Error creating assignment:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}