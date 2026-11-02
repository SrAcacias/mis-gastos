# Mis gastos

Web app para registrar ingresos y gastos y ver el balance de cada mes. Funciona en el Mac y en el iPhone, y los datos se sincronizan entre los dos. Todo con planes gratuitos.

- **App**: Preact + Vite, publicada en GitHub Pages.
- **Datos y login**: Supabase, en el plan gratuito.
- Los datos están protegidos por usuario con RLS: aunque el código sea público, solo tú ves tus movimientos.

## Puesta en marcha (una vez, unos 20 minutos)

### 1. Supabase (base de datos)
1. Crea una cuenta en https://supabase.com y luego un **New project**. Región: *Central EU (Frankfurt)*. Guarda la contraseña de la base de datos.
2. Ve a **SQL Editor → New query**, pega el contenido de `supabase/schema.sql` y pulsa **Run**.
3. En **Authentication → Sign In / Providers → Email**, desactiva *Confirm email*. Así entras directamente, sin email de confirmación.
4. En **Project Settings → API**, copia la **Project URL** y la clave **anon public**.
5. Pega las dos en `src/config.js`.

### 2. GitHub (publicar la app)
1. Crea una cuenta en https://github.com y luego un repositorio **público** llamado `mis-gastos`. GitHub Pages es gratis en repos públicos.
2. Sube **todos** los archivos de esta carpeta, incluida `.github`: **Add file → Upload files**.
   ⚠️ No subas tu CSV de movimientos: el repo es público.
3. En **Settings → Pages → Source**, elige **GitHub Actions**.
4. En unos 2 minutos la app estará en `https://TU-USUARIO.github.io/mis-gastos/`. Puedes seguir el progreso en la pestaña **Actions**.

El workflow *Mantener Supabase activo* hace una consulta cada 3 días para que Supabase no pause el proyecto. No tienes que hacer nada.

### 3. Instalar en los dispositivos
- **iPhone**: abre la URL en Safari, pulsa **Compartir → Añadir a pantalla de inicio**, abre la app y crea tu cuenta.
- **Mac**: abre la URL en Safari y elige **Archivo → Añadir al Dock**. En Chrome: menú → **Enviar, guardar y compartir → Instalar página como app**. Entra con la misma cuenta.

### 4. Importar el Excel
En **Ajustes → Importar CSV**, elige `movimientos_importacion.csv`. Si lo importas dos veces, los movimientos repetidos se saltan.

La primera vez que entras, la app crea automáticamente:
- las categorías;
- los gastos fijos, que se generan solos cada mes desde octubre de 2026;
- el registro del coche de septiembre (km de inicio 46.676, a 1,71 €/L).

### 5. Atajo de Siri
En **Ajustes → Atajo de Siri**, pulsa *Crear clave del atajo* y sigue los pasos que aparecen en pantalla.

## Cambiar algo
Edita el archivo en GitHub (botón ✏️) y guarda: la app se vuelve a publicar sola. Para probar en el Mac: `npm install` y luego `npm run dev`.

## Modo local
Si `src/config.js` está vacío, la app funciona sin Supabase y guarda los datos solo en ese navegador. Sirve para probarla.
