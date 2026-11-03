// Íconos (trazo) e ilustraciones originales en SVG. No dependen de internet.

const P = {
  panel: '<rect x="3" y="3" width="7" height="9" rx="2"/><rect x="14" y="3" width="7" height="5" rx="2"/><rect x="14" y="12" width="7" height="9" rx="2"/><rect x="3" y="16" width="7" height="5" rx="2"/>',
  solicitud: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
  dispositivo: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M2 20h20M9 16v4M15 16v4"/>',
  evaluacion: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  movimiento: '<path d="M1 3h15v13H1zM16 8h4l3 3v5h-7z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
  transferencia: '<path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
  evidencia: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>',
  red: '<circle cx="5" cy="12" r="2.5"/><circle cx="19" cy="5" r="2.5"/><circle cx="19" cy="19" r="2.5"/><circle cx="12" cy="12" r="2.5"/><path d="M7.5 12h2M14 10.5l3-4M14 13.5l3 4"/>',
  centro: '<path d="M3 21h18M5 21V8l7-5 7 5v13"/><path d="M9 21v-6h6v6"/>',
  destino: '<path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
  catalogo: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  usuarios: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  auditoria: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/>',
  buscar: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  campana: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/>',
  salir: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  mas: '<path d="M12 5v14M5 12h14"/>',
  editar: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  borrar: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
  cerrar: '<path d="M18 6L6 18M6 6l12 12"/>',
  correo: '<rect x="2" y="4" width="20" height="16" rx="3"/><path d="M22 7l-10 6L2 7"/>',
  candado: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  ojo: '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>',
  ojoNo: '<path d="M17.9 17.9A10 10 0 0 1 12 19c-7 0-11-7-11-7a18 18 0 0 1 5.1-5.9M9.9 4.2A9 9 0 0 1 12 4c7 0 11 7 11 7a18 18 0 0 1-2.2 3.2M1 1l22 22"/><path d="M14.1 14.1a3 3 0 1 1-4.2-4.2"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  subir: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  bajar: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  play: '<path d="M6 4l14 8-14 8z"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  alerta: '<path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  hoja: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10z"/><path d="M2 21c0-3 1.9-5.4 5.1-6"/>',
  peso: '<path d="M6 7h12l2 13H4z"/><path d="M9 7a3 3 0 0 1 6 0"/>',
  reciclar: '<path d="M7 19H4.8a1.8 1.8 0 0 1-1.6-2.7L7.2 9.4M11 19h8.2a1.8 1.8 0 0 0 1.6-2.7l-1.2-2M14 16l-3 3 3 3M8.3 13.6L7.2 9.4 3 10.5M9.3 5.6l1.1-1.9a1.8 1.8 0 0 1 3.1 0l4 6.8M13.4 9.3l4.3 1.2 1.1-4.2"/>',
  reloj: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  filtro: '<path d="M22 3H2l8 9.5V19l4 2v-8.5z"/>',
};

export function icono(nombre, clase = "i") {
  return `<svg class="${clase}" viewBox="0 0 24 24" aria-hidden="true">${P[nombre] || ""}</svg>`;
}

export const LOGO = `<svg class="logo" viewBox="0 0 48 48" aria-hidden="true">
  <rect width="48" height="48" rx="14" fill="#728156"/>
  <path d="M14 31h20l-2 6H16z" fill="#E7F5DC"/>
  <path d="M24 31v-7" stroke="#E7F5DC" stroke-width="3" stroke-linecap="round"/>
  <path d="M24 24c-1-5-6-8-11-7 0 5 5 8 11 7z" fill="#CFE1B9"/>
  <path d="M24 22c1-5 6-8 11-7 0 5-5 8-11 7z" fill="#B6C99B"/>
</svg>`;

// Ilustración del panel: equipos que vuelven a la vida (estilo de la referencia 3)
export const HERO = `<svg class="ilustracion" viewBox="0 0 420 230" aria-hidden="true">
  <ellipse cx="215" cy="212" rx="180" ry="12" fill="#98A77C" opacity=".25"/>
  <g transform="translate(40 70)">
    <rect x="0" y="0" width="150" height="96" rx="10" fill="#46512F"/>
    <rect x="9" y="9" width="132" height="76" rx="5" fill="#E7F5DC"/>
    <path d="M28 34h60M28 50h86M28 66h42" stroke="#98A77C" stroke-width="7" stroke-linecap="round"/>
    <path d="M-12 96h174l-10 18H-2z" fill="#728156"/>
  </g>
  <g transform="translate(206 30)">
    <circle cx="70" cy="70" r="64" fill="#CFE1B9"/>
    <path d="M70 26a44 44 0 1 1-39 24" fill="none" stroke="#728156" stroke-width="9" stroke-linecap="round"/>
    <path d="M18 38l14 13 15-14" fill="none" stroke="#728156" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M70 100c0-18-2-30 0-44" stroke="#46512F" stroke-width="5" stroke-linecap="round"/>
    <path d="M70 70c-6-16-22-22-34-18 2 14 18 22 34 18z" fill="#88976C"/>
    <path d="M70 60c6-16 22-22 34-18-2 14-18 22-34 18z" fill="#728156"/>
  </g>
  <g transform="translate(300 130)">
    <rect x="0" y="0" width="44" height="80" rx="9" fill="#2C3320"/>
    <rect x="5" y="8" width="34" height="58" rx="3" fill="#B6C99B"/>
    <circle cx="22" cy="72" r="3" fill="#88976C"/>
  </g>
  <g transform="translate(200 150)">
    <rect x="0" y="16" width="86" height="46" rx="8" fill="#98A77C"/>
    <rect x="14" y="0" width="58" height="22" rx="4" fill="#FBF8F1"/>
    <rect x="12" y="40" width="62" height="28" rx="3" fill="#FBF8F1"/>
    <circle cx="72" cy="28" r="3.5" fill="#E7F5DC"/>
  </g>
</svg>`;

// Íconos grandes por categoría de equipo (tarjetas tipo "Explore popular categories")
const CAT = {
  "Laptop": `<rect x="18" y="20" width="64" height="42" rx="5" fill="#46512F"/><rect x="23" y="25" width="54" height="32" rx="2" fill="#CFE1B9"/><path d="M10 64h80l-6 10H16z" fill="#728156"/>`,
  "Computador de escritorio": `<rect x="14" y="16" width="48" height="36" rx="4" fill="#46512F"/><rect x="18" y="20" width="40" height="28" rx="2" fill="#B6C99B"/><path d="M32 52h12v10H32zM24 62h28v5H24z" fill="#728156"/><rect x="68" y="18" width="20" height="54" rx="4" fill="#88976C"/><circle cx="78" cy="30" r="3" fill="#E7F5DC"/><path d="M73 42h10M73 48h10" stroke="#E7F5DC" stroke-width="2.5"/>`,
  "Monitor": `<rect x="12" y="16" width="76" height="48" rx="5" fill="#2C3320"/><rect x="17" y="21" width="66" height="38" rx="2" fill="#E7F5DC"/><path d="M28 34h30M28 44h44" stroke="#98A77C" stroke-width="5" stroke-linecap="round"/><path d="M44 64h12l3 10H41z" fill="#728156"/><rect x="34" y="73" width="32" height="5" rx="2" fill="#88976C"/>`,
  "Celular": `<rect x="33" y="10" width="34" height="68" rx="7" fill="#2C3320"/><rect x="37" y="17" width="26" height="50" rx="2" fill="#B6C99B"/><circle cx="50" cy="72" r="2.5" fill="#88976C"/><path d="M43 38l5 5 9-10" stroke="#46512F" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  "Impresora": `<rect x="26" y="12" width="48" height="22" rx="3" fill="#FBF8F1" stroke="#98A77C" stroke-width="2"/><rect x="12" y="30" width="76" height="34" rx="8" fill="#728156"/><rect x="26" y="52" width="48" height="26" rx="3" fill="#FBF8F1" stroke="#98A77C" stroke-width="2"/><path d="M34 62h32M34 69h22" stroke="#B6C99B" stroke-width="3"/><circle cx="76" cy="41" r="3.5" fill="#E7F5DC"/>`,
  "Periférico": `<rect x="8" y="40" width="58" height="26" rx="6" fill="#88976C"/><g fill="#E7F5DC"><rect x="14" y="45" width="7" height="6" rx="1.5"/><rect x="24" y="45" width="7" height="6" rx="1.5"/><rect x="34" y="45" width="7" height="6" rx="1.5"/><rect x="44" y="45" width="7" height="6" rx="1.5"/><rect x="54" y="45" width="7" height="6" rx="1.5"/><rect x="20" y="55" width="34" height="6" rx="1.5"/></g><rect x="70" y="34" width="22" height="34" rx="11" fill="#46512F"/><path d="M81 36v12" stroke="#B6C99B" stroke-width="2.5"/>`,
};
export function iconoCategoria(nombre) {
  const cuerpo = CAT[nombre] || `<rect x="20" y="20" width="60" height="50" rx="8" fill="#98A77C"/><path d="M38 45h24M50 33v24" stroke="#E7F5DC" stroke-width="5" stroke-linecap="round"/>`;
  return `<svg viewBox="0 0 100 86" aria-hidden="true">${cuerpo}</svg>`;
}

export const VACIO = `<svg viewBox="0 0 160 110" aria-hidden="true">
  <ellipse cx="80" cy="96" rx="60" ry="8" fill="#E7F5DC"/>
  <path d="M40 40h80l-8 52H48z" fill="#CFE1B9"/><path d="M34 34h92v10H34z" fill="#98A77C"/>
  <path d="M80 34c0-12 0-20 2-28" stroke="#728156" stroke-width="4" stroke-linecap="round"/>
  <path d="M81 14c-8-8-18-8-24-4 4 8 14 10 24 4zM83 10c6-8 16-10 22-6-4 8-14 10-22 6z" fill="#88976C"/>
</svg>`;
