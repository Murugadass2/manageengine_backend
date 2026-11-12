import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { authenticateToken } from './middleware/auth.js';
// Controllers
import * as authController from './controllers/authController.js';
import * as ticketController from './controllers/ticketController.js';
import * as departmentController from './controllers/departmentController.js';
import * as assetController from './controllers/assetController.js';
import * as inventoryController from './controllers/inventoryController.js';
import * as maintenanceController from './controllers/maintenanceController.js';
import * as approvalController from './controllers/approvalController.js';
import * as kbController from './controllers/kbController.js';
import * as reportController from './controllers/reportController.js';
import * as auditController from './controllers/auditController.js';
import * as notificationController from './controllers/notificationController.js';
import * as userController from './controllers/userController.js';
import * as slaController from './controllers/slaController.js';
dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
// Request logging middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});
// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ONLINE',
        service: 'HOTEL DAZZLE DROP - Enterprise Service Desk & Operations Management API',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
    });
});
// Authentication Routes
app.post('/api/auth/login', authController.login);
app.get('/api/auth/me', authenticateToken, authController.getCurrentUser);
app.post('/api/auth/switch-role', authController.switchDemoRole);
// Tickets Routes
app.get('/api/tickets', authenticateToken, ticketController.getTickets);
app.get('/api/tickets/:id', authenticateToken, ticketController.getTicketDetails);
app.post('/api/tickets', authenticateToken, ticketController.createTicket);
app.patch('/api/tickets/:id/status', authenticateToken, ticketController.updateTicketStatus);
app.post('/api/tickets/:id/assignment-response', authenticateToken, ticketController.handleAssignmentResponse);
app.post('/api/tickets/:id/assign', authenticateToken, ticketController.assignTicket);
app.post('/api/tickets/:id/comments', authenticateToken, ticketController.addComment);
app.post('/api/tickets/:id/work-logs', authenticateToken, ticketController.addWorkLog);
app.post('/api/tickets/:id/close', authenticateToken, ticketController.closeTicket);
// Departments Routes
app.get('/api/departments', authenticateToken, departmentController.getDepartments);
app.post('/api/departments', authenticateToken, departmentController.createDepartment);
app.patch('/api/departments/:id', authenticateToken, departmentController.updateDepartment);
app.get('/api/departments/:id/technicians', authenticateToken, departmentController.getDepartmentTechnicians);
// Assets Routes
app.get('/api/assets', authenticateToken, assetController.getAssets);
app.post('/api/assets', authenticateToken, assetController.createAsset);
app.patch('/api/assets/:id', authenticateToken, assetController.updateAsset);
// Inventory Routes
app.get('/api/inventory', authenticateToken, inventoryController.getInventoryItems);
app.post('/api/inventory', authenticateToken, inventoryController.createInventoryItem);
app.post('/api/inventory/:id/adjust', authenticateToken, inventoryController.adjustStock);
// Preventive Maintenance Routes
app.get('/api/maintenance', authenticateToken, maintenanceController.getMaintenanceSchedules);
app.post('/api/maintenance', authenticateToken, maintenanceController.createMaintenanceSchedule);
app.patch('/api/maintenance/:id/task', authenticateToken, maintenanceController.updateTaskStatus);
app.post('/api/maintenance/:id/convert-ticket', authenticateToken, maintenanceController.convertToTicket);
// Approval Routes
app.get('/api/approvals', authenticateToken, approvalController.getApprovals);
app.post('/api/approvals', authenticateToken, approvalController.createApproval);
app.post('/api/approvals/:id/process', authenticateToken, approvalController.processApproval);
// Knowledge Base Routes
app.get('/api/kb', authenticateToken, kbController.getArticles);
app.get('/api/kb/:slug', authenticateToken, kbController.getArticleBySlug);
app.post('/api/kb/:id/rate', authenticateToken, kbController.rateHelpful);
app.post('/api/kb', authenticateToken, kbController.createArticle);
// Reports & Dashboard Analytics Routes
app.get('/api/reports/dashboard', authenticateToken, reportController.getDashboardMetrics);
app.get('/api/reports/export/tickets', authenticateToken, reportController.exportTicketsReport);
// Audit Logs Routes
app.get('/api/audit', authenticateToken, auditController.getAuditLogs);
// Notifications Routes
app.get('/api/notifications', authenticateToken, notificationController.getNotifications);
app.patch('/api/notifications/:id/read', authenticateToken, notificationController.markAsRead);
app.post('/api/notifications/read-all', authenticateToken, notificationController.markAllAsRead);
// User & Directory Routes
app.get('/api/users', authenticateToken, userController.getUsers);
app.post('/api/users', authenticateToken, userController.createUser);
app.patch('/api/users/profile', authenticateToken, userController.updateProfile);
// SLA Policies Routes
app.get('/api/sla', authenticateToken, slaController.getSLAPolicies);
app.patch('/api/sla/:id', authenticateToken, slaController.updateSLAPolicy);
// Global Error Handler
app.use((err, req, res, next) => {
    console.error('Unhandled API error:', err);
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
});
app.listen(PORT, () => {
    console.log(`🏨 HOTEL DAZZLE DROP API running on http://localhost:${PORT}`);
});
