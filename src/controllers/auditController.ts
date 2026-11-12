import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';

export const getAuditLogs = async (req: Request, res: Response) => {
  try {
    const { action, entityType, userId, page = '1', limit = '50' } = req.query;
    const where: any = {};

    if (action && action !== 'ALL') where.action = String(action);
    if (entityType && entityType !== 'ALL') where.entityType = String(entityType);
    if (userId && userId !== 'ALL') where.userId = String(userId);

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

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

    return res.json({ logs, total, page: parseInt(page as string) });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
};
