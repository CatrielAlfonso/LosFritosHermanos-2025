-- ========================================
-- TABLA PARA SISTEMA DE RESERVAS AGENDADAS
-- ========================================
-- Ejecutar este script en el SQL Editor de Supabase

-- Tabla de reservas
CREATE TABLE IF NOT EXISTS reservas (
  id BIGSERIAL PRIMARY KEY,
  cliente_id BIGINT NOT NULL,
  cliente_email TEXT NOT NULL,
  cliente_nombre TEXT NOT NULL,
  cliente_apellido TEXT,
  fecha_reserva DATE NOT NULL,
  hora_reserva TIME NOT NULL,
  cantidad_comensales INTEGER NOT NULL DEFAULT 1,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'confirmada', 'cancelada', 'completada')),
  mesa_numero INTEGER,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraint para asegurar que la fecha y hora sean futuras
  CONSTRAINT fecha_futura CHECK (fecha_reserva > CURRENT_DATE OR (fecha_reserva = CURRENT_DATE AND hora_reserva > CURRENT_TIME))
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_reservas_cliente ON reservas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_reservas_cliente_email ON reservas(cliente_email);
CREATE INDEX IF NOT EXISTS idx_reservas_fecha ON reservas(fecha_reserva);
CREATE INDEX IF NOT EXISTS idx_reservas_fecha_hora ON reservas(fecha_reserva, hora_reserva);
CREATE INDEX IF NOT EXISTS idx_reservas_estado ON reservas(estado);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_reservas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar updated_at
CREATE TRIGGER update_reservas_updated_at
  BEFORE UPDATE ON reservas
  FOR EACH ROW
  EXECUTE FUNCTION update_reservas_updated_at();

-- Función para validar que la reserva sea en el futuro
CREATE OR REPLACE FUNCTION validar_reserva_futura()
RETURNS TRIGGER AS $$
BEGIN
    -- Validar que la fecha y hora sean futuras
    IF NEW.fecha_reserva < CURRENT_DATE OR 
       (NEW.fecha_reserva = CURRENT_DATE AND NEW.hora_reserva <= CURRENT_TIME) THEN
        RAISE EXCEPTION 'La reserva debe ser en una fecha y hora futuras';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para validar reserva futura
CREATE TRIGGER validar_reserva_futura_trigger
  BEFORE INSERT OR UPDATE ON reservas
  FOR EACH ROW
  EXECUTE FUNCTION validar_reserva_futura();

-- Comentarios para documentación
COMMENT ON TABLE reservas IS 'Almacena las reservas agendadas de los clientes';
COMMENT ON COLUMN reservas.estado IS 'Estado de la reserva: pendiente, confirmada, cancelada, completada';
COMMENT ON COLUMN reservas.fecha_reserva IS 'Fecha de la reserva (debe ser futura)';
COMMENT ON COLUMN reservas.hora_reserva IS 'Hora de la reserva (debe ser futura si es el mismo día)';

-- ========================================
-- FIN DEL SCRIPT
-- ========================================
-- Para habilitar Realtime en esta tabla:
-- 1. Ve a Database > Replication en Supabase
-- 2. Habilita la tabla reservas
-- 3. Selecciona los eventos: INSERT, UPDATE, DELETE

