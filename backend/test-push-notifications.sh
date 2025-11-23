#!/bin/bash

# Script de prueba de Push Notifications
# Uso: ./test-push-notifications.sh

BASE_URL="http://localhost:8080"

echo "=========================================="
echo "  PRUEBA DE PUSH NOTIFICATIONS"
echo "=========================================="
echo ""

# Colores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Función para verificar respuesta
check_response() {
    local response=$1
    local test_name=$2
    
    if echo "$response" | grep -q '"success":true' || echo "$response" | grep -q '"successCount":[1-9]'; then
        echo -e "${GREEN}✅ $test_name: ÉXITO${NC}"
        echo "$response" | jq '.' 2>/dev/null || echo "$response"
    elif echo "$response" | grep -q '"success":false' || echo "$response" | grep -q '"failureCount":[1-9]'; then
        echo -e "${RED}❌ $test_name: FALLÓ${NC}"
        echo "$response" | jq '.' 2>/dev/null || echo "$response"
    else
        echo -e "${YELLOW}⚠️  $test_name: VERIFICAR${NC}"
        echo "$response" | jq '.' 2>/dev/null || echo "$response"
    fi
    echo ""
}

echo "1. Verificando tokens FCM de clientes..."
response=$(curl -s -X GET "$BASE_URL/test-fcm-tokens?role=cliente")
check_response "$response" "Tokens FCM de clientes"
echo ""

echo "2. Verificando tokens FCM de empleados..."
response=$(curl -s -X GET "$BASE_URL/test-fcm-tokens?role=empleado")
check_response "$response" "Tokens FCM de empleados"
echo ""

echo "3. Verificando tokens FCM de supervisores..."
response=$(curl -s -X GET "$BASE_URL/test-fcm-tokens?role=supervisor")
check_response "$response" "Tokens FCM de supervisores"
echo ""

echo "4. Probando notificación a empleados (maitre - nuevo cliente)..."
response=$(curl -s -X POST "$BASE_URL/notify-maitre-new-client" \
  -H "Content-Type: application/json" \
  -d '{"clienteNombre":"Juan","clienteApellido":"Perez"}')
check_response "$response" "Notificación a maitre"
echo ""

echo "5. Probando notificación a mozos (consulta de cliente)..."
response=$(curl -s -X POST "$BASE_URL/notify-mozos-client-query" \
  -H "Content-Type: application/json" \
  -d '{"clienteNombre":"Juan","clienteApellido":"Perez","mesaNumero":5,"consulta":"¿Puedo pedir más agua?"}')
check_response "$response" "Notificación a mozos (consulta)"
echo ""

echo "6. Probando notificación a mozos (pedido listo)..."
response=$(curl -s -X POST "$BASE_URL/notify-mozo-order-ready" \
  -H "Content-Type: application/json" \
  -d '{"mesaNumero":5,"tipoProducto":"Comida","productos":["Hamburguesa","Papas fritas"],"pedidoId":1}')
check_response "$response" "Notificación a mozos (pedido listo)"
echo ""

echo "7. Probando notificación a mozos (solicitud de cuenta)..."
response=$(curl -s -X POST "$BASE_URL/notify-mozo-request-bill" \
  -H "Content-Type: application/json" \
  -d '{"mesaNumero":5,"clienteNombre":"Juan","clienteApellido":"Perez"}')
check_response "$response" "Notificación a mozos (cuenta)"
echo ""

echo "8. Probando notificación a supervisores (nuevo cliente)..."
response=$(curl -s -X POST "$BASE_URL/notify-supervisors-new-client" \
  -H "Content-Type: application/json" \
  -d '{"clienteNombre":"Juan","clienteApellido":"Perez"}')
check_response "$response" "Notificación a supervisores"
echo ""

echo "9. Probando notificación de pago exitoso..."
response=$(curl -s -X POST "$BASE_URL/notify-payment-success" \
  -H "Content-Type: application/json" \
  -d '{"mesaNumero":5,"montoTotal":1500}')
check_response "$response" "Notificación de pago"
echo ""

echo "10. Probando notificación a bartender (nuevo pedido)..."
response=$(curl -s -X POST "$BASE_URL/notify-bartender-new-order" \
  -H "Content-Type: application/json" \
  -d '{"mesaNumero":5,"bebidas":["Coca Cola","Agua"]}')
check_response "$response" "Notificación a bartender"
echo ""

echo "11. Probando notificación a cocinero (nuevo pedido)..."
response=$(curl -s -X POST "$BASE_URL/notify-cocinero-new-order" \
  -H "Content-Type: application/json" \
  -d '{"mesaNumero":5,"comidas":["Hamburguesa","Papas fritas"],"postres":["Flan"]}')
check_response "$response" "Notificación a cocinero"
echo ""

echo "=========================================="
echo "  PRUEBAS COMPLETADAS"
echo "=========================================="
echo ""
echo "📱 Para verificar que las notificaciones funcionan:"
echo "   1. Revisa los dispositivos móviles donde hay usuarios logueados"
echo "   2. Verifica que las notificaciones aparezcan en la pantalla"
echo "   3. Revisa los logs del backend para ver detalles del envío"
echo ""
echo "💡 Tip: Usa el endpoint /test-notification-by-email para probar"
echo "   notificaciones a un usuario específico:"
echo "   curl -X POST $BASE_URL/test-notification-by-email \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"email\":\"usuario@example.com\",\"title\":\"Prueba\",\"body\":\"Mensaje\",\"role\":\"cliente\"}'"
echo ""

