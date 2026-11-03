import { catalogo } from "../api.js";
import { esc, estado, opciones } from "../ui.js";
import { crud } from "./crud.js";

export async function render(v, ctx) {
  return crud(v, {
    titulo: "Usuarios", sub: "Personas que usan la aplicación y su rol. Eliminar = desactivar: el historial y la auditoría se conservan.",
    ruta: "/api/usuarios", pk: "id_usuario", puedeEditar: true, nombre: (f) => `${f.nombres} ${f.apellidos}`, textoBorrar: "Desactivar",
    avisoBorrar: "No podrá iniciar sesión; sus registros se conservan.", sinBorrar: (f) => !f.activo || f.id_usuario === ctx.usuario.id_usuario,
    columnas: [{ t: "Usuario", v: (f) => `<b>${esc(f.nombres)} ${esc(f.apellidos)}</b><div class="small muted">${esc(f.correo_institucional)}</div>` },
      { t: "Rol", v: (f) => esc(f.nombre_rol) }, { t: "Organización", v: (f) => esc(f.organizacion) },
      { t: "Estado", v: (f) => estado(f.activo ? "Activo" : "Inactivo", f.activo ? "verde" : "gris") }],
    campos: async (fila) => [
      { n: "nombres", l: "Nombres", req: true, minlength: 2, maxlength: 100 }, { n: "apellidos", l: "Apellidos", req: true, minlength: 2, maxlength: 100 },
      { n: "correo_institucional", l: "Correo institucional", tipo: "email", req: true, maxlength: 150, completo: true },
      { n: "id_rol", l: "Rol", tipo: "select", req: true, opciones: opciones(await catalogo("/api/catalogos/roles"), "id_rol", "nombre_rol") },
      { n: "id_organizacion", l: "Organización", tipo: "select", req: true, opciones: opciones(await catalogo("/api/catalogos/organizaciones"), "id_organizacion", "nombre") },
      { n: "password", l: fila ? "Nueva contraseña (opcional)" : "Contraseña", tipo: "password", req: !fila, minlength: 8, maxlength: 100, ayuda: "Mínimo 8 caracteres. Se guarda con bcrypt." },
      ...(fila ? [{ n: "activo", l: "Usuario activo", tipo: "checkbox" }] : []),
    ],
  });
}
