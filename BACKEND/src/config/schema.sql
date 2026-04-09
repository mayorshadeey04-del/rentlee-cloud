-- =============================================
-- RENTLEE – COMPLETE PRODUCTION DATABASE SCHEMA
-- VERSION 3.1 (Ledger, Flexible Pricing & Dual-Archiving)
-- =============================================

DROP DATABASE IF EXISTS rentlee;
CREATE DATABASE rentlee;

\c rentlee;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================
-- USERS
-- =============================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    phone VARCHAR(20),
    password_hash TEXT NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('platform_admin','landlord','caretaker','tenant')),
    landlord_id UUID REFERENCES users(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON COLUMN users.deleted_at IS 'Timestamp when user was soft deleted (deactivated). Applies to tenants and caretakers.';

-- =============================================
-- EMAIL VERIFICATION & PASSWORD TOKENS
-- =============================================

CREATE TABLE email_verification (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_hash TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE password_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT UNIQUE NOT NULL,
    token_type VARCHAR(20) NOT NULL CHECK (token_type IN ('activation','password_reset')),
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- PROPERTIES & UNIT TYPES
-- =============================================

CREATE TABLE properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    landlord_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    location TEXT NOT NULL,
    total_units INT NOT NULL CHECK (total_units >= 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE unit_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL, -- Flexible mode: No CHECK constraint, landlords can name it anything.
    default_rent NUMERIC(12,2) NOT NULL CHECK (default_rent >= 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- UNITS
-- =============================================

CREATE TABLE units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    unit_type_id UUID NOT NULL REFERENCES unit_types(id) ON DELETE RESTRICT,
    unit_number VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'vacant' CHECK (status IN ('vacant','occupied')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(property_id, unit_number)
);

-- =============================================
-- TENANTS
-- =============================================

CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    id_number VARCHAR(50) UNIQUE,
    landlord_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    unit_id UUID UNIQUE NOT NULL REFERENCES units(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','active','inactive')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON COLUMN tenants.status IS 'Lifecycle: pending (registered, email sent) → active (password set, can login) → inactive (soft deleted by admin)';

-- =============================================
-- TENANCIES (The Tenancy Contract)
-- =============================================

CREATE TABLE tenancies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
    landlord_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    agreed_rent NUMERIC(12,2) NOT NULL CHECK (agreed_rent >= 0),
    deposit_amount NUMERIC(12,2) NOT NULL CHECK (deposit_amount >= 0),
    start_date DATE NOT NULL,
    end_date DATE NULL,
    exit_reason VARCHAR(50) NULL CHECK (exit_reason IN ('notice','eviction','abandonment')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','ended')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- THE LEDGER: RENT PERIODS (Debits) & PAYMENTS (Credits)
-- =============================================

CREATE TABLE rent_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenancy_id UUID NOT NULL REFERENCES tenancies(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    period_name VARCHAR(50) NOT NULL,
    amount_due NUMERIC(12,2) NOT NULL CHECK (amount_due > 0),
    due_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'unpaid' CHECK (status IN ('unpaid','partial','paid')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    landlord_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    tenancy_id UUID NOT NULL REFERENCES tenancies(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    payment_type VARCHAR(20) DEFAULT 'rent' CHECK (payment_type IN ('rent','deposit','movein')),
    mpesa_ref VARCHAR(50) NULL,
    status VARCHAR(20) DEFAULT 'confirmed' CHECK (status IN ('confirmed','failed')),
    mpesa_checkout_request_id VARCHAR(100) NULL,
    payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- DEPOSITS
-- =============================================

CREATE TABLE deposits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenancy_id UUID NOT NULL REFERENCES tenancies(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
    paid_on DATE NOT NULL,
    mpesa_ref VARCHAR(50) NULL,
    status VARCHAR(20) DEFAULT 'held' CHECK (status IN ('held','refunded','forfeited')),
    refund_amount NUMERIC(12,2) NULL,
    refunded_on DATE NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- MAINTENANCE & CARETAKERS
-- =============================================

CREATE TABLE maintenance_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    landlord_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(50),
    priority VARCHAR(20) NOT NULL CHECK (priority IN ('low','medium','high','urgent')),
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open','in_progress','completed')),
    
    --  DUAL ARCHIVING: Independent soft-deletes for Landlords and Tenants
    landlord_deleted_at TIMESTAMP DEFAULT NULL,
    tenant_deleted_at TIMESTAMP DEFAULT NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE caretaker_properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    caretaker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','active','inactive')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (caretaker_id, property_id)
);

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(100),
    message VARCHAR(255),
    type VARCHAR(50),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- AUTO TIMESTAMP TRIGGERS
-- =============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_properties_updated BEFORE UPDATE ON properties FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_unit_types_updated BEFORE UPDATE ON unit_types FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_units_updated BEFORE UPDATE ON units FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_tenants_updated BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_tenancies_updated BEFORE UPDATE ON tenancies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_rent_periods_updated BEFORE UPDATE ON rent_periods FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_deposits_updated BEFORE UPDATE ON deposits FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_caretaker_updated BEFORE UPDATE ON caretaker_properties FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_maintenance_updated BEFORE UPDATE ON maintenance_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- UNIT OCCUPANCY AUTOMATION
-- =============================================

CREATE OR REPLACE FUNCTION set_unit_occupied()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE units SET status = 'occupied' WHERE id = NEW.unit_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_unit_occupied
AFTER INSERT ON tenants
FOR EACH ROW
EXECUTE FUNCTION set_unit_occupied();

CREATE OR REPLACE FUNCTION set_unit_vacant()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE units SET status = 'vacant' WHERE id = OLD.unit_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_unit_vacant
AFTER UPDATE OF status ON tenants
FOR EACH ROW
WHEN (OLD.status = 'active' AND NEW.status = 'inactive')
EXECUTE FUNCTION set_unit_vacant();

-- =============================================
-- INDEXES
-- =============================================

-- Users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_is_active ON users(is_active);

-- Core Property & Inventory
CREATE INDEX idx_properties_landlord ON properties(landlord_id);
CREATE INDEX idx_unit_types_property ON unit_types(property_id);
CREATE INDEX idx_units_property ON units(property_id);
CREATE INDEX idx_units_unit_type ON units(unit_type_id);
CREATE INDEX idx_units_status ON units(status);

-- Tenant & Tenancy
CREATE INDEX idx_tenants_landlord ON tenants(landlord_id);
CREATE INDEX idx_tenants_status ON tenants(status);
CREATE INDEX idx_tenancies_tenant ON tenancies(tenant_id);
CREATE INDEX idx_tenancies_active ON tenancies(tenant_id, status) WHERE status = 'active';

-- Financial Ledger
CREATE INDEX idx_rent_periods_tenancy ON rent_periods(tenancy_id);
CREATE INDEX idx_rent_periods_status ON rent_periods(status);
CREATE INDEX idx_payments_tenancy ON payments(tenancy_id);
CREATE INDEX idx_payments_tenant ON payments(tenant_id);
CREATE INDEX idx_deposits_tenancy ON deposits(tenancy_id);

--  DUAL ARCHIVING INDEXES FOR MAINTENANCE
CREATE INDEX idx_maintenance_landlord_deleted ON maintenance_requests(landlord_deleted_at) WHERE landlord_deleted_at IS NOT NULL;
CREATE INDEX idx_maintenance_tenant_deleted ON maintenance_requests(tenant_deleted_at) WHERE tenant_deleted_at IS NOT NULL;


-- =============================================
-- PLATFORM ADMIN SEED DATA
-- =============================================

INSERT INTO users (
    first_name,
    last_name,
    email,
    phone,
    password_hash,
    role,
    is_active,
    created_at,
    updated_at
) VALUES (
    'System',
    'Administrator',
    'admin@rentlee.com',
    '0707402728',
    '$2b$10$Vv3jLkbl85es45D2iy/tSeKLRqc6dcgNN1My/Q3xL35LBcfse8bnC',
    'platform_admin',
    TRUE,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);