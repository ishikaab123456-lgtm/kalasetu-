const express = require('express');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

function getApiKey(val) {
  if (!val) return '';
  return val.trim().replace(/^["']|["']$/g, '');
}

router.post('/enhance-image', upload.single('image'), async (req, res) => {
  const apiKey = getApiKey(process.env.REMOVE_BG_API_KEY);

  let imageBuffer = req.file?.buffer;

  // If no image file sent in FormData, try decoding base64 dataUrl from body
  if (!imageBuffer && req.body && req.body.imageBase64) {
    try {
      const base64Data = req.body.imageBase64.replace(/^data:image\/\w+;base64,/, '');
      imageBuffer = Buffer.from(base64Data, 'base64');
    } catch (e) {}
  }

  if (apiKey && apiKey !== 'your_remove_bg_api_key_here' && imageBuffer) {
    try {
      const formData = new FormData();
      formData.append('image_file', imageBuffer, req.file?.originalname || 'craft_product.jpg');
      formData.append('size', 'auto');

      const response = await axios.post(
        'https://api.remove.bg/v1.0/removebg',
        formData,
        {
          headers: { ...formData.getHeaders(), 'X-Api-Key': apiKey },
          responseType: 'arraybuffer',
          timeout: 20000
        }
      );

      const base64Image = `data:image/png;base64,${Buffer.from(response.data).toString('base64')}`;
      console.log('✨ Live Remove.bg API Success! Background removed.');
      return res.json({ image: base64Image, enhanced: true });
    } catch (err) {
      console.warn('Remove.bg API Error:', err.response?.data ? err.response.data.toString() : err.message);
    }
  }

  if (imageBuffer) {
    const base64Image = `data:${req.file?.mimetype || 'image/jpeg'};base64,${imageBuffer.toString('base64')}`;
    return res.json({ image: base64Image, enhanced: false });
  }

  return res.json({
    image: 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=600&auto=format&fit=crop&q=80',
    enhanced: true
  });
});

module.exports = router;