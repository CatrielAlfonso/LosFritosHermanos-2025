-- =====================================================
-- SCRIPT DE CORRECCIÓN PARA ENCUESTAS DELIVERY
-- Ejecutar PRIMERO este script para limpiar políticas antiguas
-- =====================================================

-- Eliminar políticas existentes (si existen)
DROP POLICY IF EXISTS "Clientes pueden ver sus encuestas" ON encuestas_delivery;
DROP POLICY IF EXISTS "Clientes pueden crear encuestas" ON encuestas_delivery;
DROP POLICY IF EXISTS "Supervisores pueden ver todas las encuestas" ON encuestas_delivery;
DROP POLICY IF EXISTS "Dueños pueden ver todas las encuestas" ON encuestas_delivery;

-- Eliminar función auxiliar antigua (si existe)
DROP FUNCTION IF EXISTS get_cliente_id_from_auth();

-- Desactivar RLS temporalmente
ALTER TABLE encuestas_delivery DISABLE ROW LEVEL SECURITY;

-- =====================================================
-- FUNCIÓN AUXILIAR PARA RLS (CORREGIDA)
-- =====================================================

-- Función para obtener el cliente_id desde el email del usuario autenticado
CREATE OR REPLACE FUNCTION get_cliente_id_from_auth()
RETURNS BIGINT AS $$
DECLARE
  cliente_id_result BIGINT;
BEGIN
  SELECT id INTO cliente_id_result
  FROM clientes
  WHERE correo = auth.email();
  
  RETURN cliente_id_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- POLÍTICAS RLS (CORREGIDAS)
-- =====================================================

-- Habilitar RLS
ALTER TABLE encuestas_delivery ENABLE ROW LEVEL SECURITY;

-- Política: Los clientes pueden ver sus propias encuestas
CREATE POLICY "Clientes pueden ver sus encuestas"
ON encuestas_delivery
FOR SELECT
USING (cliente_id = get_cliente_id_from_auth());

-- Política: Los clientes pueden crear encuestas
CREATE POLICY "Clientes pueden crear encuestas"
ON encuestas_delivery
FOR INSERT
WITH CHECK (cliente_id = get_cliente_id_from_auth());

-- Política: Los supervisores pueden ver todas las encuestas
CREATE POLICY "Supervisores pueden ver todas las encuestas"
ON encuestas_delivery
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM supervisores
    WHERE correo = auth.email()
  )
);

-- Política: Los dueños pueden ver todas las encuestas
CREATE POLICY "Dueños pueden ver todas las encuestas"
ON encuestas_delivery
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM dueños
    WHERE correo = auth.email()
  )
);

-- =====================================================
-- VERIFICACIÓN
-- =====================================================

-- Verificar que las políticas se crearon correctamente
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE tablename = 'encuestas_delivery';

-- Mensaje de éxito
SELECT '✅ Políticas RLS corregidas exitosamente' as status;

