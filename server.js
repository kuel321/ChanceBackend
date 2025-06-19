const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const upload = multer({ dest: 'uploads/' });

const UPLOAD_DIR = path.join(__dirname, 'uploads');
const APPROVED_DIR = path.join(__dirname, 'public', 'approved');

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(APPROVED_DIR)) fs.mkdirSync(APPROVED_DIR, { recursive: true });

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));
app.use('/approved', express.static(path.join('public', 'approved')));

// ---------- Upload Route ----------
app.post('/api/upload', upload.single('image'), (req, res) => {
  console.log('🔔 /api/upload endpoint hit');

  const storyText = req.body.story;
  const image = req.file;

  if (!storyText) {
    console.log('⚠️ Missing story');
    return res.status(400).json({ message: 'Missing story text' });
  }

  const metadata = {
    ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'] || 'unknown',
    referer: req.headers['referer'] || 'none',
    timestamp: new Date().toISOString(),
  };

  let imageUrl = null;
  let fileInfo = null;
  let newFileName = null;

  if (image) {
    newFileName = `${Date.now()}-${image.originalname}`;
    const newFilePath = path.join(UPLOAD_DIR, newFileName);
    fs.renameSync(image.path, newFilePath);

    imageUrl = `/uploads/${newFileName}`;
    fileInfo = {
      originalName: image.originalname,
      mimeType: image.mimetype,
      size: image.size,
    };
  }

  const record = {
    story: storyText,
    imageUrl,
    fileInfo,
    metadata,
  };

  const jsonFileName = `${Date.now()}.json`;
  fs.writeFileSync(path.join(UPLOAD_DIR, jsonFileName), JSON.stringify(record, null, 2));

  console.log('✅ Upload recorded:', record);
  res.status(200).json({ message: 'Upload successful', data: record });
});

// ---------- View Approved Submissions ----------
// ---------- View Approved Submissions ----------
app.get('/api/approved', (req, res) => {
  const files = fs.readdirSync(APPROVED_DIR).filter(f => f.endsWith('.json'));

  const stories = files.map(file => {
    const jsonPath = path.join(APPROVED_DIR, file);
    const data = fs.readFileSync(jsonPath);
    return {
      ...JSON.parse(data),
      jsonFileName: file // ✅ Add this so frontend can call unapprove
    };
  });

  res.json(stories);
});


// ---------- View Unapproved Submissions ----------
app.get('/api/unapproved', (req, res) => {
  const files = fs.readdirSync(UPLOAD_DIR).filter(f => f.endsWith('.json'));

  const stories = files.map(file => {
    const jsonPath = path.join(UPLOAD_DIR, file);
    const data = fs.readFileSync(jsonPath);
    return {
      ...JSON.parse(data),
      jsonFileName: file // ✅ Needed for frontend to call approve
    };
  });

  res.json(stories);
});

// ---------- Approve Submission ----------
app.post('/api/approve/:jsonFileName', (req, res) => {
  const jsonFileName = req.params.jsonFileName;
  console.log('Approving:', jsonFileName);
  const jsonPath = path.join(UPLOAD_DIR, jsonFileName);

  if (!fs.existsSync(jsonPath)) {
    console.log('❌ File not found:', jsonPath);
    return res.status(404).json({ message: 'JSON file not found' });
  }

  const record = JSON.parse(fs.readFileSync(jsonPath));

  // Move image if it exists
  if (record.imageUrl) {
    const imageName = path.basename(record.imageUrl);
    const oldImagePath = path.join(UPLOAD_DIR, imageName);
    const newImagePath = path.join(APPROVED_DIR, imageName);

    if (fs.existsSync(oldImagePath)) {
      fs.renameSync(oldImagePath, newImagePath);
      record.imageUrl = `/approved/${imageName}`;
    }
  }

  const approvedJsonPath = path.join(APPROVED_DIR, jsonFileName);
  fs.writeFileSync(approvedJsonPath, JSON.stringify(record, null, 2));

  console.log(`✅ Approved: ${jsonFileName}`);
  res.json({ message: 'Approved and moved', record });
});

app.post('/api/unapprove/:jsonFileName', (req, res) => {
  const jsonFileName = req.params.jsonFileName;
  const jsonPath = path.join(APPROVED_DIR, jsonFileName);

  if (!fs.existsSync(jsonPath)) {
    return res.status(404).json({ message: 'JSON file not found in approved directory' });
  }

  const record = JSON.parse(fs.readFileSync(jsonPath));

  // Move image back if it exists
  if (record.imageUrl) {
    const imageName = path.basename(record.imageUrl);
    const oldImagePath = path.join(APPROVED_DIR, imageName);
    const newImagePath = path.join(UPLOAD_DIR, imageName);

    if (fs.existsSync(oldImagePath)) {
      fs.renameSync(oldImagePath, newImagePath);
      record.imageUrl = `/uploads/${imageName}`;
    }
  }

  const unapprovedJsonPath = path.join(UPLOAD_DIR, jsonFileName);
  fs.writeFileSync(unapprovedJsonPath, JSON.stringify(record, null, 2));

  // Delete the approved JSON file
  fs.unlinkSync(jsonPath);

  console.log(`🔁 Unapproved: ${jsonFileName}`);
  res.json({ message: 'Unapproved and moved back', record });
});


// ---------- Start Server ----------
const PORT = 3001;
app.listen(PORT, () => {
  console.log(`🚀 API running on port ${PORT}`);
});
