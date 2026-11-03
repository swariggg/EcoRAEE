import { api, ErrorApi, guardarSesion, sesion } from "./api.js";
import { icono, LOGO } from "./ilustraciones.js";

if (sesion()?.token) location.href = "index.html";

document.getElementById("logo").innerHTML = LOGO.replace('class="logo"', 'width="34" height="34"');
document.getElementById("c-correo").insertAdjacentHTML("afterbegin", icono("correo"));
document.getElementById("c-pass").insertAdjacentHTML("afterbegin", icono("candado"));
const ver = document.getElementById("ver");
const pass = document.getElementById("password");
ver.innerHTML = icono("ojoNo");
ver.onclick = () => {
  const visible = pass.type === "text";
  pass.type = visible ? "password" : "text";
  ver.innerHTML = icono(visible ? "ojoNo" : "ojo");
  ver.setAttribute("aria-label", visible ? "Mostrar contraseña" : "Ocultar contraseña");
};

document.getElementById("olvido").onclick = () => {
  mostrarError("Por seguridad, la contraseña la restablece el administrador del sistema (Usuarios > Editar).", "info");
};
document.getElementById("demo").onchange = (e) => {
  if (!e.target.value) return;
  document.getElementById("correo").value = e.target.value;
  pass.value = "EcoRaee2026!";
  document.getElementById("entrar").focus();
};

function mostrarError(texto, tipo = "error") {
  const caja = document.getElementById("error");
  caja.className = `aviso ${tipo}`;
  caja.textContent = texto;
  caja.hidden = false;
}

const form = document.getElementById("form-login");
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  document.getElementById("error").hidden = true;
  let ok = true;
  for (const el of form.querySelectorAll("input")) {
    const msg = el.closest(".campo").querySelector(".msg");
    msg.textContent = "";
    el.closest(".campo").classList.remove("error");
    if (!el.checkValidity()) {
      ok = false;
      el.closest(".campo").classList.add("error");
      msg.textContent = el.validity.valueMissing ? "Este campo es obligatorio." : "Escriba un correo válido.";
    }
  }
  if (!ok) return;
  const boton = document.getElementById("entrar");
  boton.disabled = true;
  boton.textContent = "Ingresando…";
  try {
    const r = await api.post("/api/auth/login", { correo: form.correo.value.trim(), password: pass.value });
    guardarSesion(r);
    location.href = "index.html";
  } catch (err) {
    mostrarError(err instanceof ErrorApi ? err.message : "No se pudo iniciar sesión.");
  } finally {
    boton.disabled = false;
    boton.textContent = "Iniciar sesión";
  }
});
