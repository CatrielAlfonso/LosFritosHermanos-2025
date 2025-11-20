-- ========================================
-- TABLA PARA SISTEMA DE PEDIDOS DELIVERY
-- ========================================
-- Ejecutar este script en el SQL Editor de Supabase

-- Tabla de pedidos delivery
CREATE TABLE IF NOT EXISTS pedidos_delivery (
  id BIGSERIAL PRIMARY KEY,
  cliente_id BIGINT NOT NULL,
  cliente_email TEXT NOT NULL,
  cliente_nombre TEXT NOT NULL,
  cliente_telefono TEXT,
  
  -- Dirección de entrega
  direccion_calle TEXT NOT NULL,
  direccion_numero TEXT NOT NULL,
  direccion_piso TEXT,
  direccion_depto TEXT,
  direccion_referencia TEXT,
  direccion_completa TEXT NOT NULL,
  
  -- Coordenadas del mapa
  latitud DECIMAL(10, 8),
  longitud DECIMAL(11, 8),
  
  -- Detalles del pedido
  comidas JSONB DEFAULT '[]'::jsonb,
  bebidas JSONB DEFAULT '[]'::jsonb,
  postres JSONB DEFAULT '[]'::jsonb,
  precio_productos DECIMAL(10, 2) NOT NULL,
  precio_envio DECIMAL(10, 2) DEFAULT 0,
  precio_total DECIMAL(10, 2) NOT NULL,
  
  -- Estado y seguimiento
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'confirmado', 'preparando', 'en_camino', 'entregado', 'cancelado')),
  estado_comida TEXT DEFAULT 'pendiente' CHECK (estado_comida IN ('pendiente', 'en preparacion', 'listo', 'cancelado')),
  estado_bebida TEXT DEFAULT 'pendiente' CHECK (estado_bebida IN ('pendiente', 'en preparacion', 'listo', 'cancelado')),
  estado_postre TEXT DEFAULT 'pendiente' CHECK (estado_postre IN ('pendiente', 'en preparacion', 'listo', 'cancelado')),
  
  tiempo_estimado INTEGER DEFAULT 45, -- minutos
  observaciones_generales TEXT,
  motivo_rechazo TEXT,
  
  -- Pago
  metodo_pago TEXT DEFAULT 'efectivo' CHECK (metodo_pago IN ('efectivo', 'transferencia', 'tarjeta')),
  pagado BOOLEAN DEFAULT false,
  monto_pagado DECIMAL(10, 2) DEFAULT 0,
  
  -- Repartidor
  repartidor_id BIGINT,
  repartidor_nombre TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  hora_confirmacion TIMESTAMPTZ,
  hora_preparacion TIMESTAMPTZ,
  hora_en_camino TIMESTAMPTZ,
  hora_entrega TIMESTAMPTZ,
  
  -- Valoración
  calificacion INTEGER CHECK (calificacion >= 1 AND calificacion <= 5),
  comentario_cliente TEXT
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_pedidos_delivery_cliente ON pedidos_delivery(cliente_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_delivery_email ON pedidos_delivery(cliente_email);
CREATE INDEX IF NOT EXISTS idx_pedidos_delivery_estado ON pedidos_delivery(estado);
CREATE INDEX IF NOT EXISTS idx_pedidos_delivery_fecha ON pedidos_delivery(created_at);
CREATE INDEX IF NOT EXISTS idx_pedidos_delivery_repartidor ON pedidos_delivery(repartidor_id);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_pedidos_delivery_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    
    -- Actualizar timestamps según cambio de estado
    IF NEW.estado = 'confirmado' AND OLD.estado = 'pendiente' THEN
        NEW.hora_confirmacion = NOW();
    ELSIF NEW.estado = 'preparando' AND OLD.estado != 'preparando' THEN
        NEW.hora_preparacion = NOW();
    ELSIF NEW.estado = 'en_camino' AND OLD.estado != 'en_camino' THEN
        NEW.hora_en_camino = NOW();
    ELSIF NEW.estado = 'entregado' AND OLD.estado != 'entregado' THEN
        NEW.hora_entrega = NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar updated_at
CREATE TRIGGER update_pedidos_delivery_updated_at
  BEFORE UPDATE ON pedidos_delivery
  FOR EACH ROW
  EXECUTE FUNCTION update_pedidos_delivery_updated_at();

-- Función para calcular precio de envío basado en distancia
CREATE OR REPLACE FUNCTION calcular_precio_envio(lat DECIMAL, lng DECIMAL)
RETURNS DECIMAL AS $$
DECLARE
    precio_base DECIMAL := 500.0; -- Precio base de envío
    precio_por_km DECIMAL := 100.0; -- Precio adicional por km
    distancia_km DECIMAL;
    -- Coordenadas del restaurante (ejemplo, ajustar según ubicación real)
    lat_restaurante DECIMAL := -34.6037;
    lng_restaurante DECIMAL := -58.3816;
BEGIN
    -- Calcular distancia aproximada en km usando fórmula de Haversine simplificada
    distancia_km := 111.195 * SQRT(
        POWER(lat - lat_restaurante, 2) + 
        POWER((lng - lng_restaurante) * COS(RADIANS(lat_restaurante)), 2)
    );
    
    -- Precio base + precio por km
    RETURN precio_base + (precio_por_km * CEIL(distancia_km));
END;
$$ LANGUAGE plpgsql;

-- Comentarios para documentación
COMMENT ON TABLE pedidos_delivery IS 'Almacena los pedidos delivery de los clientes';
COMMENT ON COLUMN pedidos_delivery.estado IS 'Estado del pedido: pendiente, confirmado, preparando, en_camino, entregado, cancelado';
COMMENT ON COLUMN pedidos_delivery.precio_envio IS 'Costo de envío calculado según distancia';
COMMENT ON COLUMN pedidos_delivery.latitud IS 'Latitud de la dirección de entrega (Google Maps)';
COMMENT ON COLUMN pedidos_delivery.longitud IS 'Longitud de la dirección de entrega (Google Maps)';

-- ========================================
-- FIN DEL SCRIPT
-- ========================================
-- Para habilitar Realtime en esta tabla:
-- 1. Ve a Database > Replication en Supabase
-- 2. Habilita la tabla pedidos_delivery
-- 3. Selecciona los eventos: INSERT, UPDATE, DELETE

