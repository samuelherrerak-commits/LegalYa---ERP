CREATE TABLE IF NOT EXISTS inventario_auditoria (
  id SERIAL PRIMARY KEY,
  empresa_rif TEXT NOT NULL,
  fecha_inicio TIMESTAMPTZ DEFAULT NOW(),
  fecha_fin TIMESTAMPTZ,
  estado TEXT DEFAULT 'en_curso',
  items JSONB DEFAULT '[]',
  resumen JSONB DEFAULT '{}'
);
