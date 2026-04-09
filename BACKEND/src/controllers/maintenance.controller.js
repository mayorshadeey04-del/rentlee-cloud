import db from '../config/db.js';

// Valid values from schema
const VALID_PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const VALID_STATUSES   = ['open', 'in_progress', 'completed'];

// ============================================
// @desc    Get All Maintenance Requests
// @route   GET /api/maintenance
// @access  Private (Landlord, Caretaker)
// ============================================
export const getMaintenanceRequests = async (req, res) => {
  try {
    const userId = req.user.id;
    const role   = req.user.role;
    const { propertyId, status, priority, category } = req.query;

    let query;
    let params;

    if (role === 'landlord') {
      query = `
        SELECT 
          mr.*,
          p.name        AS property_name,
          u.unit_number AS unit_number,
          usr.first_name AS tenant_first_name,
          usr.last_name  AS tenant_last_name
        FROM maintenance_requests mr
        JOIN properties p  ON mr.property_id = p.id
        JOIN units u       ON mr.unit_id = u.id
        JOIN tenants t     ON mr.tenant_id = t.id
        JOIN users usr     ON t.user_id = usr.id
        WHERE mr.landlord_id = $1
          AND mr.landlord_deleted_at IS NULL
          ${propertyId ? 'AND mr.property_id = $2' : ''}
          ${status     ? `AND mr.status = $${propertyId ? 3 : 2}` : ''}
          ${priority   ? `AND mr.priority = $${[propertyId, status].filter(Boolean).length + 2}` : ''}
          ${category   ? `AND mr.category = $${[propertyId, status, priority].filter(Boolean).length + 2}` : ''}
        ORDER BY mr.created_at DESC
      `;
      params = [userId, propertyId, status, priority, category].filter(Boolean);

    } else if (role === 'caretaker') {
      query = `
        SELECT 
          mr.*,
          p.name        AS property_name,
          u.unit_number AS unit_number,
          usr.first_name AS tenant_first_name,
          usr.last_name  AS tenant_last_name
        FROM maintenance_requests mr
        JOIN properties p          ON mr.property_id = p.id
        JOIN units u               ON mr.unit_id = u.id
        JOIN tenants t             ON mr.tenant_id = t.id
        JOIN users usr             ON t.user_id = usr.id
        INNER JOIN caretaker_properties cp ON p.id = cp.property_id
        WHERE cp.caretaker_id = $1
          AND cp.status = 'active'
          AND mr.landlord_deleted_at IS NULL
          ${propertyId ? 'AND mr.property_id = $2' : ''}
          ${status     ? `AND mr.status = $${propertyId ? 3 : 2}` : ''}
          ${priority   ? `AND mr.priority = $${[propertyId, status].filter(Boolean).length + 2}` : ''}
          ${category   ? `AND mr.category = $${[propertyId, status, priority].filter(Boolean).length + 2}` : ''}
        ORDER BY mr.created_at DESC
      `;
      params = [userId, propertyId, status, priority, category].filter(Boolean);

    } else {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });

  } catch (error) {
    console.error('Get maintenance requests error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch maintenance requests' });
  }
};

// ============================================
// @desc    Get Single Maintenance Request
// @route   GET /api/maintenance/:id
// @access  Private (Landlord, Caretaker)
// ============================================
export const getMaintenanceRequest = async (req, res) => {
  try {
    const { id }  = req.params;
    const userId  = req.user.id;
    const role    = req.user.role;

    const result = await db.query(
      `SELECT 
          mr.*,
          p.name        AS property_name,
          p.landlord_id AS landlord_id,
          u.unit_number AS unit_number,
          usr.first_name AS tenant_first_name,
          usr.last_name  AS tenant_last_name,
          usr.email      AS tenant_email,
          usr.phone      AS tenant_phone
       FROM maintenance_requests mr
       JOIN properties p  ON mr.property_id = p.id
       JOIN units u       ON mr.unit_id = u.id
       JOIN tenants t     ON mr.tenant_id = t.id
       JOIN users usr     ON t.user_id = usr.id
       WHERE mr.id = $1 AND mr.landlord_deleted_at IS NULL`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Maintenance request not found' });
    }

    const request = result.rows[0];

    // Check access
    if (role === 'landlord' && request.landlord_id !== userId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (role === 'caretaker') {
      const accessCheck = await db.query(
        "SELECT id FROM caretaker_properties WHERE caretaker_id = $1 AND property_id = $2 AND status = 'active'",
        [userId, request.property_id]
      );
      if (accessCheck.rows.length === 0) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    }

    res.json({ success: true, data: request });

  } catch (error) {
    console.error('Get maintenance request error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch maintenance request' });
  }
};

// ============================================
// @desc    Create Maintenance Request & Notify Landlord
// @route   POST /api/maintenance
// @access  Private (Tenant only)
// ============================================
export const createMaintenanceRequest = async (req, res) => {
  const { title, description, category, priority } = req.body;

  try {
    const userId = req.user.id;

    if (!title || !description || !priority) {
      return res.status(400).json({ success: false, message: 'Title, description, and priority are required' });
    }

    if (!VALID_PRIORITIES.includes(priority.toLowerCase())) {
      return res.status(400).json({ success: false, message: `Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}` });
    }

    // Get tenant record + details for notification in one go
    const tenantResult = await db.query(
      `SELECT t.id, t.landlord_id, t.property_id, t.unit_id, u.first_name, u.last_name, un.unit_number 
       FROM tenants t
       JOIN users u ON t.user_id = u.id
       JOIN units un ON t.unit_id = un.id
       WHERE t.user_id = $1 AND t.status = 'active'`,
      [userId]
    );

    if (tenantResult.rows.length === 0) {
      return res.status(403).json({ success: false, message: 'Active tenant record not found' });
    }

    const tenant = tenantResult.rows[0];
    const tenantName = `${tenant.first_name} ${tenant.last_name}`;

    const result = await db.query(
      `INSERT INTO maintenance_requests 
        (landlord_id, tenant_id, property_id, unit_id, title, description, category, priority, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'open')
       RETURNING *`,
      [tenant.landlord_id, tenant.id, tenant.property_id, tenant.unit_id, title, description, category || null, priority.toLowerCase()]
    );

    //  AUTOMATED NOTIFICATION TRIGGER: Notify the Landlord
    await db.query(
      `INSERT INTO notifications (user_id, title, message, type)
       VALUES ($1, $2, $3, 'maintenance')`,
      [
        tenant.landlord_id,
        'New Maintenance Request',
        `${tenantName} submitted a new request for Unit ${tenant.unit_number}: ${title}`
      ]
    );

    // Optional: Notify any active caretakers for this property
    const caretakers = await db.query(
      `SELECT caretaker_id FROM caretaker_properties WHERE property_id = $1 AND status = 'active'`, 
      [tenant.property_id]
    );
    for (let ct of caretakers.rows) {
      await db.query(
        `INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, 'maintenance')`,
        [ct.caretaker_id, 'New Maintenance Request', `${tenantName} submitted a new request for Unit ${tenant.unit_number}: ${title}`]
      );
    }

    res.status(201).json({
      success: true,
      message: 'Maintenance request submitted successfully',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Create maintenance request error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to submit maintenance request' });
  }
};

// ============================================
// @desc    Update Status & Notify Tenant
// @route   PATCH /api/maintenance/:id/status
// @access  Private (Landlord, Caretaker)
// ============================================
export const updateMaintenanceStatus = async (req, res) => {
  const { id }     = req.params;
  const { status } = req.body;

  try {
    const userId = req.user.id;
    const role   = req.user.role;

    if (!status || !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
    }

    const requestCheck = await db.query(
      `SELECT mr.*, p.landlord_id, t.user_id as tenant_user_id
       FROM maintenance_requests mr
       JOIN properties p ON mr.property_id = p.id
       JOIN tenants t ON mr.tenant_id = t.id
       WHERE mr.id = $1 AND mr.landlord_deleted_at IS NULL`,
      [id]
    );

    if (requestCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Maintenance request not found' });
    }

    const request = requestCheck.rows[0];

    // Check access
    if (role === 'landlord' && request.landlord_id !== userId) return res.status(403).json({ success: false, message: 'Access denied' });
    if (role === 'caretaker') {
      const accessCheck = await db.query(
        "SELECT id FROM caretaker_properties WHERE caretaker_id = $1 AND property_id = $2 AND status = 'active'",
        [userId, request.property_id]
      );
      if (accessCheck.rows.length === 0) return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Enforce status progression
    const progression = { open: 1, in_progress: 2, completed: 3 };
    if (progression[status] <= progression[request.status]) {
      return res.status(400).json({ success: false, message: `Cannot change status from '${request.status}' to '${status}'` });
    }

    const result = await db.query(
      `UPDATE maintenance_requests SET status = $1 WHERE id = $2 RETURNING *`,
      [status, id]
    );

    //  AUTOMATED NOTIFICATION TRIGGER: Notify the Tenant
    const niceStatus = status === 'in_progress' ? 'In Progress' : status === 'completed' ? 'Completed' : 'Open';
    await db.query(
      `INSERT INTO notifications (user_id, title, message, type)
       VALUES ($1, $2, $3, 'maintenance')`,
      [
        request.tenant_user_id,
        'Maintenance Update',
        `Your request "${request.title}" is now marked as ${niceStatus}.`
      ]
    );

    res.json({
      success: true,
      message: `Maintenance request marked as ${status}`,
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Update maintenance status error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to update maintenance request status' });
  }
};

// ============================================
// @desc    Delete Maintenance Request (Admin Soft Delete)
// @route   DELETE /api/maintenance/:id
// @access  Private (Landlord, Caretaker)
// ============================================
export const deleteMaintenanceRequest = async (req, res) => {
  const { id } = req.params;

  try {
    const userId = req.user.id;
    const role   = req.user.role;

    const requestCheck = await db.query(
      `SELECT mr.*, p.landlord_id
       FROM maintenance_requests mr
       JOIN properties p ON mr.property_id = p.id
       WHERE mr.id = $1 AND mr.landlord_deleted_at IS NULL`,
      [id]
    );

    if (requestCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Maintenance request not found' });
    }

    const request = requestCheck.rows[0];

    if (role === 'landlord' && request.landlord_id !== userId) return res.status(403).json({ success: false, message: 'Access denied' });
    if (role === 'caretaker') {
      const accessCheck = await db.query(
        "SELECT id FROM caretaker_properties WHERE caretaker_id = $1 AND property_id = $2 AND status = 'active'",
        [userId, request.property_id]
      );
      if (accessCheck.rows.length === 0) return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (request.status !== 'completed') {
      return res.status(400).json({ success: false, message: 'Only completed maintenance requests can be archived' });
    }

    await db.query('UPDATE maintenance_requests SET landlord_deleted_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);
    res.json({ success: true, message: 'Maintenance request archived successfully' });

  } catch (error) {
    console.error('Delete maintenance request error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to delete request' });
  }
};

// =========================================================================================
// TENANT SPECIFIC ENDPOINTS
// =========================================================================================

// ============================================
// @desc    Get Tenant's Own Maintenance Requests
// @route   GET /api/maintenance/my-requests
// @access  Private (Tenant only)
// ============================================
export const getMyMaintenanceRequests = async (req, res) => {
  try {
    const userId = req.user.id;

    const tenantResult = await db.query('SELECT id FROM tenants WHERE user_id = $1', [userId]);
    if (tenantResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Tenant record not found' });

    const tenantId = tenantResult.rows[0].id;

    const result = await db.query(
      `SELECT 
          mr.*,
          p.name        AS property_name,
          u.unit_number AS unit_number
       FROM maintenance_requests mr
       JOIN properties p ON mr.property_id = p.id
       JOIN units u      ON mr.unit_id = u.id
       WHERE mr.tenant_id = $1
         AND mr.tenant_deleted_at IS NULL
       ORDER BY mr.created_at DESC`,
      [tenantId]
    );

    res.json({ success: true, data: result.rows });

  } catch (error) {
    console.error('Get my maintenance requests error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================
// @desc    Update Tenant's Own Maintenance Request
// @route   PUT /api/maintenance/my-requests/:id
// @access  Private (Tenant only)
// ============================================
export const updateMyMaintenanceRequest = async (req, res) => {
  const { id } = req.params;
  const { title, description, category, priority } = req.body;

  try {
    const userId = req.user.id;

    const tenantResult = await db.query('SELECT id FROM tenants WHERE user_id = $1', [userId]);
    if (tenantResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Tenant record not found' });
    
    const tenantId = tenantResult.rows[0].id;

    const reqCheck = await db.query(
      'SELECT status FROM maintenance_requests WHERE id = $1 AND tenant_id = $2 AND tenant_deleted_at IS NULL',
      [id, tenantId]
    );

    if (reqCheck.rows.length === 0) return res.status(404).json({ success: false, message: 'Maintenance request not found' });
    if (reqCheck.rows[0].status !== 'open') return res.status(400).json({ success: false, message: 'You cannot edit a request that is already in progress or completed.' });

    const result = await db.query(
      `UPDATE maintenance_requests 
       SET title = COALESCE($1, title), 
           description = COALESCE($2, description), 
           category = COALESCE($3, category), 
           priority = COALESCE($4, priority)
       WHERE id = $5 
       RETURNING *`,
      [title, description, category, priority, id]
    );

    res.json({ success: true, message: 'Request updated successfully', data: result.rows[0] });

  } catch (error) {
    console.error('Update my maintenance request error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================
// @desc    Delete/Archive Tenant's Own Maintenance Request
// @route   DELETE /api/maintenance/my-requests/:id
// @access  Private (Tenant only)
// ============================================
export const deleteMyMaintenanceRequest = async (req, res) => {
  const { id } = req.params;

  try {
    const userId = req.user.id;

    const tenantResult = await db.query('SELECT id FROM tenants WHERE user_id = $1', [userId]);
    if (tenantResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Tenant record not found' });
    
    const tenantId = tenantResult.rows[0].id;

    const reqCheck = await db.query(
      'SELECT status FROM maintenance_requests WHERE id = $1 AND tenant_id = $2 AND tenant_deleted_at IS NULL',
      [id, tenantId]
    );

    if (reqCheck.rows.length === 0) return res.status(404).json({ success: false, message: 'Maintenance request not found' });

    const status = reqCheck.rows[0].status;

    if (status === 'in_progress') {
      return res.status(400).json({ success: false, message: 'Cannot delete a request that is currently in progress.' });
    }

    await db.query('UPDATE maintenance_requests SET tenant_deleted_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);
    res.json({ success: true, message: 'Request removed from your dashboard' });

  } catch (error) {
    console.error('Delete my maintenance request error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export default {
  getMaintenanceRequests,
  getMaintenanceRequest,
  createMaintenanceRequest,
  updateMaintenanceStatus,
  deleteMaintenanceRequest,
  getMyMaintenanceRequests,
  updateMyMaintenanceRequest,
  deleteMyMaintenanceRequest
};