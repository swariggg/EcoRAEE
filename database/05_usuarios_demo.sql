/* =====================================================================
   EcoRAEE Cloud - Contraseñas de los usuarios de prueba (segundo avance)
   Ejecutar después de 02_datos.sql.
   02_datos.sql guarda 'hash_demo' como marcador. Este script pone un hash
   bcrypt real para que el login de la aplicación funcione.
   Contraseña de TODOS los usuarios de prueba: EcoRaee2026!
   (solo para el entorno local; no es una credencial real)
   ===================================================================== */
SET NOCOUNT ON;
GO
USE EcoRaEE_CLOUD;
GO
UPDATE usuario
SET hash_password = '$2b$12$WGK7HbIVhVB4mimE7eNJl.8UX9.2Q/1L51ogaGn60K9SREkl/riAu'
WHERE hash_password = 'hash_demo';

SELECT id_usuario, correo_institucional, id_rol, activo FROM usuario ORDER BY id_rol, id_usuario;
GO
