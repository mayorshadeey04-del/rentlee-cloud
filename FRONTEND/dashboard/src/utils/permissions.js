// ── Permission table ──────────────────────────────────────────────
// Defines exactly what each role can do per resource
// To change a permission — update it here, it flows everywhere automatically
// ─────────────────────────────────────────────────────────────────

export const PERMISSIONS = {

  landlord: {
    properties:  { view: true,  create: true,  update: true,  delete: true  },
    units:       { view: true,  create: true,  update: true,  delete: true  },
    tenants:     { view: true,  create: true,  update: true,  delete: true  },
    maintenance: { view: true,  create: true,  update: true,  delete: true  },
    payments:    { view: true,  create: true,  update: true,  delete: true  },
    reports:     { view: true,  create: true,  update: true,  delete: true  },
    caretakers:  { view: true,  create: true,  update: true,  delete: true  },
  },

  caretaker: {
    properties:  { view: true,  create: false, update: true,  delete: false }, // assigned only
    units:       { view: true,  create: true,  update: true,  delete: true  }, // assigned only
    tenants:     { view: true,  create: true,  update: true,  delete: true  }, // assigned only
    maintenance: { view: true,  create: true,  update: true,  delete: true  }, // assigned only
    payments:    { view: true,  create: false, update: false, delete: false }, // assigned only — view only
    reports:     { view: true,  create: false, update: false, delete: false }, // assigned only — view only
    caretakers:  { view: false, create: false, update: false, delete: false }, // hidden completely
  },

}

// ── Helper functions ──────────────────────────────────────────────

// Check if a role can perform an action on a resource
// Usage: can('caretaker', 'payments', 'view')  → true
//        can('caretaker', 'caretakers', 'view') → false
export function can(role, resource, action) {
  return PERMISSIONS[role]?.[resource]?.[action] === true
}

// Check if a caretaker is assigned to a specific property
// Usage: isAssigned(user.assignedPropertyIds, property.id)
export function isAssigned(assignedPropertyIds, propertyId) {
  return assignedPropertyIds.includes(propertyId)
}

// Filter a list down to only assigned properties (for caretaker)
// Landlord gets everything back unchanged
// Usage: filterByRole(allProperties, user)
export function filterByRole(items, user) {
  if (user.role === 'landlord') return items
  return items.filter(item => isAssigned(user.assignedPropertyIds, item.propertyId))
}