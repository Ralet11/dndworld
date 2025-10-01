const jwt = require("jsonwebtoken");
const { User, UserRole } = require("../models");

function auth(required = true) {
  return async (req, res, next) => {
    try {
      const hdr = req.headers.authorization || "";
      const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;
      if (!token) {
        if (required) return res.status(401).json({ error: "No token" });
        req.user = null; return next();
      }
      const payload = jwt.verify(token, process.env.JWT_SECRET || "devsecret");
      const user = await User.findByPk(payload.id, { include: [{ model: UserRole }] });
      if (!user) return res.status(401).json({ error: "Invalid token" });
      req.user = {
        id: user.id,
        email: user.email,
        name: user.name,
        roles: (user.UserRoles || []).map(r => r.role)
      };
      next();
    } catch (e) { next(e); }
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    if (!req.user.roles?.includes(role)) return res.status(403).json({ error: "Forbidden" });
    next();
  }
}

module.exports = { auth, requireRole };
