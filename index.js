const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// MongoDB connection
mongoose.connect('mongodb+srv://rtc:rtc@rtc.hiogp8h.mongodb.net/rtc', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

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
  }
});

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// API Routes
app.post('/api/members', upload.single('photo'), async (req, res) => {
  try {
    const memberData = {
      ...req.body,
      photo: req.file ? req.file.filename : ''
    };

    // Convert position to array if it's a string
    if (typeof memberData.position === 'string') {
      memberData.position = [memberData.position];
    }

    const member = new Member(memberData);
    await member.save();
    res.json({ success: true, message: 'Member registered successfully!' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

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

app.get('/api/members/search', async (req, res) => {
  try {
    const searchTerm = req.query.term;
    const members = await Member.find({
      $or: [
        { fullName: { $regex: searchTerm, $options: 'i' } },
        { phoneNo: { $regex: searchTerm, $options: 'i' } },
        { parish: { $regex: searchTerm, $options: 'i' } }
      ]
    }).limit(50);

    res.json(members);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create uploads directory if it doesn't exist
const fs = require('fs');
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});