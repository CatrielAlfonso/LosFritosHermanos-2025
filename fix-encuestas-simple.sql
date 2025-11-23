-- =====================================================
-- SCRIPT SIMPLIFICADO - DESACTIVAR RLS
-- Ejecutar este script para eliminar todas las políticas
-- y permitir acceso completo a la tabla encuestas_delivery
-- =====================================================

-- Desactivar RLS
ALTER TABLE encuestas_delivery DISABLE ROW LEVEL SECURITY;

-- Eliminar todas las políticas existentes
DROP POLICY IF EXISTS "Clientes pueden ver sus encuestas" ON encuestas_delivery;
DROP POLICY IF EXISTS "Clientes pueden crear encuestas" ON encuestas_delivery;
DROP POLICY IF EXISTS "Supervisores pueden ver todas las encuestas" ON encuestas_delivery;
DROP POLICY IF EXISTS "Dueños pueden ver todas las encuestas" ON encuestas_delivery;

-- Eliminar función auxiliar (si existe)
DROP FUNCTION IF EXISTS get_cliente_id_from_auth();

-- Verificar que RLS está desactivado
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'encuestas_delivery';

-- Mensaje de éxito
SELECT '✅ RLS desactivado - Todos pueden ver y crear encuestas' as status;

-- =====================================================
-- NOTA IMPORTANTE
-- =====================================================
-- Con RLS desactivado, cualquier usuario autenticado puede:
-- - Ver todas las encuestas
-- - Crear encuestas
-- - Actualizar encuestas
-- - Eliminar encuestas
--
-- Esto es útil para desarrollo y testing.
-- Para producción, considera reactivar RLS con políticas apropiadas.
-- =====================================================

