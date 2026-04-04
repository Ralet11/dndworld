const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
    let token = req.headers['authorization'];

    if (!token) {
        return res.status(403).send({ message: "No token provided!" });
    }

    if (token.startsWith('Bearer ')) {
        token = token.slice(7, token.length);
    }

    jwt.verify(token, process.env.JWT_SECRET || 'dndworld_secret', (err, decoded) => {
        if (err) {
            return res.status(401).send({ message: "Unauthorized!" });
        }
        req.user = decoded;
        next();
    });
};

const isAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'ADMIN') {
        next();
        return;
    }
    res.status(403).send({ message: "Require Admin Role!" });
};

const isDm = (req, res, next) => {
    if (req.user && (req.user.role === 'DM' || req.user.role === 'ADMIN')) {
        next();
        return;
    }
    res.status(403).send({ message: "Require DM Role!" });
};

module.exports = {
    verifyToken,
    isAdmin,
    isDm
};
