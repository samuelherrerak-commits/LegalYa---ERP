-- ============================================================
-- MIGRACIÓN LIMPIA: empresas_ly + usuarios
-- LegalYa — Sin DO blocks, sin silenciar errores
-- ============================================================

-- 1. DROP de objetos existentes
DROP SEQUENCE IF EXISTS seq_codigo_ly CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;
DROP TABLE IF EXISTS empresas_ly CASCADE;

-- 2. Extensiones
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 3. Secuencia para códigos de registro
CREATE SEQUENCE seq_codigo_ly START 1;

-- 4. Tabla maestra: empresas_ly
CREATE TABLE empresas_ly (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_registro TEXT UNIQUE NOT NULL DEFAULT ('LY-' || to_char(CURRENT_DATE, 'YYYY') || '-' || lpad(nextval('seq_codigo_ly')::TEXT, 6, '0')),
    rif TEXT UNIQUE NOT NULL,
    razon_social TEXT NOT NULL,
    nombre_comercial TEXT,
    actividad_economica TEXT,
    pais TEXT DEFAULT 'VE',
    zona_horaria TEXT DEFAULT 'America/Caracas',
    moneda_base TEXT DEFAULT 'USD',
    representante_legal TEXT,
    cedula_representante TEXT,
    correo TEXT,
    telefono TEXT,
    direccion TEXT,
    logo_url TEXT,
    plan TEXT DEFAULT 'basico',
    cantidad_usuarios INTEGER DEFAULT 1,
    modulos_activos JSONB DEFAULT '[]'::JSONB,
    configuracion JSONB DEFAULT '{}'::JSONB,
    estado TEXT NOT NULL DEFAULT 'prospecto',
    fecha_registro TIMESTAMPTZ NOT NULL DEFAULT now(),
    fecha_activacion TIMESTAMPTZ,
    fecha_vencimiento TIMESTAMPTZ,
    fecha_ultimo_cierre DATE,
    icc_actual NUMERIC(5,2),
    bie_actual NUMERIC(5,2),
    requiere_auditoria BOOLEAN DEFAULT FALSE,
    ultima_sincronizacion TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_estado CHECK (estado IN ('prospecto','documentacion_pendiente','pendiente_activacion','activa','suspendida','cancelada'))
);

-- 5. Tabla: usuarios
CREATE TABLE usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES empresas_ly(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    rol TEXT NOT NULL DEFAULT 'vendedor',
    telefono TEXT,
    activo BOOLEAN DEFAULT TRUE,
    ultimo_acceso TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_rol CHECK (rol IN ('CLIENTE','AUDITOR'))
);

-- 6. Índices
CREATE INDEX idx_empresas_ly_estado ON empresas_ly(estado);
CREATE INDEX idx_empresas_ly_plan ON empresas_ly(plan);
CREATE INDEX idx_empresas_ly_rif ON empresas_ly(rif);
CREATE INDEX idx_empresas_ly_codigo ON empresas_ly(codigo_registro);
CREATE INDEX idx_empresas_ly_bie ON empresas_ly(bie_actual);
CREATE INDEX idx_empresas_ly_requiere_aud ON empresas_ly(requiere_auditoria);
CREATE INDEX idx_usuarios_empresa_id ON usuarios(empresa_id);
CREATE INDEX idx_usuarios_rol ON usuarios(rol);
CREATE INDEX idx_usuarios_email ON usuarios(email);

-- 7. Trigger: updated_at automático
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_empresas_ly_updated_at
    BEFORE UPDATE ON empresas_ly
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER trg_usuarios_updated_at
    BEFORE UPDATE ON usuarios
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- 8. Funciones útiles
CREATE OR REPLACE FUNCTION buscar_por_codigo(codigo TEXT)
RETURNS empresas_ly LANGUAGE plpgsql STABLE AS $$
DECLARE
    empresa empresas_ly;
BEGIN
    SELECT * INTO empresa FROM empresas_ly WHERE codigo_registro = codigo;
    RETURN empresa;
END;
$$;

CREATE OR REPLACE FUNCTION activar_empresa(empresa_id UUID)
RETURNS empresas_ly LANGUAGE plpgsql AS $$
DECLARE
    empresa empresas_ly;
BEGIN
    UPDATE empresas_ly
    SET estado = 'activa', fecha_activacion = now()
    WHERE id = empresa_id AND estado IN ('prospecto','pendiente_activacion')
    RETURNING * INTO empresa;
    RETURN empresa;
END;
$$;

-- 9. SEED DATA
INSERT INTO empresas_ly (rif, razon_social, nombre_comercial, actividad_economica, estado, plan, cantidad_usuarios, modulos_activos, correo, telefono, direccion, representante_legal, cedula_representante, fecha_activacion, bie_actual, icc_actual, codigo_registro)
VALUES ('V305803231', 'LEGALYA C.A.', 'LegalYa', 'Servicios de Software Contable y Legal', 'activa', 'enterprise', 10, '["comercios","auditor","contabilidad","rrhh"]'::JSONB, 'contacto@legalya.com', '+582127000000', 'Caracas, Venezuela', 'Samuel LegalYa', 'V12345678', now(), 92.50, 88.00, 'LY-2026-000001');

WITH emp AS (SELECT id FROM empresas_ly WHERE rif = 'V305803231')
INSERT INTO usuarios (empresa_id, nombre, email, password_hash, rol)
SELECT id, 'Samuel', 'samuel@legalya.com', '1234', 'CLIENTE' FROM emp
UNION ALL
SELECT id, 'Armando', 'armando@legalya.com', '1234', 'AUDITOR' FROM emp;

-- 10. Comentarios
COMMENT ON TABLE  empresas_ly IS 'Tabla maestra única: LegalYa Comercios + LegalYa Auditor';
COMMENT ON COLUMN empresas_ly.codigo_registro IS 'Código tipo LY-2026-000001';
COMMENT ON COLUMN empresas_ly.icc_actual IS 'Índice de Confiabilidad Contable (0-100)';
COMMENT ON COLUMN empresas_ly.bie_actual IS 'Business Intelligence Empresarial (0-100)';
COMMENT ON COLUMN empresas_ly.requiere_auditoria IS 'Flag que activan los motores del Auditor';
COMMENT ON COLUMN empresas_ly.fecha_ultimo_cierre IS 'Último período contable cerrado';
COMMENT ON COLUMN empresas_ly.ultima_sincronizacion IS 'Última vez que Auditor actualizó indicadores';
