#!/bin/bash

# Script para probar notificación a un usuario específico por email
# Uso: ./test-notification-by-email.sh <email> <role> [title] [body]
# Ejemplo: ./test-notification-by-email.sh cliente@example.com cliente "Prueba" "Este es un mensaje de prueba"

BASE_URL="http://localhost:8080"

if [ $# -lt 2 ]; then
    echo "Uso: $0 <email> <role> [title] [body]"
    echo ""
    echo "Ejemplo:"
    echo "  $0 cliente@example.com cliente \"Prueba\" \"Este es un mensaje de prueba\""
    echo ""
    echo "Roles disponibles: cliente, empleado, supervisor"
    exit 1
fi

EMAIL=$1
ROLE=$2
TITLE=${3:-"Prueba de Notificación"}
BODY=${4:-"Esta es una notificación de prueba desde el backend"}

echo "Enviando notificación a: $EMAIL"
echo "Rol: $ROLE"
echo "Título: $TITLE"
echo "Mensaje: $BODY"
echo ""

response=$(curl -s -X POST "$BASE_URL/test-notification-by-email" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$EMAIL\",
    \"title\": \"$TITLE\",
    \"body\": \"$BODY\",
    \"role\": \"$ROLE\"
  }")

echo "Respuesta:"
echo "$response" | jq '.' 2>/dev/null || echo "$response"
echo ""

# Verificar respuesta
if echo "$response" | grep -q '"success":true'; then
    echo "✅ Notificación enviada exitosamente!"
    echo "📱 Revisa el dispositivo del usuario para ver la notificación"
else
    echo "❌ Error al enviar notificación"
    echo "💡 Verifica:"
    echo "   - Que el usuario existe en la base de datos"
    echo "   - Que el usuario tiene un token FCM registrado"
    echo "   - Que el usuario esté logueado en la app móvil"
fi

