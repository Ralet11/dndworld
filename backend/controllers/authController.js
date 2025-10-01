const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { User, UserRole, DmApplication } = require("../models");

function sign(user) {
  const payload = { id: user.id, email: user.email };
  const token = jwt.sign(payload, process.env.JWT_SECRET || "devsecret", { expiresIn: "7d" });
  return token;
}

exports.signup = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: "Missing fields" });
    const exists = await User.findOne({ where: { email } });
    if (exists) return res.status(409).json({ error: "Email already used" });
    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, passwordHash: hash });
    await UserRole.create({ userId: user.id, role: "PLAYER" });
    const token = sign(user);
    res.json({ token, user: { id: user.id, name, email, roles: ["PLAYER"] } });
  } catch (e) { next(e); }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email }, include: [UserRole] });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });
    const token = sign(user);
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, roles: user.UserRoles.map(r=>r.role) } });
  } catch (e) { next(e); }
};

exports.me = async (req, res) => {
  res.json({ user: req.user });
};

exports.requestDm = async (req, res, next) => {
  try {
    const app = await DmApplication.create({ userId: req.user.id, note: req.body?.note || null });
    res.json(app);
  } catch (e) { next(e); }
};

exports.reviewDm = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const app = await DmApplication.findByPk(id);
    if (!app) return res.status(404).json({ error: "Not found" });
    app.status = status;
    app.reviewedBy = req.user.id;
    await app.save();
    if (status === "APPROVED") {
      await UserRole.findOrCreate({ where: { userId: app.userId, role: "DM" }, defaults: { userId: app.userId, role: "DM" } });
    }
    res.json(app);
  } catch (e) { next(e); }
};
