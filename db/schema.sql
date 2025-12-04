-- Strategic Planning Database Schema
-- Run this on your VPS PostgreSQL server

-- Create database (run as superuser)
-- CREATE DATABASE fbg_planning;

-- Connect to the database and run the following:

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Strategic concepts (e.g., "Verksamhetsplanering", "Företagsträffar")
CREATE TABLE strategic_concepts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_time_based BOOLEAN DEFAULT false,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Focus areas within each concept
CREATE TABLE focus_areas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    concept_id UUID REFERENCES strategic_concepts(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(7) NOT NULL,
    start_month INTEGER,
    end_month INTEGER,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Activities/Events
CREATE TABLE activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    focus_area_id UUID REFERENCES focus_areas(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    start_date DATE,
    end_date DATE,
    responsible VARCHAR(100),
    purpose VARCHAR(100),
    theme VARCHAR(100),
    target_group VARCHAR(200),
    status VARCHAR(20) DEFAULT 'ongoing',
    weeks INTEGER[] DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for better query performance
CREATE INDEX idx_focus_areas_concept ON focus_areas(concept_id);
CREATE INDEX idx_activities_focus_area ON activities(focus_area_id);
CREATE INDEX idx_activities_status ON activities(status);
CREATE INDEX idx_activities_start_date ON activities(start_date);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_strategic_concepts_updated_at
    BEFORE UPDATE ON strategic_concepts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_focus_areas_updated_at
    BEFORE UPDATE ON focus_areas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_activities_updated_at
    BEFORE UPDATE ON activities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Seed data: Verksamhetsplanering (time-based tertials)
INSERT INTO strategic_concepts (id, name, description, is_time_based, sort_order) VALUES
    ('11111111-1111-1111-1111-111111111111', 'Verksamhetsplanering', 'Tertialbaserad planering för Service & Kompetens, Platsutveckling, Etablering & Innovation', true, 1);

INSERT INTO focus_areas (concept_id, name, color, start_month, end_month, sort_order) VALUES
    ('11111111-1111-1111-1111-111111111111', 'Service & Kompetens', '#93C5FD', 0, 3, 1),
    ('11111111-1111-1111-1111-111111111111', 'Platsutveckling', '#86EFAC', 4, 7, 2),
    ('11111111-1111-1111-1111-111111111111', 'Etablering & Innovation', '#FCA5A5', 8, 11, 3);

-- Seed data: Företagsträffar (theme-based categories)
INSERT INTO strategic_concepts (id, name, description, is_time_based, sort_order) VALUES
    ('22222222-2222-2222-2222-222222222222', 'Företagsträffar', 'Temabaserade företagsaktiviteter', false, 2);

INSERT INTO focus_areas (concept_id, name, color, start_month, end_month, sort_order) VALUES
    ('22222222-2222-2222-2222-222222222222', 'Lätt att göra rätt', '#93C5FD', NULL, NULL, 1),
    ('22222222-2222-2222-2222-222222222222', 'Mod att växa', '#FDBA74', NULL, NULL, 2),
    ('22222222-2222-2222-2222-222222222222', 'Framtidssäkring av företag', '#86EFAC', NULL, NULL, 3),
    ('22222222-2222-2222-2222-222222222222', 'Falkenberg växer', '#D8B4FE', NULL, NULL, 4);
