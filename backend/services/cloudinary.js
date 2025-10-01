const { v2: cloudinary } = require('cloudinary');

const {
  CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET,
  CLOUDINARY_FOLDER = 'dungeonworld'
} = process.env;

if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
  console.warn('Cloudinary env vars missing. Uploads will fail until CLOUDINARY_* are configured.');
}

cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET,
  secure: true,
});

function ensureFolder(options = {}) {
  return { folder: CLOUDINARY_FOLDER, resource_type: 'image', ...options };
}

function uploadBuffer(buffer, options = {}) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(ensureFolder(options), (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });
    stream.end(buffer);
  });
}

async function uploadFromUrl(url, options = {}) {
  return cloudinary.uploader.upload(url, ensureFolder(options));
}

module.exports = {
  cloudinary,
  uploadBuffer,
  uploadFromUrl,
};
