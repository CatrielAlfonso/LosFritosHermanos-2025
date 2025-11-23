-- ========================================
-- ACTUALIZACIÓN PARA SISTEMA DE ASIGNACIÓN DE MESAS EN RESERVAS
-- ========================================

-- Agregar columnas necesarias a la tabla reservas
ALTER TABLE reservas 
ADD COLUMN IF NOT EXISTS mesa_id BIGINT REFERENCES mesas(id),
ADD COLUMN IF NOT EXISTS hora_asignacion TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS hora_limite TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS cliente_llego BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS hora_llegada TIMESTAMPTZ;

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_reservas_mesa_id ON reservas(mesa_id);
CREATE INDEX IF NOT EXISTS idx_reservas_hora_limite ON reservas(hora_limite);

-- Función para asignar mesa a una reserva
CREATE OR REPLACE FUNCTION asignar_mesa_reserva(
  p_reserva_id BIGINT,
  p_mesa_id BIGINT
)
RETURNS JSON AS $$
DECLARE
  v_mesa_ocupada BOOLEAN;
  v_mesa_numero INTEGER;
  v_result JSON;
BEGIN
  -- Verificar si la mesa existe y está disponible
  SELECT ocupada, numero INTO v_mesa_ocupada, v_mesa_numero
  FROM mesas
  WHERE id = p_mesa_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mesa no encontrada';
  END IF;
  
  IF v_mesa_ocupada THEN
    RAISE EXCEPTION 'La mesa ya está ocupada';
  END IF;
  
  -- Verificar si la mesa ya tiene una reserva confirmada en ese horario
  IF EXISTS (
    SELECT 1 FROM reservas r
    WHERE r.mesa_id = p_mesa_id
    AND r.estado IN ('confirmada', 'pendiente')
    AND r.id != p_reserva_id
    AND r.fecha_reserva = (SELECT fecha_reserva FROM reservas WHERE id = p_reserva_id)
    AND ABS(EXTRACT(EPOCH FROM (r.hora_reserva - (SELECT hora_reserva FROM reservas WHERE id = p_reserva_id)))) < 7200 -- 2 horas de diferencia
  ) THEN
    RAISE EXCEPTION 'La mesa ya tiene una reserva en ese horario';
  END IF;
  
  -- Asignar la mesa y establecer hora límite (45 minutos)
  UPDATE reservas
  SET 
    mesa_id = p_mesa_id,
    mesa_numero = v_mesa_numero,
    hora_asignacion = NOW(),
    hora_limite = NOW() + INTERVAL '45 minutes',
    estado = 'confirmada'
  WHERE id = p_reserva_id;
  
  -- Marcar la mesa como ocupada (reservada)
  UPDATE mesas
  SET ocupada = TRUE
  WHERE id = p_mesa_id;
  
  v_result := json_build_object(
    'success', TRUE,
    'message', 'Mesa asignada correctamente',
    'mesa_numero', v_mesa_numero,
    'hora_limite', NOW() + INTERVAL '45 minutes'
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Función para liberar mesa si el cliente no llegó en 45 minutos
CREATE OR REPLACE FUNCTION liberar_mesas_vencidas()
RETURNS JSON AS $$
DECLARE
  v_reservas_liberadas INTEGER := 0;
  v_reserva RECORD;
BEGIN
  -- Buscar reservas con hora límite vencida y cliente no llegó
  FOR v_reserva IN 
    SELECT r.id, r.mesa_id, r.mesa_numero
    FROM reservas r
    WHERE r.estado = 'confirmada'
    AND r.hora_limite < NOW()
    AND r.cliente_llego = FALSE
    AND r.mesa_id IS NOT NULL
  LOOP
    -- Liberar la mesa
    UPDATE mesas
    SET 
      ocupada = FALSE,
      "clienteAsignadoId" = NULL
    WHERE id = v_reserva.mesa_id;
    
    -- Cancelar la reserva
    UPDATE reservas
    SET 
      estado = 'cancelada',
      notas = COALESCE(notas || ' | ', '') || 'Cancelada automáticamente por no presentarse en 45 minutos'
    WHERE id = v_reserva.id;
    
    v_reservas_liberadas := v_reservas_liberadas + 1;
  END LOOP;
  
  RETURN json_build_object(
    'success', TRUE,
    'reservas_liberadas', v_reservas_liberadas
  );
END;
$$ LANGUAGE plpgsql;

-- Función para confirmar llegada del cliente mediante QR
CREATE OR REPLACE FUNCTION confirmar_llegada_cliente(
  p_mesa_id BIGINT,
  p_cliente_id BIGINT
)
RETURNS JSON AS $$
DECLARE
  v_reserva_id BIGINT;
  v_mesa_numero INTEGER;
BEGIN
  -- Buscar la reserva activa del cliente para esa mesa
  SELECT r.id, r.mesa_numero INTO v_reserva_id, v_mesa_numero
  FROM reservas r
  WHERE r.mesa_id = p_mesa_id
  AND r.cliente_id = p_cliente_id
  AND r.estado = 'confirmada'
  AND r.fecha_reserva = CURRENT_DATE
  AND r.cliente_llego = FALSE
  ORDER BY r.hora_reserva DESC
  LIMIT 1;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se encontró una reserva activa para esta mesa y cliente';
  END IF;
  
  -- Marcar que el cliente llegó
  UPDATE reservas
  SET 
    cliente_llego = TRUE,
    hora_llegada = NOW()
  WHERE id = v_reserva_id;
  
  -- Actualizar mesa con el cliente asignado
  UPDATE mesas
  SET 
    "clienteAsignadoId" = p_cliente_id,
    ocupada = TRUE
  WHERE id = p_mesa_id;
  
  -- Marcar al cliente como sentado
  UPDATE clientes
  SET sentado = TRUE
  WHERE id = p_cliente_id;
  
  RETURN json_build_object(
    'success', TRUE,
    'message', 'Cliente confirmado en la mesa',
    'mesa_numero', v_mesa_numero,
    'reserva_id', v_reserva_id
  );
END;
$$ LANGUAGE plpgsql;

-- Trigger para liberar mesas automáticamente (se ejecuta periódicamente)
-- Nota: Este trigger debe ser llamado por un cron job o función programada
CREATE OR REPLACE FUNCTION trigger_liberar_mesas()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM liberar_mesas_vencidas();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Comentarios para documentación
COMMENT ON COLUMN reservas.mesa_id IS 'ID de la mesa asignada a la reserva';
COMMENT ON COLUMN reservas.hora_asignacion IS 'Hora en que se asignó la mesa';
COMMENT ON COLUMN reservas.hora_limite IS 'Hora límite para que el cliente llegue (45 minutos después de la asignación)';
COMMENT ON COLUMN reservas.cliente_llego IS 'Indica si el cliente llegó y escaneó el QR';
COMMENT ON COLUMN reservas.hora_llegada IS 'Hora en que el cliente escaneó el QR y se sentó';

COMMENT ON FUNCTION asignar_mesa_reserva IS 'Asigna una mesa a una reserva y establece el tiempo límite de 45 minutos';
COMMENT ON FUNCTION liberar_mesas_vencidas IS 'Libera las mesas de reservas que no se presentaron en 45 minutos';
COMMENT ON FUNCTION confirmar_llegada_cliente IS 'Confirma la llegada del cliente mediante escaneo de QR';

-- ========================================
-- INSTRUCCIONES DE USO
-- ========================================
-- 1. Ejecutar este script en Supabase SQL Editor
-- 2. Configurar un Edge Function o cron job que ejecute liberar_mesas_vencidas() cada 5 minutos
-- 3. En el código de la app, llamar a asignar_mesa_reserva() cuando el maitre asigne una mesa
-- 4. Llamar a confirmar_llegada_cliente() cuando el cliente escanee el QR de la mesa

