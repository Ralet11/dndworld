const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const axios = require("axios");
const FormData = require("form-data");
const { OpenAI } = require("openai");
const {
  Creature,
  MediaAsset,
  CharacterInventory,
  Item,
} = require("../models");
const { uploadBuffer } = require("./cloudinary");

const TMP_DIR = "/tmp";
const BASE_PROMPT = process.env.PORTRAIT_BASE_PROMPT || "High quality fantasy character portrait";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

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

async function loadCreature(characterId) {
  const creature = await Creature.findByPk(characterId, {
    include: [{ model: MediaAsset, as: "portrait" }],
  });
  if (!creature) {
    throw new Error(`Creature ${characterId} not found`);
  }
  if (!creature.portrait) {
    throw new Error("Creature has no portrait configured");
  }
  return creature;
}

async function gatherEquipmentPrompts(characterId) {
  const items = await CharacterInventory.findAll({
    where: { characterId, equipped: true },
    include: [Item],
  });
  const prompts = [];
  for (const entry of items) {
    const prompt = entry?.Item?.meta?.prompt;
    if (prompt) prompts.push(prompt);
  }
  return prompts;
}

async function downloadPortrait(sourceUrl, characterId) {
  const response = await axios.get(sourceUrl, { responseType: "arraybuffer" });
  const filePath = path.join(TMP_DIR, `portrait-${characterId}-${Date.now()}.png`);
  await fsp.writeFile(filePath, Buffer.from(response.data));
  return filePath;
}

async function generatePortrait(imagePath, prompt) {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const form = new FormData();
  form.append("image", fs.createReadStream(imagePath), {
    filename: path.basename(imagePath),
    contentType: "image/png",
  });
  form.append("prompt", prompt);
  form.append("n", "1");
  form.append("size", "1024x1024");

  const headers = {
    ...form.getHeaders(),
    Authorization: `Bearer ${openai.apiKey || OPENAI_API_KEY}`,
    Accept: "image/png",
  };

  const endpoint = `${openai.baseURL || "https://api.openai.com/v1"}/images/edits`;
  const response = await axios.post(endpoint, form, {
    headers,
    responseType: "arraybuffer",
  });
  return Buffer.from(response.data);
}

async function renderCharacterPortrait(characterId) {
  const creature = await loadCreature(characterId);
  const equipmentPrompts = await gatherEquipmentPrompts(characterId);
  const sourceUrl = creature.portrait.meta?.secureUrl || creature.portrait.url;
  if (!sourceUrl) {
    throw new Error("Portrait asset does not have a valid url");
  }

  const promptParts = [BASE_PROMPT, ...equipmentPrompts].filter(Boolean);
  const finalPrompt = promptParts.join("\n");

  const imagePath = await downloadPortrait(sourceUrl, characterId);
  let editedBuffer;
  try {
    editedBuffer = await generatePortrait(imagePath, finalPrompt);
  } finally {
    await fsp.unlink(imagePath).catch(() => {});
  }

  const uploadResult = await uploadBuffer(editedBuffer, {
    filename: `character-${characterId}-portrait.png`,
  });

  const asset = await MediaAsset.create({
    kind: "image",
    url: uploadResult?.secure_url || uploadResult?.url,
    meta: buildMeta(uploadResult),
  });

  creature.portraitAssetId = asset.id;
  await creature.save();

  return asset.url;
}

module.exports = {
  renderCharacterPortrait,
};
