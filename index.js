const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const csv = require('csv-writer').createObjectCsvStringifier;

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Enhanced static file serving for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  maxAge: '30d',
  etag: true,
  lastModified: true
}));

// MongoDB connection
mongoose.connect('mongodb+srv://rtc:rtc@rtc.hiogp8h.mongodb.net/rtc', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB connected successfully'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// Member Schema
const memberSchema = new mongoose.Schema({
  photo: String,
  stateOfOrigin: String,
  homeTown: String,
  fullName: String,
  zone: String,
  area: String,
  parish: String,
  parishAddress: String,
  gender: String,
  status: String,
  part: String,
  position: [String],
  phoneNo: String,
  residentialAddress: String,
  joinYear: Number,
  occupation: String,
  instruments: [String],
  createdAt: { type: Date, default: Date.now }
});

const Member = mongoose.model('Member', memberSchema);

// Enhanced Multer configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
      console.log('📁 Created uploads directory');
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const fileExtension = path.extname(file.originalname);
    cb(null, 'member-' + uniqueSuffix + fileExtension);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Routes

// Create member
app.post('/api/members', upload.single('photo'), async (req, res) => {
  console.log('📥 Received form submission:', req.body);
  console.log('📁 File received:', req.file);
  
  try {
    let photoFilename = '';
    
    if (req.file) {
      photoFilename = req.file.filename;
      console.log('✅ File saved as:', photoFilename);
    }

    const memberData = {
      ...req.body,
      photo: photoFilename
    };

    // Convert position to array
    if (typeof memberData.position === 'string') {
      memberData.position = [memberData.position];
    } else if (Array.isArray(memberData.position)) {
      // Already an array
    } else {
      memberData.position = [];
    }

    // Convert instruments to array
    if (typeof memberData.instruments === 'string') {
      memberData.instruments = [memberData.instruments];
    } else if (Array.isArray(memberData.instruments)) {
      // Already an array
    } else {
      memberData.instruments = [];
    }

    console.log('📝 Processed member data:', memberData);

    const member = new Member(memberData);
    const savedMember = await member.save();
    
    console.log('✅ Member saved to database:', savedMember._id);
    
    res.json({ 
      success: true, 
      message: 'Member registered successfully!',
      memberId: savedMember._id,
      photoUrl: photoFilename ? `/uploads/${photoFilename}` : null
    });
  } catch (error) {
    console.error('❌ Error saving member:', error);
    
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Failed to save member: ' + error.message 
    });
  }
});

// Get members with pagination
app.get('/api/members', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const members = await Member.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const membersWithImageUrls = members.map(member => ({
      ...member.toObject(),
      photoUrl: member.photo ? `/uploads/${member.photo}` : null
    }));

    const total = await Member.countDocuments();
    const totalPages = Math.ceil(total / limit);

    res.json({
      members: membersWithImageUrls,
      pagination: {
        currentPage: page,
        totalPages,
        totalMembers: total,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get single member
app.get('/api/members/:id', async (req, res) => {
  try {
    const member = await Member.findById(req.params.id);
    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }
    
    const memberWithPhotoUrl = {
      ...member.toObject(),
      photoUrl: member.photo ? `/uploads/${member.photo}` : null
    };
    
    res.json({ success: true, member: memberWithPhotoUrl });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update member
app.put('/api/members/:id', upload.single('photo'), async (req, res) => {
  try {
    console.log('🔄 Updating member:', req.params.id);
    console.log('📥 Update data:', req.body);
    console.log('📁 Update file:', req.file);

    const memberId = req.params.id;
    const existingMember = await Member.findById(memberId);
    
    if (!existingMember) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    let photoFilename = existingMember.photo;

    // Handle new photo upload
    if (req.file) {
      // Delete old photo if it exists
      if (existingMember.photo) {
        const oldPhotoPath = path.join(__dirname, 'uploads', existingMember.photo);
        if (fs.existsSync(oldPhotoPath)) {
          fs.unlinkSync(oldPhotoPath);
          console.log('🗑️ Deleted old photo:', existingMember.photo);
        }
      }
      photoFilename = req.file.filename;
      console.log('✅ New photo saved as:', photoFilename);
    }

    // Prepare update data
    const updateData = {
      ...req.body,
      photo: photoFilename
    };

    // Convert position to array
    if (typeof updateData.position === 'string') {
      updateData.position = [updateData.position];
    } else if (Array.isArray(updateData.position)) {
      // Already an array
    } else {
      updateData.position = [];
    }

    // Convert instruments to array
    if (typeof updateData.instruments === 'string') {
      updateData.instruments = [updateData.instruments];
    } else if (Array.isArray(updateData.instruments)) {
      // Already an array
    } else {
      updateData.instruments = [];
    }

    // Update member in database
    const updatedMember = await Member.findByIdAndUpdate(
      memberId,
      updateData,
      { new: true, runValidators: true }
    );

    console.log('✅ Member updated successfully:', updatedMember._id);

    res.json({
      success: true,
      message: 'Member updated successfully!',
      member: updatedMember,
      photoUrl: photoFilename ? `/uploads/${photoFilename}` : null
    });

  } catch (error) {
    console.error('❌ Error updating member:', error);
    
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to update member: ' + error.message
    });
  }
});

// Delete member
app.delete('/api/members/:id', async (req, res) => {
  try {
    const memberId = req.params.id;
    const member = await Member.findById(memberId);
    
    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    // Delete photo file if it exists
    if (member.photo) {
      const photoPath = path.join(__dirname, 'uploads', member.photo);
      if (fs.existsSync(photoPath)) {
        fs.unlinkSync(photoPath);
        console.log('🗑️ Deleted member photo:', member.photo);
      }
    }

    await Member.findByIdAndDelete(memberId);
    
    res.json({
      success: true,
      message: 'Member deleted successfully!'
    });
  } catch (error) {
    console.error('❌ Error deleting member:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete member: ' + error.message
    });
  }
});

// Get all members without pagination
app.get('/api/members/all', async (req, res) => {
  try {
    const members = await Member.find().sort({ fullName: 1 });
    
    const membersWithImageUrls = members.map(member => ({
      ...member.toObject(),
      photoUrl: member.photo ? `/uploads/${member.photo}` : null
    }));

    res.json({
      success: true,
      members: membersWithImageUrls,
      total: members.length
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get unique zones
app.get('/api/zones', async (req, res) => {
  try {
    const zones = await Member.distinct('zone');
    res.json(zones.filter(zone => zone && zone.trim() !== ''));
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Search members
app.get('/api/members/search/:query', async (req, res) => {
  try {
    const query = req.params.query;
    const members = await Member.find({
      $or: [
        { fullName: { $regex: query, $options: 'i' } },
        { phoneNo: { $regex: query, $options: 'i' } },
        { parish: { $regex: query, $options: 'i' } },
        { zone: { $regex: query, $options: 'i' } }
      ]
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      members: members,
      total: members.length
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Enhanced PDF Export with images and complete details
app.get('/api/members/export/pdf', async (req, res) => {
  try {
    const members = await Member.find().sort({ fullName: 1 });
    
    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=choir-members-complete.pdf');
    
    doc.pipe(res);
    
    // Title Page
    doc.fontSize(24).font('Helvetica-Bold')
       .fillColor('#2d3748')
       .text('CHOIR MEMBERS DIRECTORY', { align: 'center' });
    
    doc.moveDown(2);
    doc.fontSize(16).font('Helvetica')
       .fillColor('#718096')
       .text(`Total Members: ${members.length}`, { align: 'center' });
    
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, { align: 'center' });
    
    doc.addPage();
    
    // Table of Contents
    doc.fontSize(20).font('Helvetica-Bold')
       .fillColor('#2d3748')
       .text('TABLE OF CONTENTS', { align: 'center' });
    
    doc.moveDown();
    doc.fontSize(12).font('Helvetica')
       .fillColor('#4a5568');
    
    members.forEach((member, index) => {
      const pageNumber = Math.floor(index / 2) + 3; // Calculate page number
      doc.text(`${index + 1}. ${member.fullName}`, { continued: true })
         .text(`............. ${pageNumber}`, { align: 'right' });
    });
    
    // Process members in batches of 2 per page
    for (let i = 0; i < members.length; i += 2) {
      if (i > 0) doc.addPage();
      
      const member1 = members[i];
      const member2 = members[i + 1];
      
      // Member 1
      if (member1) {
        await addMemberToPDF(doc, member1, i + 1);
        doc.moveDown();
      }
      
      // Page break between members
      if (member1 && member2) {
        doc.moveTo(50, doc.y)
           .lineTo(545, doc.y)
           .strokeColor('#e2e8f0')
           .lineWidth(1)
           .stroke();
        doc.moveDown();
      }
      
      // Member 2
      if (member2) {
        await addMemberToPDF(doc, member2, i + 2);
      }
    }
    
    // Summary Page
    doc.addPage();
    doc.fontSize(20).font('Helvetica-Bold')
       .fillColor('#2d3748')
       .text('SUMMARY STATISTICS', { align: 'center' });
    
    doc.moveDown(2);
    
    // Calculate statistics
    const zones = [...new Set(members.map(m => m.zone))].length;
    const parishes = [...new Set(members.map(m => m.parish))].length;
    const parts = members.reduce((acc, m) => {
      acc[m.part] = (acc[m.part] || 0) + 1;
      return acc;
    }, {});
    
    const currentYear = new Date().getFullYear();
    const currentYearMembers = members.filter(m => m.joinYear == currentYear).length;
    
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#4a5568');
    doc.text('Overall Statistics:');
    doc.moveDown(0.5);
    
    doc.fontSize(12).font('Helvetica').fillColor('#2d3748');
    doc.text(`• Total Members: ${members.length}`);
    doc.text(`• Zones: ${zones}`);
    doc.text(`• Parishes: ${parishes}`);
    doc.text(`• New Members This Year (${currentYear}): ${currentYearMembers}`);
    
    doc.moveDown();
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#4a5568');
    doc.text('Voice Part Distribution:');
    doc.moveDown(0.5);
    
    doc.fontSize(12).font('Helvetica').fillColor('#2d3748');
    Object.entries(parts).forEach(([part, count]) => {
      doc.text(`• ${part}: ${count} members`);
    });
    
    doc.end();
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Helper function to add member to PDF
async function addMemberToPDF(doc, member, serialNumber) {
  const startY = doc.y;
  
  // Serial Number
  doc.fontSize(16).font('Helvetica-Bold')
     .fillColor('#667eea')
     .text(`${serialNumber}.`, 50, startY);
  
  // Photo
  const photoPath = path.join(__dirname, 'uploads', member.photo);
  const hasPhoto = member.photo && fs.existsSync(photoPath);
  
  if (hasPhoto) {
    try {
      doc.image(photoPath, 80, startY - 5, { 
        width: 80, 
        height: 80,
        fit: [80, 80],
        align: 'left'
      });
    } catch (error) {
      console.warn(`Could not load image for ${member.fullName}:`, error.message);
      drawPlaceholderPhoto(doc, 80, startY - 5, member.fullName);
    }
  } else {
    drawPlaceholderPhoto(doc, 80, startY - 5, member.fullName);
  }
  
  // Member Details
  const detailsStartX = 180;
  let currentY = startY;
  
  // Name
  doc.fontSize(14).font('Helvetica-Bold')
     .fillColor('#2d3748')
     .text(member.fullName, detailsStartX, currentY);
  
  currentY += 20;
  
  // Basic Info
  doc.fontSize(10).font('Helvetica')
     .fillColor('#4a5568');
  
  doc.text(`Phone: ${member.phoneNo}`, detailsStartX, currentY);
  doc.text(`Gender: ${member.gender}`, detailsStartX + 200, currentY);
  currentY += 15;
  
  doc.text(`Zone: ${member.zone}`, detailsStartX, currentY);
  doc.text(`Area: ${member.area}`, detailsStartX + 200, currentY);
  currentY += 15;
  
  doc.text(`Parish: ${member.parish}`, detailsStartX, currentY, { width: 300 });
  currentY += 15;
  
  doc.text(`Voice Part: ${member.part}`, detailsStartX, currentY);
  doc.text(`Year Joined: ${member.joinYear}`, detailsStartX + 200, currentY);
  currentY += 15;
  
  // Additional details
  if (member.occupation) {
    doc.text(`Occupation: ${member.occupation}`, detailsStartX, currentY);
    currentY += 15;
  }
  
  if (member.stateOfOrigin || member.homeTown) {
    const origin = [member.stateOfOrigin, member.homeTown].filter(Boolean).join(' - ');
    doc.text(`Origin: ${origin}`, detailsStartX, currentY);
    currentY += 15;
  }
  
  // Positions and Instruments
  if (member.position && member.position.length > 0) {
    doc.text(`Positions: ${member.position.join(', ')}`, detailsStartX, currentY);
    currentY += 15;
  }
  
  if (member.instruments && member.instruments.length > 0) {
    doc.text(`Instruments: ${member.instruments.join(', ')}`, detailsStartX, currentY);
    currentY += 15;
  }
  
  // Address
  if (member.residentialAddress) {
    doc.text(`Address: ${member.residentialAddress}`, detailsStartX, currentY, { 
      width: 300,
      ellipsis: true 
    });
    currentY += 20;
  }
  
  // Set new Y position for next content
  doc.y = Math.max(currentY, startY + 85);
}

// Helper function to draw placeholder photo
function drawPlaceholderPhoto(doc, x, y, name) {
  doc.rect(x, y, 80, 80)
     .fillColor('#f7fafc')
     .fill();
  
  doc.rect(x, y, 80, 80)
     .strokeColor('#e2e8f0')
     .lineWidth(2)
     .stroke();
  
  doc.fontSize(8).font('Helvetica')
     .fillColor('#a0aec0')
     .text('No Photo', x + 20, y + 35);
  
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase();
  doc.fontSize(12).font('Helvetica-Bold')
     .fillColor('#667eea')
     .text(initials, x + 35, y + 50);
}

// Export to CSV
app.get('/api/members/export/csv', async (req, res) => {
  try {
    const members = await Member.find().sort({ fullName: 1 });
    
    const csvData = members.map(member => ({
      serial: members.indexOf(member) + 1,
      name: member.fullName,
      phone: member.phoneNo,
      zone: member.zone,
      area: member.area,
      parish: member.parish,
      part: member.part,
      joinYear: member.joinYear,
      gender: member.gender,
      status: member.status,
      occupation: member.occupation,
      stateOfOrigin: member.stateOfOrigin,
      homeTown: member.homeTown,
      positions: member.position ? member.position.join('; ') : '',
      instruments: member.instruments ? member.instruments.join('; ') : '',
      residentialAddress: member.residentialAddress,
      parishAddress: member.parishAddress,
      hasPhoto: member.photo ? 'Yes' : 'No'
    }));
    
    const csvStringifier = csv({
      header: [
        { id: 'serial', title: 'S/N' },
        { id: 'name', title: 'Full Name' },
        { id: 'phone', title: 'Phone Number' },
        { id: 'zone', title: 'Zone' },
        { id: 'area', title: 'Area' },
        { id: 'parish', title: 'Parish' },
        { id: 'part', title: 'Voice Part' },
        { id: 'joinYear', title: 'Year Joined' },
        { id: 'gender', title: 'Gender' },
        { id: 'status', title: 'Marital Status' },
        { id: 'occupation', title: 'Occupation' },
        { id: 'stateOfOrigin', title: 'State of Origin' },
        { id: 'homeTown', title: 'Home Town' },
        { id: 'positions', title: 'Positions' },
        { id: 'instruments', title: 'Instruments' },
        { id: 'residentialAddress', title: 'Residential Address' },
        { id: 'parishAddress', title: 'Parish Address' },
        { id: 'hasPhoto', title: 'Photo Available' }
      ]
    });
    
    const csvString = csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(csvData);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=choir-members-complete.csv');
    res.send(csvString);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// File serving with error handling
app.get('/uploads/:filename', (req, res) => {
  const filename = req.params.filename;
  const filepath = path.join(__dirname, 'uploads', filename);
  
  if (fs.existsSync(filepath)) {
    res.sendFile(filepath);
  } else {
    res.status(404).json({ success: false, message: 'File not found' });
  }
});

// File cleanup utility
function cleanupOrphanedFiles() {
  const uploadsDir = path.join(__dirname, 'uploads');
  
  if (!fs.existsSync(uploadsDir)) {
    return;
  }
  
  fs.readdir(uploadsDir, async (err, files) => {
    if (err) {
      console.error('Error reading uploads directory:', err);
      return;
    }
    
    try {
      const members = await Member.find({}, 'photo');
      const usedFilenames = members.map(member => member.photo).filter(Boolean);
      
      files.forEach(file => {
        if (!usedFilenames.includes(file)) {
          const filePath = path.join(uploadsDir, file);
          fs.unlink(filePath, (unlinkErr) => {
            if (unlinkErr) {
              console.error('Error deleting orphaned file:', unlinkErr);
            } else {
              console.log('🗑️ Deleted orphaned file:', file);
            }
          });
        }
      });
    } catch (error) {
      console.error('Error during file cleanup:', error);
    }
  });
}

// Create uploads directory on startup
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('📁 Created uploads directory');
}

// Run cleanup on startup
setTimeout(cleanupOrphanedFiles, 5000);

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📁 Uploads directory: ${path.resolve(uploadsDir)}`);
  console.log(`📊 Visit http://localhost:${PORT}/admin to view the admin dashboard`);
});