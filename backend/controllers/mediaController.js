const { MediaAsset } = require("../models");
const { uploadBuffer, uploadFromUrl } = require("../services/cloudinary");

function buildMeta(result) {
  if (!result) return {};
  return {
    publicId: result.public_id,
    format: result.format,
    bytes: result.bytes,
    width: result.width,
    height: result.height,
    secureUrl: result.secure_url,
    version: result.version,
  };
}

exports.createMedia = async (req, res, next) => {
  try {
    const kind = req.body.kind || "image";
    let url = req.body.url ? String(req.body.url).trim() : null;
    const file = req.file || null;

    if (!url && !file) {
      return res.status(400).json({ error: "Se requiere una url o un archivo" });
    }

    let uploadResult = null;
    if (file) {
      uploadResult = await uploadBuffer(file.buffer, { filename: file.originalname });
      url = uploadResult.secure_url;
    } else if (url) {
      uploadResult = await uploadFromUrl(url);
      url = uploadResult.secure_url;
    }

    if (!url) {
      return res.status(500).json({ error: "No se pudo obtener la url del asset" });
    }

    const asset = await MediaAsset.create({
      kind,
      url,
      meta: buildMeta(uploadResult),
    });

    res.json({ id: asset.id, url: asset.url, meta: asset.meta, kind: asset.kind });
  } catch (e) {
    next(e);
  }
};

exports.getMedia = async (req, res, next) => {
  try {
    const row = await MediaAsset.findByPk(req.params.id);
    if (!row) return res.status(404).json({ error:"Not found" });
    res.json(row);
  } catch (e) { next(e); }
};
