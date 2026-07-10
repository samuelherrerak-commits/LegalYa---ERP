-- ============================================================
-- MIGRACIÓN: Módulo Contabilidad — Servicios Profesionales
-- ============================================================

-- 0. Secuencia para códigos de servicio
CREATE SEQUENCE IF NOT EXISTS seq_sp START 1;

-- 1. Tipos de servicio
CREATE TABLE IF NOT EXISTS servicios_profesionales_tipos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL UNIQUE,
    descripcion TEXT,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO servicios_profesionales_tipos (nombre) VALUES
    ('Estado Financiero'),
    ('Certificación de Ingresos'),
    ('Carta Bancaria'),
    ('Constancia'),
    ('Informe Especial'),
    ('Auditoría Especial'),
    ('Asesoría Tributaria'),
    ('Asesoría Contable'),
    ('Asesoría Laboral'),
    ('Otro')
ON CONFLICT (nombre) DO NOTHING;

-- 2. Servicios Profesionales (centralizado con JSONB)
CREATE TABLE IF NOT EXISTS servicios_profesionales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo TEXT UNIQUE NOT NULL DEFAULT ('SP-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('seq_sp')::TEXT, 4, '0')),
    tipo TEXT NOT NULL,
    estado TEXT NOT NULL DEFAULT 'pendiente',
    prioridad TEXT DEFAULT 'normal',
    empresa_rif TEXT NOT NULL,
    empresa_nombre TEXT,
    responsable TEXT,
    descripcion TEXT,
    fecha_estimada DATE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    timeline JSONB DEFAULT '[]',
    mensajes JSONB DEFAULT '[]',
    archivos JSONB DEFAULT '[]',
    requerimientos JSONB DEFAULT '[]',
    documentos_emitidos JSONB DEFAULT '[]',
    observaciones JSONB DEFAULT '[]'
);

-- 3. Conciliaciones Bancarias
CREATE TABLE IF NOT EXISTS conciliaciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_rif TEXT NOT NULL,
    codigo_cuenta TEXT NOT NULL,
    nombre_cuenta TEXT,
    periodo TEXT NOT NULL,
    estado TEXT DEFAULT 'pendiente',
    archivos JSONB DEFAULT '[]',
    observaciones TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Declaraciones (solo lectura desde el cliente)
CREATE TABLE IF NOT EXISTS declaraciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo TEXT NOT NULL,
    periodo TEXT NOT NULL,
    empresa_rif TEXT NOT NULL,
    estado TEXT DEFAULT 'emitida',
    fecha_emision DATE DEFAULT CURRENT_DATE,
    fecha_vencimiento DATE,
    archivos JSONB DEFAULT '[]',
    observaciones TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Agregar tipo_especifico al plan de cuentas
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS tipo_especifico TEXT DEFAULT '';

-- 5. Índices
CREATE INDEX IF NOT EXISTS idx_sp_empresa ON servicios_profesionales(empresa_rif);
CREATE INDEX IF NOT EXISTS idx_sp_estado ON servicios_profesionales(estado);
CREATE INDEX IF NOT EXISTS idx_sp_tipo ON servicios_profesionales(tipo);
CREATE INDEX IF NOT EXISTS idx_conciliaciones_empresa ON conciliaciones(empresa_rif);
CREATE INDEX IF NOT EXISTS idx_conciliaciones_cuenta ON conciliaciones(codigo_cuenta);
CREATE INDEX IF NOT EXISTS idx_declaraciones_empresa ON declaraciones(empresa_rif);
CREATE INDEX IF NOT EXISTS idx_declaraciones_tipo ON declaraciones(tipo);
