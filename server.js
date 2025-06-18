const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use('/uploads', express.static('uploads'));
app.use(express.json());

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

  if (image) {
    const newFileName = `${Date.now()}-${image.originalname}`;
    const newFilePath = path.join('uploads', newFileName);
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
  fs.writeFileSync(path.join('uploads', jsonFileName), JSON.stringify(record, null, 2));

  console.log('✅ Upload recorded:', record);

  res.status(200).json({ message: 'Upload successful', data: record });
});


const PORT = 3001;
app.listen(PORT, () => console.log(`🚀 API running on port ${PORT}`));
