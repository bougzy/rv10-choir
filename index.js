const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const PDFDocument = require('pdfkit');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// MongoDB connection with better error handling
mongoose.connect('mongodb+srv://rtc:rtc@rtc.hiogp8h.mongodb.net/rtc', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB connected successfully'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// Member Schema - UPDATED with instruments field
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

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname)
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
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// API Routes - Enhanced with better logging
app.post('/api/members', upload.single('photo'), async (req, res) => {
  console.log('📥 Received form submission:', req.body);
  console.log('📁 File received:', req.file);
  
  try {
    const memberData = {
      ...req.body,
      photo: req.file ? req.file.filename : ''
    };

    // Convert position to array if it's a string or handle multiple checkboxes
    if (typeof memberData.position === 'string') {
      memberData.position = [memberData.position];
    } else if (Array.isArray(memberData.position)) {
      // Already an array, keep as is
    } else {
      memberData.position = [];
    }

    // Convert instruments to array if it's a string or handle multiple checkboxes
    if (typeof memberData.instruments === 'string') {
      memberData.instruments = [memberData.instruments];
    } else if (Array.isArray(memberData.instruments)) {
      // Already an array, keep as is
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
      memberId: savedMember._id 
    });
  } catch (error) {
    console.error('❌ Error saving member:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to save member: ' + error.message 
    });
  }
});

// NEW: Get single member by ID
app.get('/api/members/:id', async (req, res) => {
  try {
    const member = await Member.findById(req.params.id);
    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }
    res.json({ success: true, member });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// NEW: Update member
app.put('/api/members/:id', upload.single('photo'), async (req, res) => {
  try {
    const memberId = req.params.id;
    const updateData = { ...req.body };

    // Handle array fields
    if (typeof updateData.position === 'string') {
      updateData.position = [updateData.position];
    } else if (!Array.isArray(updateData.position)) {
      updateData.position = [];
    }

    if (typeof updateData.instruments === 'string') {
      updateData.instruments = [updateData.instruments];
    } else if (!Array.isArray(updateData.instruments)) {
      updateData.instruments = [];
    }

    // Handle photo update
    if (req.file) {
      updateData.photo = req.file.filename;
      
      // Delete old photo if exists
      const oldMember = await Member.findById(memberId);
      if (oldMember.photo) {
        const oldPhotoPath = path.join(__dirname, 'uploads', oldMember.photo);
        if (fs.existsSync(oldPhotoPath)) {
          fs.unlinkSync(oldPhotoPath);
        }
      }
    }

    const updatedMember = await Member.findByIdAndUpdate(
      memberId, 
      updateData, 
      { new: true, runValidators: true }
    );

    if (!updatedMember) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    res.json({ 
      success: true, 
      message: 'Member updated successfully!',
      member: updatedMember 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// NEW: Delete member
app.delete('/api/members/:id', async (req, res) => {
  try {
    const memberId = req.params.id;
    const member = await Member.findById(memberId);
    
    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    // Delete photo file if exists
    if (member.photo) {
      const photoPath = path.join(__dirname, 'uploads', member.photo);
      if (fs.existsSync(photoPath)) {
        fs.unlinkSync(photoPath);
      }
    }

    await Member.findByIdAndDelete(memberId);
    
    res.json({ 
      success: true, 
      message: 'Member deleted successfully!' 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get all members with pagination
app.get('/api/members', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const members = await Member.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Member.countDocuments();
    const totalPages = Math.ceil(total / limit);

    res.json({
      members,
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

// Search members
app.get('/api/members/search', async (req, res) => {
  try {
    const searchTerm = req.query.term;
    const members = await Member.find({
      $or: [
        { fullName: { $regex: searchTerm, $options: 'i' } },
        { phoneNo: { $regex: searchTerm, $options: 'i' } },
        { parish: { $regex: searchTerm, $options: 'i' } },
        { zone: { $regex: searchTerm, $options: 'i' } },
        { area: { $regex: searchTerm, $options: 'i' } }
      ]
    }).limit(50);

    res.json(members);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get all unique zones for filter
app.get('/api/zones', async (req, res) => {
  try {
    const zones = await Member.distinct('zone');
    res.json(zones.filter(zone => zone)); // Remove null/empty values
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Test route to check database connection and existing data
app.get('/api/test', async (req, res) => {
  try {
    const count = await Member.countDocuments();
    const members = await Member.find().limit(5);
    
    res.json({
      success: true,
      message: 'Database connection successful',
      totalMembers: count,
      sampleMembers: members
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Database error: ' + error.message
    });
  }
});


// NEW: Get all members without pagination (for export/print)
app.get('/api/members/all', async (req, res) => {
  try {
    const members = await Member.find().sort({ fullName: 1 });
    res.json({ success: true, members });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});



// NEW: Generate PDF report
app.get('/api/members/export/pdf', async (req, res) => {
  try {
    const members = await Member.find().sort({ fullName: 1 });
    
    const doc = new PDFDocument({ margin: 50 });
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=choir-members-report.pdf');
    
    doc.pipe(res);
    
    // Add title
    doc.fontSize(20).font('Helvetica-Bold').text('CHOIR MEMBERS REPORT', 50, 50);
    doc.fontSize(12).font('Helvetica').text(`Generated on: ${new Date().toLocaleDateString()}`, 50, 80);
    doc.fontSize(12).text(`Total Members: ${members.length}`, 50, 95);
    
    let yPosition = 130;
    
    members.forEach((member, index) => {
      // Check if we need a new page
      if (yPosition > 700) {
        doc.addPage();
        yPosition = 50;
      }
      
      // Member header
      doc.fontSize(14).font('Helvetica-Bold').text(`${index + 1}. ${member.fullName}`, 50, yPosition);
      yPosition += 25;
      
      // Member details
      doc.fontSize(10).font('Helvetica');
      doc.text(`Phone: ${member.phoneNo}`, 50, yPosition);
      doc.text(`Zone: ${member.zone}`, 200, yPosition);
      doc.text(`Area: ${member.area}`, 350, yPosition);
      yPosition += 15;
      
      doc.text(`Parish: ${member.parish}`, 50, yPosition);
      doc.text(`Voice Part: ${member.part}`, 200, yPosition);
      doc.text(`Joined: ${member.joinYear}`, 350, yPosition);
      yPosition += 15;
      
      doc.text(`Occupation: ${member.occupation}`, 50, yPosition);
      doc.text(`Gender: ${member.gender}`, 200, yPosition);
      doc.text(`Status: ${member.status}`, 350, yPosition);
      yPosition += 15;
      
      if (member.position && member.position.length > 0) {
        doc.text(`Positions: ${member.position.join(', ')}`, 50, yPosition);
        yPosition += 15;
      }
      
      if (member.instruments && member.instruments.length > 0) {
        doc.text(`Instruments: ${member.instruments.join(', ')}`, 50, yPosition);
        yPosition += 15;
      }
      
      yPosition += 10; // Space between members
    });
    
    doc.end();
    
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// NEW: Generate CSV export
app.get('/api/members/export/csv', async (req, res) => {
  try {
    const members = await Member.find().sort({ fullName: 1 });
    
    // CSV headers
    const headers = [
      'Full Name',
      'Phone Number',
      'Zone',
      'Area',
      'Parish',
      'Voice Part',
      'Year Joined',
      'Gender',
      'Marital Status',
      'Occupation',
      'State of Origin',
      'Home Town',
      'Positions',
      'Instruments',
      'Residential Address',
      'Parish Address'
    ];
    
    let csvContent = headers.join(',') + '\n';
    
    members.forEach(member => {
      const row = [
        `"${member.fullName}"`,
        `"${member.phoneNo}"`,
        `"${member.zone}"`,
        `"${member.area}"`,
        `"${member.parish}"`,
        `"${member.part}"`,
        `"${member.joinYear}"`,
        `"${member.gender}"`,
        `"${member.status}"`,
        `"${member.occupation}"`,
        `"${member.stateOfOrigin}"`,
        `"${member.homeTown}"`,
        `"${(member.position || []).join('; ')}"`,
        `"${(member.instruments || []).join('; ')}"`,
        `"${member.residentialAddress}"`,
        `"${member.parishAddress}"`
      ];
      
      csvContent += row.join(',') + '\n';
    });
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=choir-members.csv');
    res.send(csvContent);
    
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});


// Get all members with pagination
app.get('/api/members', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const members = await Member.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Member.countDocuments();
    const totalPages = Math.ceil(total / limit);

    res.json({
      members,
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

// Search members
app.get('/api/members/search', async (req, res) => {
  try {
    const searchTerm = req.query.term;
    const members = await Member.find({
      $or: [
        { fullName: { $regex: searchTerm, $options: 'i' } },
        { phoneNo: { $regex: searchTerm, $options: 'i' } },
        { parish: { $regex: searchTerm, $options: 'i' } },
        { zone: { $regex: searchTerm, $options: 'i' } },
        { area: { $regex: searchTerm, $options: 'i' } }
      ]
    }).limit(50);

    res.json(members);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get all unique zones for filter
app.get('/api/zones', async (req, res) => {
  try {
    const zones = await Member.distinct('zone');
    res.json(zones.filter(zone => zone)); // Remove null/empty values
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Test route to check database connection and existing data
app.get('/api/test', async (req, res) => {
  try {
    const count = await Member.countDocuments();
    const members = await Member.find().limit(5);
    
    res.json({
      success: true,
      message: 'Database connection successful',
      totalMembers: count,
      sampleMembers: members
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Database error: ' + error.message
    });
  }
});

// Create uploads directory if it doesn't exist
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
  console.log('📁 Created uploads directory');
}

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Visit http://localhost:${PORT}/admin to view the admin dashboard`);
});