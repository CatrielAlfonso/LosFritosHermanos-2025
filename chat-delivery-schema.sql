-- ========================================
-- TABLA PARA CHAT DELIVERY-CLIENTE
-- ========================================
-- Sistema de mensajería entre repartidor y cliente
-- Ejecutar este script DESPUÉS de delivery-schema.sql y repartidores-schema.sql

-- Tabla de conversaciones (salas de chat)
CREATE TABLE IF NOT EXISTS conversaciones_delivery (
  id BIGSERIAL PRIMARY KEY,
  pedido_id BIGINT NOT NULL REFERENCES pedidos_delivery(id) ON DELETE CASCADE,
  cliente_id BIGINT NOT NULL,
  repartidor_id BIGINT NOT NULL REFERENCES repartidores(id) ON DELETE CASCADE,
  
  -- Estado de la conversación
  activa BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Asegurar que solo haya una conversación por pedido
  UNIQUE(pedido_id)
);

-- Tabla de mensajes
CREATE TABLE IF NOT EXISTS mensajes_delivery (
  id BIGSERIAL PRIMARY KEY,
  conversacion_id BIGINT NOT NULL REFERENCES conversaciones_delivery(id) ON DELETE CASCADE,
  
  -- Remitente
  remitente_tipo TEXT NOT NULL CHECK (remitente_tipo IN ('cliente', 'repartidor')),
  remitente_id BIGINT NOT NULL,
  remitente_nombre TEXT NOT NULL,
  
  -- Contenido del mensaje
  mensaje TEXT NOT NULL,
  
  -- Estado del mensaje
  leido BOOLEAN DEFAULT false,
  leido_at TIMESTAMPTZ,
  
  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_conversaciones_pedido ON conversaciones_delivery(pedido_id);
CREATE INDEX IF NOT EXISTS idx_conversaciones_cliente ON conversaciones_delivery(cliente_id);
CREATE INDEX IF NOT EXISTS idx_conversaciones_repartidor ON conversaciones_delivery(repartidor_id);
CREATE INDEX IF NOT EXISTS idx_conversaciones_activa ON conversaciones_delivery(activa);

CREATE INDEX IF NOT EXISTS idx_mensajes_conversacion ON mensajes_delivery(conversacion_id);
CREATE INDEX IF NOT EXISTS idx_mensajes_created ON mensajes_delivery(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mensajes_leido ON mensajes_delivery(leido);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_conversaciones_delivery_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar updated_at
CREATE TRIGGER update_conversaciones_delivery_updated_at
  BEFORE UPDATE ON conversaciones_delivery
  FOR EACH ROW
  EXECUTE FUNCTION update_conversaciones_delivery_updated_at();

-- Función que se ejecuta al insertar un nuevo mensaje
-- Actualiza la conversación para que se ordene al principio
CREATE OR REPLACE FUNCTION actualizar_conversacion_en_mensaje()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE conversaciones_delivery
    SET updated_at = NOW()
    WHERE id = NEW.conversacion_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar conversación al recibir mensaje
CREATE TRIGGER actualizar_conversacion_en_mensaje
  AFTER INSERT ON mensajes_delivery
  FOR EACH ROW
  EXECUTE FUNCTION actualizar_conversacion_en_mensaje();

-- Vista que combina conversaciones con información del último mensaje
CREATE OR REPLACE VIEW conversaciones_delivery_con_ultimo_mensaje AS
SELECT 
  c.*,
  (SELECT mensaje FROM mensajes_delivery WHERE conversacion_id = c.id ORDER BY created_at DESC LIMIT 1) AS ultimo_mensaje,
  (SELECT created_at FROM mensajes_delivery WHERE conversacion_id = c.id ORDER BY created_at DESC LIMIT 1) AS ultimo_mensaje_fecha,
  (SELECT remitente_tipo FROM mensajes_delivery WHERE conversacion_id = c.id ORDER BY created_at DESC LIMIT 1) AS ultimo_mensaje_remitente,
  (SELECT COUNT(*) FROM mensajes_delivery WHERE conversacion_id = c.id AND leido = false AND remitente_tipo = 'cliente') AS mensajes_sin_leer_cliente,
  (SELECT COUNT(*) FROM mensajes_delivery WHERE conversacion_id = c.id AND leido = false AND remitente_tipo = 'repartidor') AS mensajes_sin_leer_repartidor
FROM conversaciones_delivery c;

-- Función para crear conversación automáticamente al asignar repartidor
CREATE OR REPLACE FUNCTION crear_conversacion_delivery_automaticamente()
RETURNS TRIGGER AS $$
BEGIN
  -- Si se asignó un repartidor y no existe conversación, crearla
  IF NEW.repartidor_id IS NOT NULL AND OLD.repartidor_id IS NULL THEN
    INSERT INTO conversaciones_delivery (pedido_id, cliente_id, repartidor_id, activa)
    VALUES (NEW.id, NEW.cliente_id, NEW.repartidor_id, true)
    ON CONFLICT (pedido_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para crear conversación al asignar repartidor
CREATE TRIGGER crear_conversacion_delivery_automaticamente
  AFTER UPDATE ON pedidos_delivery
  FOR EACH ROW
  WHEN (NEW.repartidor_id IS NOT NULL)
  EXECUTE FUNCTION crear_conversacion_delivery_automaticamente();

-- Función para cerrar conversación cuando el pedido se completa
CREATE OR REPLACE FUNCTION cerrar_conversacion_en_pedido_completado()
RETURNS TRIGGER AS $$
BEGIN
  -- Si el pedido se marca como entregado o cancelado, cerrar conversación
  IF NEW.estado IN ('entregado', 'cancelado') AND OLD.estado != NEW.estado THEN
    UPDATE conversaciones_delivery
    SET activa = false
    WHERE pedido_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para cerrar conversación
CREATE TRIGGER cerrar_conversacion_en_pedido_completado
  AFTER UPDATE ON pedidos_delivery
  FOR EACH ROW
  WHEN (NEW.estado IN ('entregado', 'cancelado'))
  EXECUTE FUNCTION cerrar_conversacion_en_pedido_completado();

-- Comentarios para documentación
COMMENT ON TABLE conversaciones_delivery IS 'Sala de chat entre repartidor y cliente para cada pedido';
COMMENT ON TABLE mensajes_delivery IS 'Mensajes enviados en las conversaciones de delivery';
COMMENT ON COLUMN mensajes_delivery.remitente_tipo IS 'Quién envió el mensaje: cliente o repartidor';
COMMENT ON COLUMN conversaciones_delivery.activa IS 'Si la conversación está activa (pedido en curso)';

-- ========================================
-- FUNCIÓN PARA OBTENER MENSAJES NO LEÍDOS
-- ========================================

CREATE OR REPLACE FUNCTION obtener_mensajes_no_leidos_delivery(
  usuario_tipo TEXT,
  usuario_id BIGINT
)
RETURNS TABLE (
  conversacion_id BIGINT,
  pedido_id BIGINT,
  cantidad_mensajes BIGINT
) AS $$
BEGIN
  IF usuario_tipo = 'cliente' THEN
    RETURN QUERY
    SELECT 
      c.id AS conversacion_id,
      c.pedido_id,
      COUNT(m.id) AS cantidad_mensajes
    FROM conversaciones_delivery c
    INNER JOIN mensajes_delivery m ON m.conversacion_id = c.id
    WHERE c.cliente_id = usuario_id
      AND m.leido = false
      AND m.remitente_tipo = 'repartidor'
    GROUP BY c.id, c.pedido_id;
  ELSIF usuario_tipo = 'repartidor' THEN
    RETURN QUERY
    SELECT 
      c.id AS conversacion_id,
      c.pedido_id,
      COUNT(m.id) AS cantidad_mensajes
    FROM conversaciones_delivery c
    INNER JOIN mensajes_delivery m ON m.conversacion_id = c.id
    WHERE c.repartidor_id = usuario_id
      AND m.leido = false
      AND m.remitente_tipo = 'cliente'
    GROUP BY c.id, c.pedido_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- FIN DEL SCRIPT
-- ========================================
-- Para habilitar Realtime en estas tablas (IMPORTANTE para chat):
-- 1. Ve a Database > Replication en Supabase
-- 2. Habilita las tablas: conversaciones_delivery, mensajes_delivery
-- 3. Selecciona eventos: INSERT, UPDATE, DELETE
-- 4. Esto permitirá que los mensajes se actualicen en tiempo real

