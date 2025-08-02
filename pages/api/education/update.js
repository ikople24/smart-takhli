import dbConnect from "@/lib/dbConnect";
import EducationRegister from "@/models/EducationRegisterModel";

export default async function handler(req, res) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    await dbConnect();

    const { _id, prefix, name, educationLevel, phone, address, note, annualIncome, incomeSource, householdMembers, housingStatus, receivedScholarship } = req.body;

    if (!_id || !name) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const updatedData = {
      prefix: prefix !== undefined ? prefix : '',
      name,
      educationLevel: educationLevel !== undefined ? educationLevel : '',
      phone: phone !== undefined ? phone : '',
      address: address !== undefined ? address : '',
      note: note !== undefined ? note : '',
      annualIncome: annualIncome !== undefined ? annualIncome : '',
      incomeSource: incomeSource || [],
      householdMembers: householdMembers !== undefined ? householdMembers : 1,
      housingStatus: housingStatus !== undefined ? housingStatus : '',
      receivedScholarship: receivedScholarship || []
    };

    console.log('Updating record with data:', updatedData);
    
    const result = await EducationRegister.findByIdAndUpdate(
      _id,
      updatedData,
      { new: true, runValidators: true }
    );

    if (!result) {
      return res.status(404).json({ message: 'Record not found' });
    }

    console.log('Updated result:', result);
    
    return res.status(200).json({ 
      message: 'Updated successfully', 
      data: result 
    });
  } catch (err) {
    console.error('❌ API error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
} 