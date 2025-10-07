# Backend Setup para LosFritosHermanos

## ✅ Lo que ya tienes configurado:

1. **Backend copiado** desde TacoMex con todas las funciones de push notifications
2. **URLs configuradas** en los environment files
3. **Push Notification Service** apuntando al backend correcto

## 🚀 Cómo ejecutar el backend:

### Para desarrollo local:
```bash
# Ir a la carpeta backend
cd backend

# Instalar dependencias
npm install

# Ejecutar en modo desarrollo
npm run dev
```

El backend correrá en `http://localhost:3000`

### Para producción:
Puedes desplegar el backend en:
- **Render.com** (recomendado)
- **Railway.app**
- **Heroku**
- **Vercel**

## 🔧 Configuración (YA LISTA):

### 1. Variables de entorno

#### SendGrid (Nuevo)
⚠️ **Configuración necesaria para emails**:
1. Verificar tu email personal en SendGrid:
   - Ir a SendGrid → Settings → Sender Authentication
   - Elegir "Verify a Single Sender"
   - Usar tu email personal (Gmail/Outlook)
   - Seguir los pasos de verificación

2. Crear archivo `.env` en la carpeta backend con:
```
# SendGrid Configuration
SENDGRID_API_KEY=tu_api_key_de_sendgrid
SENDGRID_FROM_EMAIL=tu_email_personal@gmail.com  # El email que verificaste
```

Los emails se enviarán desde tu email personal con el nombre "Los Fritos Hermanos"

#### Existentes
✅ **Ya configuradas directamente en el código**:
- Supabase URL y Key configuradas
- Puerto 3000 por defecto

### 2. Firebase Admin (para push notifications)
✅ **Ya configurado**:
- Archivo `taco--mex-firebase-adminsdk-fbsvc-b23e7744b7.json` incluido
- Firebase Admin inicializado correctamente

## 📱 Endpoints disponibles:

- `POST /notify-maitre-new-client`
- `POST /notify-client-table-assigned`
- `POST /notify-mozos-client-query`
- `POST /notify-bartender-new-order`
- `POST /notify-cocinero-new-order`
- `POST /notify-mozo-order-ready`
- `POST /notify-mozo-request-bill`
- `POST /notify-supervisors-new-client`
- `POST /clear-fcm-token`

## 🌐 URLs configuradas:

- **Desarrollo**: `http://localhost:3000`
- **Producción**: `https://tu-backend-fritoshermanos.onrender.com`

## ⚡ Para empezar rápido:

1. `cd backend`
2. `npm install` ✅ (ya hecho)
3. `npm run dev` ✅ (ya corriendo)
4. Tu app ya apunta al backend local ✅

## 🎯 Estado actual:
- ✅ Backend funcionando en `http://localhost:3000`
- ✅ Todos los endpoints de push notifications configurados
- ✅ Supabase conectado
- ✅ Firebase Admin configurado
- ✅ App apuntando al backend local

## 🧪 Para probar:
Abre tu navegador en `http://localhost:3000` - deberías ver "Backend is running!"

¡Todo listo para funcionar!
