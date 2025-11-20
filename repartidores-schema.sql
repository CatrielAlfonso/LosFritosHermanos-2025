-- ========================================
-- TABLA PARA REPARTIDORES (DELIVERY DRIVERS)
-- ========================================
-- Ejecutar este script en el SQL Editor de Supabase
-- DESPUÉS de ejecutar delivery-schema.sql

-- Tabla de repartidores
CREATE TABLE IF NOT EXISTS repartidores (
  id BIGSERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  apellido TEXT NOT NULL,
  correo TEXT UNIQUE NOT NULL,
  telefono TEXT,
  dni TEXT UNIQUE,
  foto_perfil TEXT,
  
  -- Estado del repartidor
  activo BOOLEAN DEFAULT true,
  disponible BOOLEAN DEFAULT false, -- Si está disponible para tomar pedidos
  
  -- Ubicación actual (para seguimiento en tiempo real)
  latitud_actual DECIMAL(10, 8),
  longitud_actual DECIMAL(11, 8),
  ultima_actualizacion_ubicacion TIMESTAMPTZ,
  
  -- Estadísticas
  pedidos_completados INTEGER DEFAULT 0,
  calificacion_promedio DECIMAL(3, 2) DEFAULT 5.0,
  
  -- Vehículo
  tipo_vehiculo TEXT CHECK (tipo_vehiculo IN ('bicicleta', 'moto', 'auto')) DEFAULT 'bicicleta',
  patente TEXT,
  
  -- Push notifications
  fcm_token TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_contratacion DATE DEFAULT CURRENT_DATE
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_repartidores_correo ON repartidores(correo);
CREATE INDEX IF NOT EXISTS idx_repartidores_disponible ON repartidores(disponible);
CREATE INDEX IF NOT EXISTS idx_repartidores_activo ON repartidores(activo);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_repartidores_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar updated_at
CREATE TRIGGER update_repartidores_updated_at
  BEFORE UPDATE ON repartidores
  FOR EACH ROW
  EXECUTE FUNCTION update_repartidores_updated_at();

-- Modificar tabla pedidos_delivery para agregar relación con repartidores
-- (Solo si no existe la restricción)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'pedidos_delivery_repartidor_fkey'
  ) THEN
    ALTER TABLE pedidos_delivery
    ADD CONSTRAINT pedidos_delivery_repartidor_fkey
    FOREIGN KEY (repartidor_id) REFERENCES repartidores(id);
  END IF;
END $$;

-- Comentarios para documentación
COMMENT ON TABLE repartidores IS 'Almacena información de los repartidores/delivery drivers';
COMMENT ON COLUMN repartidores.disponible IS 'Indica si el repartidor está disponible para tomar nuevos pedidos';
COMMENT ON COLUMN repartidores.tipo_vehiculo IS 'Tipo de vehículo: bicicleta, moto, auto';

-- ========================================
-- INSERTAR REPARTIDORES DE EJEMPLO
-- ========================================
-- Descomentar para crear repartidores de prueba

/*
INSERT INTO repartidores (nombre, apellido, correo, telefono, dni, tipo_vehiculo, disponible, activo) VALUES
('Carlos', 'Ramírez', 'carlos.ramirez@delivery.com', '+54 9 11 1111-1111', '30111111', 'moto', true, true),
('María', 'González', 'maria.gonzalez@delivery.com', '+54 9 11 2222-2222', '30222222', 'bicicleta', true, true),
('Juan', 'Pérez', 'juan.perez@delivery.com', '+54 9 11 3333-3333', '30333333', 'auto', false, true);
*/

-- ========================================
-- VISTA PARA PEDIDOS CON REPARTIDORES
-- ========================================
-- Vista que combina información de pedidos y repartidores

CREATE OR REPLACE VIEW pedidos_delivery_con_repartidor AS
SELECT 
  pd.*,
  r.nombre AS repartidor_nombre_completo,
  r.apellido AS repartidor_apellido,
  r.telefono AS repartidor_telefono,
  r.tipo_vehiculo AS repartidor_vehiculo,
  r.calificacion_promedio AS repartidor_calificacion,
  r.disponible AS repartidor_disponible
FROM pedidos_delivery pd
LEFT JOIN repartidores r ON pd.repartidor_id = r.id;

-- ========================================
-- FUNCIÓN PARA ASIGNAR REPARTIDOR AUTOMÁTICAMENTE
-- ========================================
-- Asigna el repartidor disponible más cercano al restaurante

CREATE OR REPLACE FUNCTION asignar_repartidor_automatico(pedido_id BIGINT)
RETURNS BIGINT AS $$
DECLARE
  repartidor_asignado_id BIGINT;
BEGIN
  -- Buscar repartidor disponible (por ahora, el primero disponible)
  SELECT id INTO repartidor_asignado_id
  FROM repartidores
  WHERE disponible = true AND activo = true
  ORDER BY pedidos_completados ASC -- Asignar al que tiene menos pedidos
  LIMIT 1;
  
  -- Si se encontró un repartidor, asignarlo al pedido
  IF repartidor_asignado_id IS NOT NULL THEN
    UPDATE pedidos_delivery
    SET 
      repartidor_id = repartidor_asignado_id,
      estado = 'confirmado'
    WHERE id = pedido_id;
    
    -- Marcar repartidor como no disponible temporalmente
    UPDATE repartidores
    SET disponible = false
    WHERE id = repartidor_asignado_id;
  END IF;
  
  RETURN repartidor_asignado_id;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- FUNCIÓN PARA LIBERAR REPARTIDOR
-- ========================================
-- Cuando un pedido se completa, el repartidor queda disponible nuevamente

CREATE OR REPLACE FUNCTION liberar_repartidor(pedido_id BIGINT)
RETURNS VOID AS $$
DECLARE
  rep_id BIGINT;
BEGIN
  -- Obtener el ID del repartidor del pedido
  SELECT repartidor_id INTO rep_id
  FROM pedidos_delivery
  WHERE id = pedido_id;
  
  -- Marcar repartidor como disponible
  IF rep_id IS NOT NULL THEN
    UPDATE repartidores
    SET disponible = true
    WHERE id = rep_id;
    
    -- Incrementar contador de pedidos completados
    UPDATE repartidores
    SET pedidos_completados = pedidos_completados + 1
    WHERE id = rep_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- FIN DEL SCRIPT
-- ========================================
-- Para habilitar Realtime en esta tabla:
-- 1. Ve a Database > Replication en Supabase
-- 2. Habilita la tabla repartidores
-- 3. Selecciona los eventos: INSERT, UPDATE, DELETE

