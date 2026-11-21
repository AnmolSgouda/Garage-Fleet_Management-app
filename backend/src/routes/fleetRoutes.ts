import { Router, Request, Response } from 'express';
import { fleetService } from '../services/fleetService.js';

export const fleetRouter = Router();

fleetRouter.get('/health', (_req: Request, res: Response) => {
  res.json({
    ok: true,
    service: 'fleet-garage-api',
    databaseMode: 'postgresql',
    timestamp: new Date().toISOString(),
  });
});

fleetRouter.get('/bootstrap', async (_req: Request, res: Response) => {
  await fleetService.init();
  res.json(fleetService.getBootstrapState());
});

// Garage Config
fleetRouter.put('/garage-config', async (req: Request, res: Response) => {
  await fleetService.init();
  const updated = await fleetService.updateGarageConfig(req.body || {});
  res.json({ success: true, garageConfig: updated });
});

// Suppliers
fleetRouter.post('/suppliers', async (req: Request, res: Response) => {
  await fleetService.init();
  const created = await fleetService.addSupplier(req.body);
  res.status(201).json({ success: true, supplier: created });
});

fleetRouter.put('/suppliers/:id', async (req: Request, res: Response) => {
  await fleetService.init();
  const result = await fleetService.updateSupplier(String(req.params.id), req.body || {});
  if (!result.success) {
    res.status(404).json(result);
    return;
  }
  res.json(result);
});

// Inventory
fleetRouter.post('/inventory', async (req: Request, res: Response) => {
  await fleetService.init();
  const result = await fleetService.addInventoryItem(req.body);
  if (!result.success) {
    res.status(400).json(result);
    return;
  }
  res.status(201).json(result);
});

fleetRouter.put('/inventory/:id', async (req: Request, res: Response) => {
  await fleetService.init();
  const result = await fleetService.updateInventoryItem(String(req.params.id), req.body || {});
  if (!result.success) {
    res.status(400).json(result);
    return;
  }
  res.json(result);
});

fleetRouter.patch('/inventory/:id/toggle-active', async (req: Request, res: Response) => {
  await fleetService.init();
  const result = await fleetService.toggleInventoryItemActive(String(req.params.id));
  if (!result.success) {
    res.status(404).json({ success: false, error: 'Inventory item not found.' });
    return;
  }
  res.json(result);
});

fleetRouter.post('/inventory/:id/adjust', async (req: Request, res: Response) => {
  await fleetService.init();
  const result = await fleetService.adjustInventoryStock({
    ...req.body,
    inventoryItemId: String(req.params.id),
  });
  if (!result.success) {
    res.status(400).json(result);
    return;
  }
  res.json(result);
});

// Service Templates
fleetRouter.post('/service-templates', async (req: Request, res: Response) => {
  await fleetService.init();
  const template = await fleetService.createServiceTemplate(req.body);
  res.status(201).json({ success: true, template });
});

fleetRouter.put('/service-templates/:id', async (req: Request, res: Response) => {
  await fleetService.init();
  const template = await fleetService.updateServiceTemplate(String(req.params.id), req.body || {});
  if (!template) {
    res.status(404).json({ success: false, error: 'Service template not found.' });
    return;
  }
  res.json({ success: true, template });
});

// Vehicles
fleetRouter.post('/vehicles', async (req: Request, res: Response) => {
  await fleetService.init();
  const result = await fleetService.registerVehicle(req.body);
  if (!result.success) {
    res.status(400).json(result);
    return;
  }
  res.status(201).json(result);
});

fleetRouter.post('/vehicles/:id/activities', async (req: Request, res: Response) => {
  await fleetService.init();
  const item = await fleetService.addUnplannedActivity(String(req.params.id), req.body?.name || '');
  if (!item) {
    res.status(404).json({ success: false, error: 'Vehicle not found.' });
    return;
  }
  res.status(201).json({ success: true, item });
});

fleetRouter.post('/vehicles/:id/repairs', async (req: Request, res: Response) => {
  await fleetService.init();
  const item = await fleetService.addUnplannedRepair(
    String(req.params.id),
    req.body?.issue || '',
    req.body?.severity || 'major'
  );
  if (!item) {
    res.status(404).json({ success: false, error: 'Vehicle not found.' });
    return;
  }
  res.status(201).json({ success: true, item });
});

// Bookings & Repair Jobs
fleetRouter.post('/bookings', async (req: Request, res: Response) => {
  await fleetService.init();
  const result = await fleetService.createBooking(req.body);
  if (!result.success) {
    res.status(409).json(result);
    return;
  }
  res.status(201).json(result);
});

fleetRouter.put('/bookings/:id', async (req: Request, res: Response) => {
  await fleetService.init();
  const result = await fleetService.updateBooking({ ...req.body, id: String(req.params.id) });
  if (!result.success) {
    res.status(409).json(result);
    return;
  }
  res.json(result);
});

fleetRouter.delete('/bookings/:id', async (req: Request, res: Response) => {
  await fleetService.init();
  const result = await fleetService.cancelBooking(String(req.params.id));
  if (!result.success) {
    res.status(404).json({ success: false, error: 'Booking not found.' });
    return;
  }
  res.json(result);
});

fleetRouter.post('/bookings/:id/approve', async (req: Request, res: Response) => {
  await fleetService.init();
  const booking = await fleetService.approvePreliminaryBooking(String(req.params.id));
  if (!booking) {
    res.status(404).json({ success: false, error: 'Booking not found.' });
    return;
  }
  res.json({ success: true, booking });
});

fleetRouter.post('/bookings/:id/reject', async (req: Request, res: Response) => {
  await fleetService.init();
  const booking = await fleetService.rejectPreliminaryBooking(String(req.params.id));
  if (!booking) {
    res.status(404).json({ success: false, error: 'Booking not found.' });
    return;
  }
  res.json({ success: true, booking });
});

fleetRouter.post('/bookings/:id/start', async (req: Request, res: Response) => {
  await fleetService.init();
  const booking = await fleetService.startConfirmedBooking(String(req.params.id));
  if (!booking) {
    res.status(404).json({ success: false, error: 'Booking not found.' });
    return;
  }
  res.json({ success: true, booking });
});

fleetRouter.post('/bookings/:id/complete', async (req: Request, res: Response) => {
  await fleetService.init();
  const booking = await fleetService.completeInProgressBooking(
    String(req.params.id),
    req.body?.technicianNotes,
    req.body?.invoiceNumber,
    req.body?.invoiceTotalStr
  );
  if (!booking) {
    res.status(404).json({ success: false, error: 'Booking not found.' });
    return;
  }
  res.json({ success: true, booking });
});

fleetRouter.patch('/bookings/:id/actual-materials/:lineId', async (req: Request, res: Response) => {
  await fleetService.init();
  const result = await fleetService.updateJobActualMaterialQty(
    String(req.params.id),
    String(req.params.lineId),
    Number(req.body?.actualQuantity ?? 0)
  );
  if (!result.success) {
    res.status(400).json(result);
    return;
  }
  res.json(result);
});

fleetRouter.post('/bookings/:id/additional-materials', async (req: Request, res: Response) => {
  await fleetService.init();
  const result = await fleetService.addJobAdditionalMaterial(String(req.params.id), req.body);
  if (!result.success) {
    res.status(400).json(result);
    return;
  }
  res.status(201).json(result);
});

fleetRouter.patch('/bookings/:id/additional-materials/:lineId', async (req: Request, res: Response) => {
  await fleetService.init();
  const result = await fleetService.updateJobAdditionalMaterial(
    String(req.params.id),
    String(req.params.lineId),
    req.body || {}
  );
  if (!result.success) {
    res.status(400).json(result);
    return;
  }
  res.json(result);
});

fleetRouter.delete('/bookings/:id/additional-materials/:lineId', async (req: Request, res: Response) => {
  await fleetService.init();
  const result = await fleetService.removeJobAdditionalMaterial(
    String(req.params.id),
    String(req.params.lineId)
  );
  if (!result.success) {
    res.status(400).json(result);
    return;
  }
  res.json(result);
});

fleetRouter.patch('/bookings/:id/charges', async (req: Request, res: Response) => {
  await fleetService.init();
  const result = await fleetService.updateJobChargesAndNotes(String(req.params.id), req.body || {});
  if (!result.success) {
    res.status(400).json(result);
    return;
  }
  res.json(result);
});

// Invoices
fleetRouter.post('/invoices', async (req: Request, res: Response) => {
  await fleetService.init();
  const result = await fleetService.generateInvoiceForBooking(req.body);
  if (!result.success) {
    res.status(400).json(result);
    return;
  }
  res.status(201).json(result);
});

fleetRouter.patch('/invoices/:id/payment', async (req: Request, res: Response) => {
  await fleetService.init();
  const result = await fleetService.updateInvoicePayment(String(req.params.id), req.body);
  if (!result.success) {
    res.status(404).json({ success: false, error: 'Invoice not found.' });
    return;
  }
  res.json(result);
});

fleetRouter.post('/invoices/:id/cancel', async (req: Request, res: Response) => {
  await fleetService.init();
  const result = await fleetService.cancelInvoice(String(req.params.id), req.body?.reason);
  if (!result.success) {
    res.status(400).json(result);
    return;
  }
  res.json(result);
});

// Notifications
fleetRouter.post('/notifications/:id/dismiss', async (req: Request, res: Response) => {
  await fleetService.dismissNotification(String(req.params.id));
  res.json({ success: true });
});

fleetRouter.post('/notifications/dismiss-all', async (_req: Request, res: Response) => {
  await fleetService.dismissAllNotifications();
  res.json({ success: true });
});

fleetRouter.post('/notifications/reset', async (_req: Request, res: Response) => {
  const notifications = await fleetService.resetNotifications();
  res.json({ success: true, notifications });
});
