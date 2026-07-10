-- ============================================================
-- MIGRACIÓN: Cuentas Contables por Empresa
-- Tabla independiente para el Plan de Cuentas con CRUD completo
-- ============================================================

CREATE TABLE IF NOT EXISTS cuentas_contables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo TEXT NOT NULL,
    nombre TEXT NOT NULL,
    tipo TEXT DEFAULT '',
    grupo TEXT DEFAULT '',
    naturaleza TEXT DEFAULT 'Deudora',
    tipo_especifico TEXT DEFAULT '',
    rif_empresa TEXT NOT NULL,
    activa BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(codigo, rif_empresa)
);

CREATE INDEX IF NOT EXISTS idx_cc_rif ON cuentas_contables(rif_empresa);
CREATE INDEX IF NOT EXISTS idx_cc_tipo ON cuentas_contables(tipo);
CREATE INDEX IF NOT EXISTS idx_cc_grupo ON cuentas_contables(grupo);
