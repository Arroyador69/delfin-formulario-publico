# 🐬 Delfín Check-in - Formulario Público

## 📋 Descripción

Formulario de registro de viajeros completamente independiente y público, compatible con el Ministerio del Interior de España. Este formulario se aloja en GitHub Pages y envía los datos directamente al dashboard protegido.

## 🚀 Características

* ✅ **100% Público** - Sin autenticación ni login
* ✅ **Formulario Completo** - Todos los campos requeridos por el Ministerio
* ✅ **Soporte Multiidioma** - Español, Inglés y Francés
* ✅ **Validación Mejorada** - Mensajes de error específicos por idioma
* ✅ **Envío Directo** - Los datos van directamente a tu dashboard protegido
* ✅ **Sin Dependencias** - Solo HTML, CSS y JavaScript básico
* ✅ **Responsive** - Funciona en todos los dispositivos

## 🌐 URLs del Sistema

* **Formulario Público**: `https://form.delfincheckin.com`
* **Dashboard Protegido**: `https://admin.delfincheckin.com`
* **API de Envío**: `https://admin.delfincheckin.com/api/public/form/[tenant_id]/submit`

## 🔗 Conexión con Dashboard

El formulario está configurado para enviar datos a:

* **API**: `https://admin.delfincheckin.com/api/public/form/[tenant_id]/submit`
* **Dashboard**: `https://admin.delfincheckin.com/guest-registrations-dashboard`
* **Base de datos**: Neon PostgreSQL (hosteado en Neon.tech)

## 📱 Uso

1. **Acceso Directo**: Los clientes acceden al formulario sin login
2. **Selección de Idioma**: Pueden elegir entre Español, Inglés o Francés
3. **Rellenar Datos**: Completan todos los campos obligatorios
4. **Envío Automático**: Los datos se envían a tu API protegida
5. **Mensaje de Éxito**: El cliente ve confirmación (se queda en el formulario)
6. **Datos en Dashboard**: Tú recibes la información para generar XML

## 🛠️ Personalización

### Cambiar URL de la API

Si cambias la URL de tu dashboard, actualiza estas líneas en `index.html`:

```javascript
// Línea ~400: URL de la API
const response = await fetch('https://admin.delfincheckin.com/api/public/form/' + tenantId + '/submit', {

// Línea ~410: URL del dashboard
window.open('https://admin.delfincheckin.com/guest-registrations-dashboard', '_blank');
```

### Cambiar Estilos

Los estilos están en la sección `<style>` del HTML y usan Tailwind CSS desde CDN.

## 🔒 Seguridad

* **Formulario Público**: Accesible sin autenticación
* **API Protegida**: Solo tu dashboard puede acceder a los datos
* **Validación Cliente**: Campos obligatorios validados antes del envío
* **Dashboard Seguro**: Autenticación JWT en `admin.delfincheckin.com`
* **Base de datos**: Neon PostgreSQL con conexiones seguras

## 📞 Soporte

Si necesitas ayuda o quieres personalizar el formulario, contacta con el administrador del sistema.

---

**🐬 Delfín Check-in - Sistema de Registro de Viajeros**
