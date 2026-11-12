import { prisma } from '../lib/prisma.js';
export const getAuditLogs = async (req, res) => {
    try {
        const { action, entityType, userId, page = '1', limit = '50' } = req.query;
        const where = {};
        if (action && action !== 'ALL')
            where.action = String(action);
        if (entityType && entityType !== 'ALL')
            where.entityType = String(entityType);
        if (userId && userId !== 'ALL')
            where.userId = String(userId);
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const take = parseInt(limit);
        const [logs, total] = await Promise.all([
            prisma.auditLog.findMany({
                where,
                include: {
                    user: { select: { id: true, name: true, email: true, role: true } },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take,
            }),
            prisma.auditLog.count({ where }),
        ]);
        return res.json({ logs, total, page: parseInt(page) });
    }
    catch (error) {
        return res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
};
