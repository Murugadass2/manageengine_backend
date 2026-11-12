import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { AuthRequest } from '../middleware/auth.js';

export const getSLAPolicies = async (req: Request, res: Response) => {
  try {
    const policies = await prisma.sLAPolicy.findMany({
      orderBy: { responseMinutes: 'asc' },
    });
    return res.json(policies);
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to fetch SLA policies' });
  }
};

export const updateSLAPolicy = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { responseMinutes, resolutionMinutes, escalationRole, isActive } = req.body;

    const updated = await prisma.sLAPolicy.update({
      where: { id },
      data: {
        responseMinutes: parseInt(responseMinutes),
        resolutionMinutes: parseInt(resolutionMinutes),
        escalationRole,
        isActive,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        action: 'SLA_POLICY_UPDATED',
        entityType: 'SLA',
        entityId: id,
        details: `SLA policy for ${updated.priority} priority updated: Response ${updated.responseMinutes}m, Resolution ${updated.resolutionMinutes}m.`,
      },
    });

    return res.json(updated);
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to update SLA policy' });
  }
};
