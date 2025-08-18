import dbConnect from "@/lib/dbConnect";
import EducationRegister from "@/models/EducationRegisterModel";

export default async function handler(req, res) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    await dbConnect();

    const { _id, prefix, name, educationLevel, phone, address, actualAddress, note, annualIncome, incomeSource, householdMembers, housingStatus, familyStatus, receivedScholarship, takhliScholarshipHistory, schoolName, gradeLevel, gpa } = req.body;

    console.log('📝 Received update data:', { _id, prefix, name, educationLevel, phone, address, actualAddress, note, annualIncome, householdMembers, housingStatus, familyStatus, takhliScholarshipHistory, schoolName, gradeLevel, gpa });
    console.log('📝 Full request body:', req.body);

    if (!_id || !name) {
      return res.status(400).json({ message: 'Missing required fields: _id and name' });
    }

    const updatedData = {
      prefix: prefix !== undefined ? prefix : '',
      name,
      educationLevel: educationLevel !== undefined ? educationLevel : '',
      phone: phone !== undefined ? phone : '',
      address: address !== undefined ? address : '',
      actualAddress: actualAddress !== undefined ? actualAddress : '',
      note: note !== undefined ? note : '',
      annualIncome: annualIncome !== undefined ? parseInt(annualIncome) || 0 : 0,
      incomeSource: incomeSource || [],
      householdMembers: householdMembers !== undefined ? parseInt(householdMembers) || 1 : 1,
      housingStatus: housingStatus !== undefined ? housingStatus : 'ไม่ระบุ',
      familyStatus: familyStatus !== undefined ? familyStatus : [],
      receivedScholarship: receivedScholarship || [],
      takhliScholarshipHistory: takhliScholarshipHistory !== undefined ? takhliScholarshipHistory : [],
      schoolName: schoolName !== undefined ? schoolName : '',
      gradeLevel: gradeLevel !== undefined ? gradeLevel : '',
      gpa: gpa !== undefined ? parseFloat(gpa) || null : null
    };

    console.log('🔄 Updating record with data:', updatedData);
    
    const result = await EducationRegister.findByIdAndUpdate(
      _id,
      updatedData,
      { new: true, runValidators: true }
    );

    if (!result) {
      return res.status(404).json({ message: 'Record not found' });
    }

    console.log('✅ Updated result:', result);
    console.log('✅ Family status in result:', result.familyStatus);
    console.log('✅ Takhli scholarship history in result:', result.takhliScholarshipHistory);
    console.log('✅ School name in result:', result.schoolName);
    console.log('✅ Grade level in result:', result.gradeLevel);
    console.log('✅ GPA in result:', result.gpa);
    
    return res.status(200).json({ 
      message: 'Updated successfully', 
      data: result 
    });
  } catch (err) {
    console.error('❌ API error:', err);
    return res.status(500).json({ 
      message: 'Server error', 
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
} 