-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create enum types
CREATE TYPE user_role AS ENUM ('admin', 'recruiter', 'hiring_manager');
CREATE TYPE job_status AS ENUM ('draft', 'active', 'closed', 'archived');
CREATE TYPE candidate_status AS ENUM ('new', 'parsed', 'matched', 'shortlisted', 'interviewing', 'offered', 'hired', 'rejected', 'withdrawn');
CREATE TYPE application_status AS ENUM ('new', 'parsed', 'matched', 'shortlisted', 'rejected', 'hold', 'interviewing', 'offered', 'hired', 'withdrawn');
CREATE TYPE notification_status AS ENUM ('pending_approval', 'approved', 'sent', 'failed', 'cancelled');
CREATE TYPE approval_status AS ENUM ('pending', 'approved', 'rejected', 'expired');
CREATE TYPE consent_purpose AS ENUM ('job_application', 'future_opportunities', 'data_processing', 'marketing');

-- Tenants table
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255) UNIQUE NOT NULL,
    subscription_tier VARCHAR(50) DEFAULT 'standard',
    data_region VARCHAR(50) DEFAULT 'us-east-1',
    gdpr_compliant BOOLEAN DEFAULT false,
    ccpa_compliant BOOLEAN DEFAULT false,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'recruiter',
    permissions JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tenant_id, email)
);

-- Jobs table
CREATE TABLE jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    requirements JSONB NOT NULL DEFAULT '{}',
    skills TEXT[] DEFAULT '{}',
    experience_min INTEGER,
    experience_max INTEGER,
    education VARCHAR(255),
    location VARCHAR(255),
    remote_allowed BOOLEAN DEFAULT false,
    salary_min NUMERIC(12,2),
    salary_max NUMERIC(12,2),
    status job_status DEFAULT 'draft',
    created_by UUID REFERENCES users(id),
    published_at TIMESTAMP WITH TIME ZONE,
    closed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Candidates table
CREATE TABLE candidates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    email VARCHAR(255) NOT NULL,
    phone_hash VARCHAR(255),
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    consent_given BOOLEAN DEFAULT false,
    status candidate_status DEFAULT 'new',
    source VARCHAR(100) DEFAULT 'portal',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(tenant_id, email)
);

-- Raw resumes table (immutable storage reference)
CREATE TABLE raw_resumes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    candidate_id UUID NOT NULL REFERENCES candidates(id),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    s3_bucket VARCHAR(255),
    s3_key VARCHAR(512),
    s3_version_id VARCHAR(255),
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    file_size INTEGER,
    file_hash VARCHAR(128),
    encryption_algorithm VARCHAR(50) DEFAULT 'AES-256',
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Candidate profiles (versioned parsed data)
CREATE TABLE candidate_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    candidate_id UUID NOT NULL REFERENCES candidates(id),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    skills TEXT[] DEFAULT '{}',
    experience JSONB DEFAULT '[]',
    education JSONB DEFAULT '[]',
    summary TEXT,
    confidence_scores JSONB DEFAULT '{}',
    embedding_id VARCHAR(255),
    parsing_method VARCHAR(50) DEFAULT 'llm',
    is_current BOOLEAN DEFAULT true,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Applications table
CREATE TABLE applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    candidate_id UUID NOT NULL REFERENCES candidates(id),
    job_id UUID NOT NULL REFERENCES jobs(id),
    match_score NUMERIC(5,4),
    ranking_factors JSONB DEFAULT '{}',
    ai_recommendation VARCHAR(50),
    human_decision VARCHAR(50),
    bias_score NUMERIC(5,4),
    status application_status DEFAULT 'new',
    override_reason TEXT,
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tenant_id, candidate_id, job_id)
);

-- Consents table
CREATE TABLE consents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    candidate_id UUID NOT NULL REFERENCES candidates(id),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    purpose consent_purpose NOT NULL,
    granted BOOLEAN DEFAULT false,
    granted_at TIMESTAMP WITH TIME ZONE,
    revoked_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    ip_address INET,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notifications table
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    candidate_id UUID NOT NULL REFERENCES candidates(id),
    application_id UUID REFERENCES applications(id),
    type VARCHAR(100) NOT NULL,
    status notification_status DEFAULT 'pending_approval',
    subject VARCHAR(500),
    message_template TEXT,
    message_content TEXT,
    recipient_email VARCHAR(255) NOT NULL,
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Approvals table (human-in-the-loop)
CREATE TABLE approvals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID NOT NULL,
    action VARCHAR(100) NOT NULL,
    status approval_status DEFAULT 'pending',
    requested_by UUID REFERENCES users(id),
    decided_by UUID REFERENCES users(id),
    ai_recommendation JSONB,
    decision_reason TEXT,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
    decided_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Interviews table
CREATE TABLE interviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    application_id UUID NOT NULL REFERENCES applications(id),
    interviewer_id UUID REFERENCES users(id),
    scheduled_at TIMESTAMP WITH TIME ZONE,
    duration_minutes INTEGER DEFAULT 60,
    timezone VARCHAR(100),
    meeting_link VARCHAR(512),
    status VARCHAR(50) DEFAULT 'scheduled',
    notes TEXT,
    ai_evaluation JSONB,
    human_feedback JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit logs table (IMMUTABLE)
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID,
    details JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    gdpr_related BOOLEAN DEFAULT false,
    ccpa_related BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Prevent updates and deletes on audit_logs
CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit logs are immutable. UPDATE and DELETE operations are not allowed.';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER no_audit_update
    BEFORE UPDATE OR DELETE ON audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION prevent_audit_modification();

-- Enable Row-Level Security on all tenant tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE raw_resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE interviews ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for tenant isolation
CREATE POLICY tenant_isolation_users ON users
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY tenant_isolation_jobs ON jobs
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY tenant_isolation_candidates ON candidates
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY tenant_isolation_applications ON applications
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY tenant_isolation_audit_logs ON audit_logs
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY tenant_isolation_raw_resumes ON raw_resumes
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY tenant_isolation_candidate_profiles ON candidate_profiles
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY tenant_isolation_consents ON consents
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY tenant_isolation_notifications ON notifications
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY tenant_isolation_approvals ON approvals
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY tenant_isolation_interviews ON interviews
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- Create indexes for performance
CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_jobs_tenant ON jobs(tenant_id);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_candidates_tenant ON candidates(tenant_id);
CREATE INDEX idx_candidates_email ON candidates(email);
CREATE INDEX idx_applications_tenant ON applications(tenant_id);
CREATE INDEX idx_applications_job ON applications(job_id);
CREATE INDEX idx_applications_candidate ON applications(candidate_id);
CREATE INDEX idx_applications_status ON applications(status);
CREATE INDEX idx_audit_logs_tenant ON audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);
CREATE INDEX idx_approvals_tenant ON approvals(tenant_id);
CREATE INDEX idx_approvals_status ON approvals(status);
CREATE INDEX idx_notifications_tenant ON notifications(tenant_id);
CREATE INDEX idx_notifications_status ON notifications(status);

-- Insert default tenant and admin user for development
INSERT INTO tenants (id, name, domain, gdpr_compliant, ccpa_compliant)
VALUES ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Demo Company', 'demo.example.com', true, true);

-- Password: admin123 (bcrypt hashed)
INSERT INTO users (id, tenant_id, email, password_hash, full_name, role, is_active)
VALUES (
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'admin@demo.example.com',
    '$2b$12$LJ3m4ys3GZfnPLRNB3kFm.4ZT5JKr7tAR6m7C.IbyOzUWsPVG/Hy2',
    'Admin User',
    'admin',
    true
);

INSERT INTO users (id, tenant_id, email, password_hash, full_name, role, is_active)
VALUES (
    'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'recruiter@demo.example.com',
    '$2b$12$LJ3m4ys3GZfnPLRNB3kFm.4ZT5JKr7tAR6m7C.IbyOzUWsPVG/Hy2',
    'Jane Recruiter',
    'recruiter',
    true
);
