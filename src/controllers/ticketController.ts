import { Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { AuthRequest } from '../middleware/auth.js';

// Auto generate ticket ID: HD-2026-XXXXXX
export const generateTicketNumber = async (): Promise<string> => {
  const year = new Date().getFullYear();
  const count = await prisma.ticket.count();
  const nextNum = (count + 1).toString().padStart(6, '0');
  return `HD-${year}-${nextNum}`;
};

// Calculate SLA deadlines based on priority
export const calculateSLADeadlines = async (priority: string) => {
  const policy = await prisma.sLAPolicy.findUnique({
    where: { priority },
  });

  const responseMinutes = policy ? policy.responseMinutes : 120;
  const resolutionMinutes = policy ? policy.resolutionMinutes : 720;

  const now = new Date();
  const responseDueAt = new Date(now.getTime() + responseMinutes * 60 * 1000);
  const resolutionDueAt = new Date(now.getTime() + resolutionMinutes * 60 * 1000);

  return { responseDueAt, resolutionDueAt };
};

// Auto assignment: pick technician in department with lowest active workload
export const autoAssignTechnician = async (departmentId: string): Promise<string | null> => {
  const technicians = await prisma.user.findMany({
    where: {
      departmentId,
      role: 'TECHNICIAN',
      status: 'ACTIVE',
    },
    include: {
      assignedTickets: {
        where: {
          status: { in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'] },
        },
      },
    },
  });

  if (!technicians.length) {
    return null;
  }

  // Sort by lowest active ticket count
  technicians.sort((a, b) => a.assignedTickets.length - b.assignedTickets.length);
  return technicians[0].id;
};

// Get tickets with role-based filtering, search and tabs
export const getTickets = async (req: AuthRequest, res: Response) => {
  try {
    const {
      status,
      priority,
      departmentId,
      assignedTechnicianId,
      requesterId,
      type,
      search,
      page = '1',
      limit = '50',
    } = req.query;

    const user = req.user;
    const where: any = {};

    // Role-based visibility enforcement
    if (user?.role === 'EMPLOYEE') {
      where.OR = [
        { requesterId: user.id },
        ...(user.departmentId ? [{ departmentId: user.departmentId }] : []),
      ];
    } else if (user?.role === 'TECHNICIAN') {
      where.departmentId = user.departmentId || '__no_department__';
      if (req.query.myTasks === 'true') {
        where.assignedTechnicianId = user.id;
      } else {
        where.OR = [
          { assignedTechnicianId: null },
          { assignedTechnicianId: user.id },
        ];
      }
    } else if (user?.role === 'DEPT_MANAGER') {
      where.departmentId = user.departmentId || '__no_department__';
    }

    if (status && status !== 'ALL') {
      where.status = status;
    }
    if (priority && priority !== 'ALL') {
      where.priority = priority;
    }
    if (
      departmentId &&
      departmentId !== 'ALL' &&
      user?.role !== 'TECHNICIAN' &&
      user?.role !== 'DEPT_MANAGER' &&
      user?.role !== 'EMPLOYEE'
    ) {
      where.departmentId = departmentId;
    }
    if (assignedTechnicianId && user?.role !== 'TECHNICIAN') {
      where.assignedTechnicianId = assignedTechnicianId;
    }
    if (requesterId && user?.role !== 'EMPLOYEE') {
      where.requesterId = requesterId;
    }
    if (type && type !== 'ALL') {
      where.type = type;
    }

    if (search) {
      const searchStr = String(search).trim();
      where.AND = [{
        OR: [
          { ticketNumber: { contains: searchStr } },
          { subject: { contains: searchStr } },
          { description: { contains: searchStr } },
          { location: { contains: searchStr } },
        ],
      }];
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const [tickets, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        include: {
          requester: { select: { id: true, name: true, email: true, employeeCode: true, phone: true } },
          department: { select: { id: true, name: true, code: true } },
          assignedTechnician: { select: { id: true, name: true, email: true, employeeCode: true } },
          asset: { select: { id: true, assetTag: true, name: true } },
          comments: { select: { id: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.ticket.count({ where }),
    ]);

    // Augment with SLA countdown and breached status
    const now = new Date().getTime();
    const augmentedTickets = tickets.map((t) => {
      const resolutionDue = new Date(t.resolutionDueAt).getTime();
      const remainingMs = resolutionDue - now;
      const isBreached = remainingMs < 0 && !['RESOLVED', 'CLOSED', 'CANCELLED'].includes(t.status);
      return {
        ...t,
        remainingMs,
        isBreached,
      };
    });

    return res.json({
      tickets: augmentedTickets,
      total,
      page: parseInt(page as string),
      totalPages: Math.ceil(total / take),
    });
  } catch (error: any) {
    console.error('Error fetching tickets:', error);
    return res.status(500).json({ error: 'Failed to fetch tickets' });
  }
};

// Get single ticket details
export const getTicketDetails = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const ticket = await prisma.ticket.findFirst({
      where: {
        OR: [{ id }, { ticketNumber: id }],
      },
      include: {
        requester: { select: { id: true, name: true, email: true, employeeCode: true, phone: true, department: true } },
        department: true,
        assignedTechnician: { select: { id: true, name: true, email: true, employeeCode: true, phone: true } },
        asset: true,
        comments: {
          include: {
            user: { select: { id: true, name: true, role: true, avatarUrl: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        workLogs: {
          include: {
            technician: { select: { id: true, name: true, employeeCode: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        history: {
          include: {
            actor: { select: { id: true, name: true, role: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        attachments: true,
        approvals: true,
      },
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Employees can view their own tickets and tickets routed to their department.
    if (
      req.user?.role === 'EMPLOYEE' &&
      ticket.requesterId !== req.user.id &&
      ticket.departmentId !== req.user.departmentId
    ) {
      return res.status(403).json({ error: 'Unauthorized to view this ticket' });
    }
    if (req.user?.role === 'TECHNICIAN' && ticket.departmentId !== req.user.departmentId) {
      return res.status(403).json({ error: 'Ticket belongs to another department' });
    }
    if (req.user?.role === 'DEPT_MANAGER' && ticket.departmentId !== req.user.departmentId) {
      return res.status(403).json({ error: 'Ticket belongs to another department' });
    }

    // If employee viewing, filter out internal technician notes
    if (req.user?.role === 'EMPLOYEE') {
      ticket.comments = ticket.comments.filter((c) => !c.isInternal);
    }

    const now = new Date().getTime();
    const resolutionDue = new Date(ticket.resolutionDueAt).getTime();
    const remainingMs = resolutionDue - now;
    const isBreached = remainingMs < 0 && !['RESOLVED', 'CLOSED', 'CANCELLED'].includes(ticket.status);

    return res.json({
      ...ticket,
      remainingMs,
      isBreached,
    });
  } catch (error: any) {
    console.error('Error fetching ticket details:', error);
    return res.status(500).json({ error: 'Failed to fetch ticket details' });
  }
};

// Create new ticket
export const createTicket = async (req: AuthRequest, res: Response) => {
  try {
    const {
      subject,
      description,
      departmentId,
      priority = 'MEDIUM',
      type = 'SERVICE_REQUEST',
      impact = 'MEDIUM',
      urgency = 'MEDIUM',
      location,
      assetId,
      assignedTechnicianId: manualTechnicianId,
    } = req.body;

    if (!subject || !description || !departmentId) {
      return res.status(400).json({ error: 'Subject, description, and department are required' });
    }

    const requesterId = req.user?.id;
    if (!requesterId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const department = await prisma.department.findUnique({
      where: { id: departmentId },
      include: {
        users: {
          where: { status: 'ACTIVE' },
          select: { id: true },
        },
        manager: { select: { id: true, status: true } },
      },
    });
    if (!department) {
      return res.status(404).json({ error: 'Department not found' });
    }

    const ticketNumber = await generateTicketNumber();
    const { responseDueAt, resolutionDueAt } = await calculateSLADeadlines(priority);

    // Keep requests in the department queue unless a manager explicitly assigned a technician.
    let assignedTechnicianId = manualTechnicianId;
    const initialStatus = assignedTechnicianId ? 'ASSIGNED' : 'NEW';

    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        subject,
        description,
        type,
        priority,
        impact,
        urgency,
        status: initialStatus,
        location,
        assetId: assetId || null,
        requesterId,
        departmentId,
        assignedTechnicianId: assignedTechnicianId || null,
        responseDueAt,
        resolutionDueAt,
      },
      include: {
        requester: true,
        department: true,
        assignedTechnician: true,
      },
    });

    // History record
    await prisma.ticketHistory.create({
      data: {
        ticketId: ticket.id,
        actorId: requesterId,
        action: 'TICKET_CREATED',
        details: `Ticket created by ${req.user?.name}. Status: ${initialStatus}.`,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: requesterId,
        action: 'TICKET_CREATED',
        entityType: 'TICKET',
        entityId: ticket.id,
        details: `Ticket ${ticket.ticketNumber} created for ${ticket.department.name}. Priority: ${priority}.`,
        ipAddress: req.ip || '127.0.0.1',
      },
    });

    // Notify the department team so they can claim and work the unassigned ticket.
    const recipientIds = new Set(
      assignedTechnicianId ? [] : department.users.map((member) => member.id)
    );
    if (department.manager?.status === 'ACTIVE') {
      recipientIds.add(department.manager.id);
    }
    if (assignedTechnicianId) {
      recipientIds.add(assignedTechnicianId);
    }
    if (recipientIds.size > 0) {
      await prisma.notification.createMany({
        data: Array.from(recipientIds, (userId) => ({
          userId,
          title: assignedTechnicianId
            ? `New Ticket Assigned: ${ticket.ticketNumber}`
            : `New Department Ticket: ${ticket.ticketNumber}`,
          message: `${ticket.subject} (${priority} Priority) at ${location || 'Hotel'}.`,
          type: 'TICKET',
          linkUrl: `/tickets/${ticket.ticketNumber}`,
        })),
      });
    }

    return res.status(201).json(ticket);
  } catch (error: any) {
    console.error('Error creating ticket:', error);
    return res.status(500).json({ error: 'Failed to create ticket' });
  }
};

// Update status (lifecycle transition)
export const updateTicketStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, remarks } = req.body;

    const existingTicket = await prisma.ticket.findFirst({
      where: { OR: [{ id }, { ticketNumber: id }] },
      include: { requester: true, assignedTechnician: true },
    });

    if (!existingTicket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    if (status === 'ACCEPTED') {
      return res.status(400).json({ error: 'Use the assignment response action to accept this ticket' });
    }

    if (['IN_PROGRESS', 'RESOLVED'].includes(status)) {
      if (
        !['TECHNICIAN', 'EMPLOYEE'].includes(req.user?.role || '') ||
        existingTicket.departmentId !== req.user?.departmentId ||
        existingTicket.assignedTechnicianId !== req.user.id
      ) {
        return res.status(403).json({ error: 'Only the assigned department team member can work on this ticket' });
      }
      const validTransition =
        (status === 'IN_PROGRESS' && existingTicket.status === 'ACCEPTED') ||
        (status === 'RESOLVED' && existingTicket.status === 'IN_PROGRESS');
      if (!validTransition) {
        return res.status(400).json({ error: 'Accept the ticket before starting or resolving work' });
      }
    } else if (
      ['TECHNICIAN', 'EMPLOYEE'].includes(req.user?.role || '') &&
      existingTicket.departmentId === req.user?.departmentId
    ) {
      return res.status(403).json({ error: 'Department team members can only start or resolve accepted tickets' });
    }

    const oldStatus = existingTicket.status;
    const updateData: any = { status };

    if (status === 'IN_PROGRESS' && !existingTicket.firstRespondedAt) {
      updateData.firstRespondedAt = new Date();
    }
    if (status === 'RESOLVED') {
      updateData.resolvedAt = new Date();
      updateData.resolutionNotes = remarks || 'Marked as resolved';
    }
    if (status === 'CLOSED') {
      updateData.closedAt = new Date();
    }

    const updated = await prisma.ticket.update({
      where: { id: existingTicket.id },
      data: updateData,
      include: {
        requester: true,
        assignedTechnician: true,
        department: true,
      },
    });

    // Record history
    await prisma.ticketHistory.create({
      data: {
        ticketId: existingTicket.id,
        actorId: req.user?.id,
        action: 'STATUS_CHANGE',
        fieldChanged: 'status',
        oldValue: oldStatus,
        newValue: status,
        details: remarks || `Status changed from ${oldStatus} to ${status} by ${req.user?.name}`,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        action: 'STATUS_CHANGED',
        entityType: 'TICKET',
        entityId: existingTicket.id,
        details: `Ticket ${existingTicket.ticketNumber} status updated to ${status}.`,
      },
    });

    // Send notifications to requester or technician based on status
    if (status === 'RESOLVED' && existingTicket.requesterId) {
      await prisma.notification.create({
        data: {
          userId: existingTicket.requesterId,
          title: `Ticket Resolved: ${existingTicket.ticketNumber}`,
          message: `Your request "${existingTicket.subject}" has been marked as resolved. Please review and confirm closure.`,
          type: 'TICKET',
          linkUrl: `/tickets/${existingTicket.ticketNumber}`,
        },
      });
    }

    return res.json(updated);
  } catch (error: any) {
    console.error('Error updating status:', error);
    return res.status(500).json({ error: 'Failed to update ticket status' });
  }
};

// Claim a department ticket or reject an explicit assignment.
export const handleAssignmentResponse = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { action, reason } = req.body; // action: 'ACCEPT' | 'REJECT'

    const ticket = await prisma.ticket.findFirst({
      where: { OR: [{ id }, { ticketNumber: id }] },
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    if (
      !['TECHNICIAN', 'EMPLOYEE'].includes(req.user?.role || '') ||
      ticket.departmentId !== req.user?.departmentId
    ) {
      return res.status(403).json({ error: 'Only a team member in this ticket department can accept it' });
    }

    if (action === 'ACCEPT') {
      if (!['NEW', 'OPEN', 'ASSIGNED'].includes(ticket.status)) {
        return res.status(400).json({ error: 'This ticket is not available to accept' });
      }
      if (ticket.assignedTechnicianId && ticket.assignedTechnicianId !== req.user.id) {
        return res.status(403).json({ error: 'This ticket is assigned to another technician' });
      }

      const claimed = await prisma.ticket.updateMany({
        where: {
          id: ticket.id,
          status: ticket.status,
          assignedTechnicianId: ticket.assignedTechnicianId,
        },
        data: {
          assignedTechnicianId: req.user.id,
          status: 'ACCEPTED',
          firstRespondedAt: new Date(),
        },
      });
      if (claimed.count !== 1) {
        return res.status(409).json({ error: 'Another technician has already accepted this ticket' });
      }
      const updated = await prisma.ticket.findUnique({ where: { id: ticket.id } });

      await prisma.ticketHistory.create({
        data: {
          ticketId: ticket.id,
          actorId: req.user?.id,
          action: 'STATUS_CHANGE',
          oldValue: ticket.status,
          newValue: 'ACCEPTED',
          details: `Technician ${req.user?.name} accepted the ticket.`,
        },
      });

      return res.json(updated);
    } else if (action === 'REJECT') {
      if (ticket.assignedTechnicianId !== req.user.id || ticket.status !== 'ASSIGNED') {
        return res.status(403).json({ error: 'Only the assigned technician can reject this assignment' });
      }
      if (!reason) {
        return res.status(400).json({ error: 'Rejection reason is mandatory' });
      }

      const updated = await prisma.ticket.update({
        where: { id: ticket.id },
        data: {
          status: 'OPEN',
          assignedTechnicianId: null,
          rejectionReason: reason,
        },
      });

      await prisma.ticketHistory.create({
        data: {
          ticketId: ticket.id,
          actorId: req.user?.id,
          action: 'ASSIGNMENT_REJECTED',
          details: `Technician ${req.user?.name} rejected assignment. Reason: ${reason}`,
        },
      });

      return res.json(updated);
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to handle assignment response' });
  }
};

// Assign or Reassign ticket (Admin/Manager action)
export const assignTicket = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { technicianId, departmentId, reason } = req.body;

    const ticket = await prisma.ticket.findFirst({
      where: { OR: [{ id }, { ticketNumber: id }] },
      include: { assignedTechnician: true, department: true },
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const oldTechName = ticket.assignedTechnician?.name || 'Unassigned';
    const updateData: any = {};

    if (technicianId) {
      updateData.assignedTechnicianId = technicianId;
      updateData.status = 'ASSIGNED';
    }
    if (departmentId) {
      updateData.departmentId = departmentId;
    }

    const updated = await prisma.ticket.update({
      where: { id: ticket.id },
      data: updateData,
      include: { assignedTechnician: true, department: true },
    });

    // History record
    await prisma.ticketHistory.create({
      data: {
        ticketId: ticket.id,
        actorId: req.user?.id,
        action: 'ASSIGNMENT',
        fieldChanged: 'assignedTechnician',
        oldValue: oldTechName,
        newValue: updated.assignedTechnician?.name || 'Unassigned',
        details: reason ? `Reassigned: ${reason}` : `Assigned to ${updated.assignedTechnician?.name}`,
      },
    });

    // Notification
    if (technicianId) {
      await prisma.notification.create({
        data: {
          userId: technicianId,
          title: `Ticket Assigned: ${ticket.ticketNumber}`,
          message: `You have been assigned to ${ticket.subject}. Priority: ${ticket.priority}`,
          type: 'TICKET',
          linkUrl: `/tickets/${ticket.ticketNumber}`,
        },
      });
    }

    return res.json(updated);
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to assign ticket' });
  }
};

// Add comment or internal note
export const addComment = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { content, isInternal = false } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Comment content cannot be empty' });
    }

    const ticket = await prisma.ticket.findFirst({
      where: { OR: [{ id }, { ticketNumber: id }] },
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Only technician, managers or admins can add internal notes
    const effectiveIsInternal = (isInternal && req.user?.role !== 'EMPLOYEE') ? true : false;

    const comment = await prisma.ticketComment.create({
      data: {
        ticketId: ticket.id,
        userId: req.user!.id,
        content,
        isInternal: effectiveIsInternal,
      },
      include: {
        user: { select: { id: true, name: true, role: true, avatarUrl: true } },
      },
    });

    await prisma.ticketHistory.create({
      data: {
        ticketId: ticket.id,
        actorId: req.user!.id,
        action: effectiveIsInternal ? 'INTERNAL_NOTE_ADDED' : 'COMMENT_ADDED',
        details: `${effectiveIsInternal ? 'Internal note' : 'Public comment'} added by ${req.user?.name}`,
      },
    });

    return res.status(201).json(comment);
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to add comment' });
  }
};

// Add work log
export const addWorkLog = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { hoursSpent, description } = req.body;

    if (!hoursSpent || !description) {
      return res.status(400).json({ error: 'Hours spent and description are required' });
    }

    const ticket = await prisma.ticket.findFirst({
      where: { OR: [{ id }, { ticketNumber: id }] },
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const workLog = await prisma.ticketWorkLog.create({
      data: {
        ticketId: ticket.id,
        technicianId: req.user!.id,
        hoursSpent: parseFloat(hoursSpent),
        description,
      },
      include: {
        technician: { select: { id: true, name: true, employeeCode: true } },
      },
    });

    return res.status(201).json(workLog);
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to log work' });
  }
};

// Close ticket with rating & feedback (Requester confirmation)
export const closeTicket = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { satisfactionRating, feedback } = req.body;

    const ticket = await prisma.ticket.findFirst({
      where: { OR: [{ id }, { ticketNumber: id }] },
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const updated = await prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
        satisfactionRating: satisfactionRating ? parseInt(satisfactionRating) : 5,
        feedback: feedback || 'Satisfied with resolution.',
      },
    });

    await prisma.ticketHistory.create({
      data: {
        ticketId: ticket.id,
        actorId: req.user?.id,
        action: 'TICKET_CLOSED',
        oldValue: ticket.status,
        newValue: 'CLOSED',
        details: `Ticket closed by requester with ${satisfactionRating || 5}-star satisfaction rating.`,
      },
    });

    return res.json(updated);
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to close ticket' });
  }
};
