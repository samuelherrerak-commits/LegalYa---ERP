-- ============================================================
-- MIGRACIÓN: Períodos automáticos de Conciliaciones Bancarias
-- No modifica migracion_contabilidad.sql ni migracion_cuentas_contables.sql
-- ============================================================

ALTER TABLE conciliaciones ADD COLUMN IF NOT EXISTS fecha_limite DATE;
ALTER TABLE conciliaciones ADD COLUMN IF NOT EXISTS fecha_entrega DATE;

-- Evita duplicados al auto-generar periodos por cuenta + mes
ALTER TABLE conciliaciones DROP CONSTRAINT IF EXISTS unique_conciliacion_periodo;
ALTER TABLE conciliaciones ADD CONSTRAINT unique_conciliacion_periodo UNIQUE (empresa_rif, codigo_cuenta, periodo);
