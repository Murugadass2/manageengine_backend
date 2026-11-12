import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
const JWT_SECRET = process.env.JWT_SECRET || 'hotel-dazzle-drop-super-secret-jwt-key-2026';
export const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        // If no token provided in demo/dev mode, allow using default admin or extract demo-role header
        const demoRole = req.headers['x-demo-role'];
        if (demoRole) {
            const user = await prisma.user.findFirst({
                where: { role: demoRole },
                include: { department: true }
            });
            if (user) {
                req.user = {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role,
                    departmentId: user.departmentId,
                    employeeCode: user.employeeCode,
                };
                return next();
            }
        }
        return res.status(401).json({ error: 'Access token required' });
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    }
    catch (err) {
        return res.status(403).json({ error: 'Invalid or expired token' });
    }
};
export const requireRoles = (roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        if (!roles.includes(req.user.role) && req.user.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'Insufficient permissions for this action' });
        }
        next();
    };
};
