import db from '../config/db.js';

const getAccessFilter = (role, userId, paramIndex) => {
  if (role === 'landlord') return { join: '', where: `p.landlord_id = $${paramIndex}` };
  if (role === 'caretaker') return {
    join: `INNER JOIN caretaker_properties cp ON p.id = cp.property_id AND cp.status = 'active'`,
    where: `cp.caretaker_id = $${paramIndex}`
  };
  throw new Error('Unauthorized');
};

// 1. Tenant Statement (Balances)
export const getTenantStatement = async (req, res) => {
  try {
    const { role, id: userId } = req.user;
    const { propertyId } = req.query;
    
    const access = getAccessFilter(role, userId, 1);
    const params = [userId];
    let propertyFilter = '';

    if (propertyId) { propertyFilter = `AND p.id = $2`; params.push(propertyId); }

    const query = `
      SELECT 
        u.first_name || ' ' || u.last_name AS "tenantName",
        p.name AS "propertyName",
        p.id AS "propertyId",
        un.unit_number AS "unitId",
        (
          COALESCE((SELECT SUM(amount_due) FROM rent_periods rp WHERE rp.tenant_id = t.id), 0) -
          COALESCE((SELECT SUM(amount) FROM payments py WHERE py.tenant_id = t.id AND py.status = 'confirmed'), 0)
        ) AS balance
      FROM tenants t
      JOIN users u ON t.user_id = u.id
      JOIN properties p ON t.property_id = p.id
      JOIN units un ON t.unit_id = un.id
      ${access.join}
      WHERE t.status = 'active' AND ${access.where} ${propertyFilter}
      ORDER BY p.name, un.unit_number
    `;
    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// 2. Property Statement (Occupancy)
export const getPropertyStatement = async (req, res) => {
  try {
    const { role, id: userId } = req.user;
    const { propertyId } = req.query;
    
    const access = getAccessFilter(role, userId, 1);
    const params = [userId];
    let propertyFilter = '';

    if (propertyId) { propertyFilter = `AND p.id = $2`; params.push(propertyId); }

    const query = `
      SELECT 
        p.name AS "propertyName", p.location, COUNT(un.id) AS "totalUnits",
        COUNT(CASE WHEN t.id IS NOT NULL THEN 1 END) AS "occupiedUnits",
        COUNT(CASE WHEN t.id IS NULL THEN 1 END) AS "vacantUnits",
        COALESCE(MAX(cu.first_name) || ' ' || MAX(cu.last_name), 'Unassigned') AS "caretaker"
      FROM properties p
      LEFT JOIN units un ON un.property_id = p.id
      LEFT JOIN tenants t ON t.unit_id = un.id AND t.status = 'active'
      LEFT JOIN caretaker_properties care_p ON care_p.property_id = p.id AND care_p.status = 'active'
      LEFT JOIN users cu ON care_p.caretaker_id = cu.id
      ${access.join}
      WHERE ${access.where} ${propertyFilter}
      GROUP BY p.id, p.name, p.location
      ORDER BY p.name
    `;
    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// 3. Unit Status Report
export const getUnitStatusReport = async (req, res) => {
  try {
    const { role, id: userId } = req.user;
    const { propertyId } = req.query;
    
    const access = getAccessFilter(role, userId, 1);
    const params = [userId];
    let propertyFilter = '';

    if (propertyId) { propertyFilter = `AND p.id = $2`; params.push(propertyId); }

    const query = `
      SELECT 
        p.name AS "propertyName", p.id AS "propertyId", un.unit_number AS "unitId", ut.name AS "roomType",
        COALESCE(tc.agreed_rent, ut.default_rent) AS "rent",
        CASE WHEN t.id IS NOT NULL THEN 'occupied' ELSE 'vacant' END AS status
      FROM units un
      JOIN properties p ON un.property_id = p.id
      JOIN unit_types ut ON un.unit_type_id = ut.id
      LEFT JOIN tenants t ON t.unit_id = un.id AND t.status = 'active'
      LEFT JOIN tenancies tc ON tc.tenant_id = t.id AND tc.status = 'active'
      ${access.join}
      WHERE ${access.where} ${propertyFilter}
      ORDER BY p.name, un.unit_number
    `;
    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// 4. Tenant Directory Report
export const getTenantDirectory = async (req, res) => {
  try {
    const { role, id: userId } = req.user;
    const { propertyId } = req.query;
    
    const access = getAccessFilter(role, userId, 1);
    const params = [userId];
    let propertyFilter = '';

    if (propertyId) { propertyFilter = `AND p.id = $2`; params.push(propertyId); }

    const query = `
      SELECT 
        u.first_name || ' ' || u.last_name AS "tenantName",
        p.name AS "propertyName", p.id AS "propertyId", un.unit_number AS "unitId",
        u.phone, COALESCE(u.email, 'N/A') as "email"
      FROM tenants t
      JOIN users u ON t.user_id = u.id
      JOIN properties p ON t.property_id = p.id
      JOIN units un ON t.unit_id = un.id
      ${access.join}
      WHERE t.status = 'active' AND ${access.where} ${propertyFilter}
      ORDER BY p.name, un.unit_number
    `;
    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// 5. Revenue Report
export const getRevenueReport = async (req, res) => {
  try {
    const { role, id: userId } = req.user;
    const { propertyId, year, month, periodType } = req.query;
    
    const access = getAccessFilter(role, userId, 1);
    const params = [userId];
    let propertyFilter = '';

    if (propertyId) { propertyFilter = `AND p.id = $2`; params.push(propertyId); }

    const query = `
      SELECT 
        p.name AS "propertyName", p.id AS "propertyId", COUNT(DISTINCT t.id) AS "tenantCount",
        COALESCE(SUM(rp.amount_due), 0) AS "expectedRevenue",
        COALESCE((
          SELECT SUM(amount) FROM payments py WHERE py.property_id = p.id AND py.status = 'confirmed' AND py.payment_type = 'rent'
          ${periodType === 'monthly' && year && month ? `AND EXTRACT(YEAR FROM py.payment_date) = ${year} AND EXTRACT(MONTH FROM py.payment_date) = ${month}` : ''}
          ${periodType === 'yearly' && year ? `AND EXTRACT(YEAR FROM py.payment_date) = ${year}` : ''}
        ), 0) AS "collectedRevenue",
        (COALESCE(SUM(rp.amount_due), 0) - COALESCE((
          SELECT SUM(amount) FROM payments py WHERE py.property_id = p.id AND py.status = 'confirmed' AND py.payment_type = 'rent'
          ${periodType === 'monthly' && year && month ? `AND EXTRACT(YEAR FROM py.payment_date) = ${year} AND EXTRACT(MONTH FROM py.payment_date) = ${month}` : ''}
          ${periodType === 'yearly' && year ? `AND EXTRACT(YEAR FROM py.payment_date) = ${year}` : ''}
        ), 0)) AS "outstandingAmount"
      FROM properties p
      LEFT JOIN tenants t ON t.property_id = p.id AND t.status = 'active'
      LEFT JOIN rent_periods rp ON rp.tenant_id = t.id 
        ${periodType === 'monthly' && year && month ? `AND EXTRACT(YEAR FROM rp.due_date) = ${year} AND EXTRACT(MONTH FROM rp.due_date) = ${month}` : ''}
        ${periodType === 'yearly' && year ? `AND EXTRACT(YEAR FROM rp.due_date) = ${year}` : ''}
      ${access.join}
      WHERE ${access.where} ${propertyFilter}
      GROUP BY p.id, p.name
      ORDER BY p.name
    `;
    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// 6. Maintenance Report
export const getMaintenanceReport = async (req, res) => {
  try {
    const { role, id: userId } = req.user;
    const { propertyId } = req.query;
    
    const access = getAccessFilter(role, userId, 1);
    const params = [userId];
    let propertyFilter = '';

    if (propertyId) { propertyFilter = `AND p.id = $2`; params.push(propertyId); }

    const query = `
      SELECT 
        p.name AS "propertyName", p.id AS "propertyId", COUNT(mr.id) AS "totalTickets",
        COUNT(CASE WHEN mr.status = 'open' THEN 1 END) AS "open",
        COUNT(CASE WHEN mr.status = 'in_progress' THEN 1 END) AS "inProgress",
        COUNT(CASE WHEN mr.status = 'completed' THEN 1 END) AS "completed"
      FROM properties p
      LEFT JOIN maintenance_requests mr ON mr.property_id = p.id
      ${access.join}
      WHERE ${access.where} ${propertyFilter}
      GROUP BY p.id, p.name
      ORDER BY p.name
    `;
    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};