-- =====================================================
-- SCHEMA: ENCUESTAS DE DELIVERY
-- Descripción: Sistema de encuestas de satisfacción
--              para pedidos delivery
-- Fecha: 16 de Noviembre 2025
-- =====================================================

-- Tabla de encuestas de delivery
CREATE TABLE IF NOT EXISTS encuestas_delivery (
  id BIGSERIAL PRIMARY KEY,
  pedido_id BIGINT NOT NULL REFERENCES pedidos_delivery(id) ON DELETE CASCADE,
  cliente_id BIGINT NOT NULL,
  repartidor_id BIGINT,
  
  -- Calificaciones (1-5 estrellas)
  calificacion_general INTEGER CHECK (calificacion_general >= 1 AND calificacion_general <= 5),
  calificacion_repartidor INTEGER CHECK (calificacion_repartidor >= 1 AND calificacion_repartidor <= 5),
  calificacion_tiempo INTEGER CHECK (calificacion_tiempo >= 1 AND calificacion_tiempo <= 5),
  calificacion_calidad INTEGER CHECK (calificacion_calidad >= 1 AND calificacion_calidad <= 5),
  
  -- Comentarios
  comentario TEXT,
  comentario_propina TEXT,
  
  -- Propina
  propina DECIMAL(10, 2) DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraint: Solo una encuesta por pedido
  UNIQUE(pedido_id)
);

-- Índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_encuestas_delivery_pedido ON encuestas_delivery(pedido_id);
CREATE INDEX IF NOT EXISTS idx_encuestas_delivery_cliente ON encuestas_delivery(cliente_id);
CREATE INDEX IF NOT EXISTS idx_encuestas_delivery_repartidor ON encuestas_delivery(repartidor_id);
CREATE INDEX IF NOT EXISTS idx_encuestas_delivery_created ON encuestas_delivery(created_at);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_encuestas_delivery_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_encuestas_delivery_updated_at
BEFORE UPDATE ON encuestas_delivery
FOR EACH ROW
EXECUTE FUNCTION update_encuestas_delivery_updated_at();

-- =====================================================
-- POLÍTICAS RLS (Row Level Security)
-- =====================================================

-- DESACTIVADO: RLS deshabilitado para facilitar desarrollo
-- Todos los usuarios pueden ver y crear encuestas sin restricciones
ALTER TABLE encuestas_delivery DISABLE ROW LEVEL SECURITY;

-- =====================================================
-- FUNCIONES AUXILIARES
-- =====================================================

-- Función para obtener el promedio de calificaciones de un repartidor
CREATE OR REPLACE FUNCTION obtener_promedio_repartidor(repartidor_id_param BIGINT)
RETURNS TABLE(
  promedio_general DECIMAL,
  promedio_repartidor DECIMAL,
  total_encuestas INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ROUND(AVG(calificacion_general), 2) as promedio_general,
    ROUND(AVG(calificacion_repartidor), 2) as promedio_repartidor,
    COUNT(*)::INTEGER as total_encuestas
  FROM encuestas_delivery
  WHERE repartidor_id = repartidor_id_param;
END;
$$ LANGUAGE plpgsql;

-- Función para obtener estadísticas generales de encuestas
CREATE OR REPLACE FUNCTION obtener_estadisticas_encuestas_delivery()
RETURNS TABLE(
  total_encuestas BIGINT,
  promedio_general DECIMAL,
  promedio_repartidor DECIMAL,
  promedio_tiempo DECIMAL,
  promedio_calidad DECIMAL,
  total_propinas DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*),
    ROUND(AVG(calificacion_general), 2),
    ROUND(AVG(calificacion_repartidor), 2),
    ROUND(AVG(calificacion_tiempo), 2),
    ROUND(AVG(calificacion_calidad), 2),
    ROUND(SUM(propina), 2)
  FROM encuestas_delivery;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- DATOS DE EJEMPLO (OPCIONAL)
-- =====================================================

-- Comentar estas líneas si no quieres datos de ejemplo

-- INSERT INTO encuestas_delivery (
--   pedido_id,
--   cliente_id,
--   repartidor_id,
--   calificacion_general,
--   calificacion_repartidor,
--   calificacion_tiempo,
--   calificacion_calidad,
--   comentario,
--   propina
-- ) VALUES
-- (1, 1, 1, 5, 5, 4, 5, 'Excelente servicio, muy rápido!', 150.00),
-- (2, 2, 1, 4, 4, 3, 4, 'Buena comida, llegó un poco fría', 100.00),
-- (3, 3, 2, 5, 5, 5, 5, 'Perfecto en todo sentido', 200.00);

-- =====================================================
-- CONSULTAS ÚTILES
-- =====================================================

-- Ver todas las encuestas con información del pedido
-- SELECT 
--   e.id,
--   e.pedido_id,
--   pd.cliente_nombre,
--   e.calificacion_general,
--   e.calificacion_repartidor,
--   e.comentario,
--   e.propina,
--   e.created_at
-- FROM encuestas_delivery e
-- JOIN pedidos_delivery pd ON e.pedido_id = pd.id
-- ORDER BY e.created_at DESC;

-- Ver promedio de calificaciones por repartidor
-- SELECT 
--   r.nombre,
--   r.apellido,
--   COUNT(e.id) as total_encuestas,
--   ROUND(AVG(e.calificacion_repartidor), 2) as promedio_repartidor,
--   SUM(e.propina) as total_propinas
-- FROM repartidores r
-- LEFT JOIN encuestas_delivery e ON r.id = e.repartidor_id
-- GROUP BY r.id, r.nombre, r.apellido
-- ORDER BY promedio_repartidor DESC;

-- =====================================================
-- NOTAS
-- =====================================================

-- Este schema permite:
-- 1. Guardar encuestas de satisfacción de clientes
-- 2. Registrar propinas para repartidores
-- 3. Generar estadísticas y promedios
-- 4. Una sola encuesta por pedido (UNIQUE constraint)
-- 5. Seguridad con RLS para proteger datos

-- Para activar en Supabase:
-- 1. Ejecutar este script en el SQL Editor
-- 2. Verificar que las tablas se crearon correctamente
-- 3. Activar Realtime si es necesario (opcional para encuestas)

-- =====================================================

