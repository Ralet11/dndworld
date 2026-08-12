const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    throw new Error('JWT_SECRET debe estar configurado. El servidor no puede iniciarse con una clave por defecto.');
}

const verifyToken = (req, res, next) => {
    let token = req.headers['authorization'];

    if (!token) {
        return res.status(403).send({ message: "No token provided!" });
    }

    if (token.startsWith('Bearer ')) {
        token = token.slice(7, token.length);
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
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
