# Cómo publicar MEGO FORCE en Hostinger

Guía paso a paso. No hace falta saber programar: solo copiar, pegar y hacer clic.

La aplicación es **un solo contenedor Docker** que atiende dos direcciones:

| Dirección | Para quién |
|---|---|
| https://mego-registro.systemagencygarciavargas.tech | Clientes (portal público de registro) |
| https://mego-admin.systemagencygarciavargas.tech | Equipo MEGO FORCE (panel administrativo) |

En la dirección de clientes el panel `/admin` **no existe** (responde "Página no encontrada").

---

## Cómo funciona (resumen)

1. Se sube código a GitHub (rama `main`).
2. GitHub Actions revisa el código (lint, build, tests), construye la imagen Docker, la prueba y la publica en `ghcr.io/belsyvargas99-maker/mego-force-management-system:latest`.
3. El Docker Manager de Hostinger descarga esa imagen y la ejecuta detrás del Traefik del proyecto `n8n` (el mismo que ya da HTTPS a Insublimex).

---

## Paso 1. DNS (ya hecho)

En Hostinger ya existen estos dos registros:

| Tipo | Nombre | Apunta a | TTL |
|---|---|---|---|
| A | mego-registro | 2.24.202.165 | 14400 |
| A | mego-admin | 2.24.202.165 | 14400 |

Comprobado el 17/11/2026 con `Resolve-DnsName` (y con el DNS público 8.8.8.8): los dos subdominios responden `2.24.202.165`. No hay que tocar nada más aquí.

Si algún día quieres volver a comprobarlo, abre PowerShell y escribe:

```powershell
Resolve-DnsName mego-registro.systemagencygarciavargas.tech
Resolve-DnsName mego-admin.systemagencygarciavargas.tech
```

---

## Paso 2. Comprobar que la imagen está lista

1. Entra a https://github.com/belsyvargas99-maker/mego-force-management-system/actions
2. El último run de **"Construir imagen"** debe tener un círculo **verde**.
3. Si está rojo, no sigas: la imagen nueva no se publicó.

### Si la imagen quedó privada

Hostinger no puede descargar una imagen privada sin contraseña. Para hacerla pública:

1. Entra a GitHub con la cuenta dueña del repositorio.
2. Arriba a la derecha: tu foto → **Your profile** → pestaña **Packages**.
3. Abre **mego-force-management-system**.
4. A la derecha, **Package settings**.
5. Abajo del todo, en "Danger Zone": **Change visibility** → **Public** → escribe el nombre del paquete para confirmar.

---

## Paso 3. Crear el proyecto en el Docker Manager de Hostinger

1. Entra a hPanel → **VPS** → tu servidor → **Docker Manager**.
2. Pulsa **Crear proyecto** (o "Compose" / "Nuevo proyecto").
3. Nombre del proyecto: `mego-force`.
4. Pega **todo** el contenido del archivo `hostinger-compose.yml` de este repositorio.
5. Variables de entorno (la sección "Environment" del proyecto). Ninguna es secreta:

   | Variable | Valor | ¿Obligatoria? |
   |---|---|---|
   | `ADMIN_EMAILS` | `belsyvargas99@gmail.com` (varios correos separados por comas) | Recomendada (si no la pones se usa ese mismo correo) |
   | `CSP_REPORT_ONLY` | `false` | No (solo para el plan B del final) |

   Los subdominios, el puerto y el modo ya vienen fijos dentro del compose; no hace falta ponerlos.
6. Pulsa **Desplegar / Deploy**.
7. Espera 1 o 2 minutos y abre:
   - https://mego-registro.systemagencygarciavargas.tech
   - https://mego-admin.systemagencygarciavargas.tech
   - https://mego-registro.systemagencygarciavargas.tech/api/health (debe mostrar `"ok":true`)

La primera vez el certificado HTTPS puede tardar un minuto en emitirse. Si el navegador avisa de "conexión no segura", espera y recarga.

**Requisito:** el proyecto `n8n` debe estar encendido en el mismo VPS, porque su Traefik (red `n8n_default`, certificados `mytlschallenge`) es el que publica la app.

---

## Paso 4. Cómo actualizar la app en el futuro

1. Se sube código nuevo a `main` en GitHub.
2. Espera a que el run de **Actions** termine en verde (unos minutos).
3. En Docker Manager → proyecto `mego-force` → **Redeploy** (o "Pull" y luego "Restart"). Así descarga la imagen `latest` nueva.

Los mockups subidos se guardan en el volumen `mego_uploads`: **no se pierden** al actualizar.

Si una versión nueva sale mal, puedes volver a una anterior cambiando en el compose `:latest` por `:<hash-del-commit>` (el hash aparece en cada run de Actions) y haciendo Redeploy.

---

## Paso 5. Firebase: autorizar los dominios (para que funcione el login)

1. Entra a https://console.firebase.google.com y abre el proyecto **gen-lang-client-0551519025**.
2. Menú izquierdo: **Authentication** → pestaña **Settings** → **Authorized domains**.
3. Pulsa **Add domain** y añade, uno por uno:
   - `mego-registro.systemagencygarciavargas.tech`
   - `mego-admin.systemagencygarciavargas.tech`

Sin esto, el botón "Iniciar sesión con Google" falla con el error `auth/unauthorized-domain`.

---

## Paso 6. Google Cloud Console (Sheets / Drive y la clave web)

Entra a https://console.cloud.google.com con el mismo proyecto (**gen-lang-client-0551519025**).

### 6.1 Pantalla de consentimiento OAuth

El panel pide permiso para Google Sheets y Drive (`spreadsheets` y `drive.file`).

1. **APIs y servicios** → **Pantalla de consentimiento de OAuth** (o "Google Auth Platform" → "Audiencia").
2. Elige una de estas dos opciones:
   - **Publicar la app** ("Publish app" / "En producción"). Google puede pedir verificación por los permisos de Sheets/Drive.
   - O dejarla en **Prueba** y añadir `belsyvargas99@gmail.com` (y cada administrador) en **Usuarios de prueba**.
3. En **Permisos / Scopes**, confirma que estén `.../auth/spreadsheets` y `.../auth/drive.file`.
4. Comprueba también que **Google Sheets API** y **Google Drive API** estén habilitadas (APIs y servicios → Biblioteca).

### 6.2 Cliente OAuth (si aplica)

1. **APIs y servicios** → **Credenciales** → abre el cliente OAuth web (`751839329314-...apps.googleusercontent.com`).
2. En **Orígenes de JavaScript autorizados** añade:
   - `https://mego-registro.systemagencygarciavargas.tech`
   - `https://mego-admin.systemagencygarciavargas.tech`
3. No borres lo que ya esté (por ejemplo el dominio `firebaseapp.com`). Guarda.

### 6.3 Restringir la clave web (apiKey)

La clave de Firebase del navegador es pública por diseño, pero conviene limitar desde dónde se usa:

1. **Credenciales** → abre la **API key** del navegador (la que empieza por `AIzaSyAk...`).
2. **Restricciones de aplicación** → **Sitios web (referentes HTTP)** → añade:
   - `https://mego-registro.systemagencygarciavargas.tech/*`
   - `https://mego-admin.systemagencygarciavargas.tech/*`
   - `https://gen-lang-client-0551519025.firebaseapp.com/*` (lo usa la ventana de login)
   - `http://localhost:3000/*` (solo si se sigue probando en una PC)
3. Guarda. Los cambios pueden tardar unos minutos.

---

## Plan B: si el login falla en producción

La app manda una política de seguridad (CSP) que bloquea scripts de dominios no previstos. Si el login con Google se queda en blanco o la consola del navegador muestra errores de "Content Security Policy":

1. En Docker Manager → proyecto `mego-force` → variables: pon `CSP_REPORT_ONLY` = `true`.
2. Pulsa **Redeploy**.
3. Con eso la CSP solo avisa en la consola y no bloquea. Copia los avisos de la consola (F12 → Console) y pásalos para corregir la política; luego vuelve a poner `false`.

Antes de tocar la CSP, revisa los pasos 5 y 6: el error más común es no haber añadido los dominios en Firebase (`auth/unauthorized-domain`).

---

## Pendientes técnicos

- **package-lock.json**: todavía no está versionado. Actions lo genera en cada run con `npm install` y lo guarda como artefacto (`package-lock`) durante 30 días. Conviene descargarlo de un run verde y subirlo al repositorio; luego se puede cambiar `npm install` por `npm ci` en el workflow y el Dockerfile para que las versiones no cambien solas.
- `bun.lock` queda en el repo como referencia, pero Docker lo ignora (se usa npm).

## Probarlo en una PC (opcional)

```bash
cp .env.example .env
docker compose up -d --build
```

Luego abre http://localhost:3000 (en localhost se ven el portal y el panel a la vez).
