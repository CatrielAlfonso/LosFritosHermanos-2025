#!/bin/bash

# Script para probar la liberación manual de mesas vencidas
# Uso: ./test-liberar-mesas.sh

echo "🧪 Probando liberación manual de mesas vencidas..."
echo "📅 Timestamp: $(date)"
echo ""

# URL del backend (ajustar si es necesario)
BACKEND_URL="http://localhost:3000"

echo "🔗 Enviando petición a: $BACKEND_URL/liberar-mesas-vencidas"
echo ""

# Hacer la petición GET al endpoint
curl -X GET "$BACKEND_URL/liberar-mesas-vencidas" \
  -H "Content-Type: application/json" \
  -w "\n\n📊 Código de respuesta HTTP: %{http_code}\n" \
  -s | jq '.' 2>/dev/null || echo "Respuesta recibida (sin formato JSON)"

echo ""
echo "✅ Prueba completada"
