-- ========================================
-- TABLAS PARA SISTEMA DE CONSULTA AL MOZO
-- ========================================
-- Ejecutar este script en el SQL Editor de Supabase

-- Tabla de consultas
CREATE TABLE IF NOT EXISTS consultas_mozo (
  id BIGSERIAL PRIMARY KEY,
  mesa INTEGER NOT NULL,
  cliente_email TEXT NOT NULL,
  cliente_nombre TEXT,
  estado TEXT NOT NULL CHECK (estado IN ('pendiente', 'respondida', 'cerrada')),
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  mozo_email TEXT,
  mozo_nombre TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de mensajes de consulta
CREATE TABLE IF NOT EXISTS mensajes_consulta (
  id BIGSERIAL PRIMARY KEY,
  consulta_id BIGINT NOT NULL REFERENCES consultas_mozo(id) ON DELETE CASCADE,
  contenido TEXT NOT NULL,
  remitente_tipo TEXT NOT NULL CHECK (remitente_tipo IN ('cliente', 'mozo')),
  remitente_email TEXT NOT NULL,
  remitente_nombre TEXT,
  fecha TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  leido BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_consultas_mesa ON consultas_mozo(mesa);
CREATE INDEX IF NOT EXISTS idx_consultas_estado ON consultas_mozo(estado);
CREATE INDEX IF NOT EXISTS idx_consultas_cliente ON consultas_mozo(cliente_email);
CREATE INDEX IF NOT EXISTS idx_mensajes_consulta ON mensajes_consulta(consulta_id);
CREATE INDEX IF NOT EXISTS idx_mensajes_fecha ON mensajes_consulta(fecha);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar updated_at
CREATE TRIGGER update_consultas_mozo_updated_at
  BEFORE UPDATE ON consultas_mozo
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comentarios para documentación
COMMENT ON TABLE consultas_mozo IS 'Almacena las consultas que los clientes hacen a los mozos';
COMMENT ON TABLE mensajes_consulta IS 'Almacena los mensajes del chat entre clientes y mozos';
COMMENT ON COLUMN consultas_mozo.estado IS 'Estado de la consulta: pendiente, respondida o cerrada';
COMMENT ON COLUMN mensajes_consulta.remitente_tipo IS 'Tipo de remitente: cliente o mozo';

-- ========================================
-- FIN DEL SCRIPT
-- ========================================
-- Para habilitar Realtime en estas tablas:
-- 1. Ve a Database > Replication en Supabase
-- 2. Habilita ambas tablas (consultas_mozo y mensajes_consulta)
-- 3. Selecciona los eventos: INSERT, UPDATE, DELETE
