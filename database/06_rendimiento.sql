/* =====================================================================
   EcoRAEE Cloud - Ajuste de rendimiento para una base ya creada.
   Ejecutar UNA vez en SSMS si la aplicación tarda en cargar.
   En SQL Server Express la opción AUTO_CLOSE viene activada: la base se
   cierra cuando nadie la usa y se vuelve a abrir en la siguiente consulta.
   ===================================================================== */
USE master;
GO
ALTER DATABASE EcoRaEE_CLOUD SET AUTO_CLOSE OFF;
GO
SELECT name, is_auto_close_on FROM sys.databases WHERE name = 'EcoRaEE_CLOUD';  -- debe salir 0
GO
