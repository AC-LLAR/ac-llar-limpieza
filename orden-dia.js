/* Orden de limpieza del día · AC·LLAR (app de gestión)
   Muestra las AC pendientes del plan compartido (limpieza_plan) y permite subirlas/bajarlas.
   El orden se guarda en limpieza_plan.prioridad de ESE día, así la Tablet lo ve al momento.
   Sin orden manual: urgentes primero, luego por fecha de salida. */
(function () {
  "use strict";
  if (window.__ACLLAR_ORDEN_DIA__) return;
  window.__ACLLAR_ORDEN_DIA__ = true;

  var st = { fecha: null, fechas: [], rows: [], cargando: false, guardando: false, err: null, abierto: true };
  try { st.abierto = localStorage.getItem("acllar-orden-dia-abierto") !== "0"; } catch (e) {}

  function sb() { return window.__ACLLAR_SUPABASE; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function hoy() { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function ddmm(k) { return k ? k.slice(8, 10) + "/" + k.slice(5, 7) : ""; }
  function diaTxt(k) { var p = k.split("-"), d = new Date(+p[0], +p[1] - 1, +p[2]); return ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"][d.getDay()] + " " + ddmm(k); }

  function ordenar(rows) {
    return rows.slice().sort(function (a, b) {
      var pa = a.prioridad == null ? 1e6 : a.prioridad, pb = b.prioridad == null ? 1e6 : b.prioridad;
      return pa - pb || (b.urgente ? 1 : 0) - (a.urgente ? 1 : 0) || String(a.sale || "9999").localeCompare(String(b.sale || "9999")) || String(a.ac_id).localeCompare(String(b.ac_id));
    });
  }

  async function cargar(el) {
    if (st.cargando || !sb()) return;
    st.cargando = true;
    try {
      var r = await sb().from("limpieza_plan").select("id,fecha,ac_id,tamano,estado,prioridad,urgente,sale").gte("fecha", hoy()).order("fecha", { ascending: true }).limit(500);
      if (r.error) throw r.error;
      var data = (r.data || []).filter(function (x) { return x.estado !== "terminada"; });
      var fechas = []; data.forEach(function (x) { if (fechas.indexOf(x.fecha) < 0) fechas.push(x.fecha); });
      fechas.sort(); st.fechas = fechas;
      // Por defecto, el último día con plan (el que va a usar la Tablet: hoy, o mañana si ya está preparado)
      if (!st.fecha || fechas.indexOf(st.fecha) < 0) st.fecha = fechas[fechas.length - 1] || null;
      st.rows = ordenar(data.filter(function (x) { return x.fecha === st.fecha; }));
      st.err = null;
    } catch (e) { st.err = (e && e.message) || String(e); }
    st.cargando = false;
    render(el);
  }

  async function guardar(el, lista) {
    st.guardando = true; st.rows = lista; render(el);
    try {
      for (var i = 0; i < lista.length; i++) {
        var up = await sb().from("limpieza_plan").update({ prioridad: i + 1 }).eq("id", lista[i].id);
        if (up.error) throw up.error;
        lista[i].prioridad = i + 1;
      }
    } catch (e) { alert("No se pudo guardar el orden: " + ((e && e.message) || e)); }
    st.guardando = false; cargar(el);
  }

  async function automatico(el) {
    if (!st.fecha) return;
    st.guardando = true; render(el);
    var up = await sb().from("limpieza_plan").update({ prioridad: null }).eq("fecha", st.fecha);
    if (up.error) alert("No se pudo volver al orden automático: " + up.error.message);
    st.guardando = false; cargar(el);
  }

  function render(el) {
    var manual = st.rows.some(function (x) { return x.prioridad != null; });
    var h = '<div style="background:var(--card,#fff);border:1px solid var(--line,#E6D7CC);border-radius:12px;margin-top:16px;overflow:hidden">';
    h += '<button data-od="toggle" style="width:100%;display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:none;border:0;cursor:pointer;text-align:left">' +
      '<span><span style="font-size:14px;font-weight:600;color:var(--ink,#3A1F0F)">ORDEN DE LIMPIEZA · TABLET</span>' +
      '<span style="font-size:11px;color:var(--muted,#6B625B);margin-left:8px">' + (manual ? "orden manual" : "automático: urgentes primero, luego por salida") + "</span></span>" +
      '<span style="color:var(--muted,#6B625B)">' + (st.abierto ? "▲" : "▼") + "</span></button>";
    if (st.abierto) {
      h += '<div style="padding:0 16px 14px">';
      if (st.err) h += '<div style="font-size:12px;color:#C24B3F">No se pudo cargar el plan: ' + esc(st.err) + "</div>";
      else if (!st.fecha) h += '<div style="font-size:12px;color:var(--muted,#6B625B)">No hay AC pendientes en el plan.</div>';
      else {
        h += '<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:8px">';
        st.fechas.forEach(function (f) {
          var on = f === st.fecha;
          h += '<button data-od="fecha" data-f="' + f + '" style="font-size:12px;padding:4px 10px;border-radius:999px;cursor:pointer;border:1px solid ' + (on ? "var(--ink,#3A1F0F)" : "var(--line,#E6D7CC)") + ";background:" + (on ? "var(--ink,#3A1F0F)" : "#fff") + ";color:" + (on ? "#fff" : "var(--ink,#3A1F0F)") + '">' + diaTxt(f) + "</button>";
        });
        h += '<span style="flex:1"></span>' + (st.guardando ? '<span style="font-size:11px;color:var(--muted,#6B625B)">Guardando…</span>' : "") +
          (manual ? '<button data-od="auto" style="font-size:11px;padding:4px 10px;border-radius:6px;border:1px solid var(--line,#E6D7CC);background:#fff;cursor:pointer">Volver al orden automático</button>' : "") + "</div>";
        st.rows.forEach(function (x, i) {
          var rojo = x.urgente && x.estado !== "en_curso";
          h += '<div style="display:flex;align-items:center;gap:8px;padding:6px 8px;margin-bottom:4px;border-radius:8px;border:' + (rojo ? "2px solid #C24B3F" : "1px solid #F4ECE7") + ";background:" + (rojo ? "#FBECEA" : "#fff") + '">' +
            '<span style="width:20px;font-size:11px;color:var(--muted,#6B625B);text-align:right">' + (i + 1) + "</span>" +
            '<span style="font-family:ui-monospace,monospace;font-weight:700;font-size:15px;min-width:78px;color:' + (rojo ? "#C24B3F" : "var(--ink,#3A1F0F)") + '">' + esc(x.ac_id) + "</span>" +
            '<span style="font-size:10px;padding:2px 6px;border-radius:4px;background:var(--paper,#F5EDE6);color:var(--muted,#6B625B)">' + esc(x.tamano || "") + "</span>" +
            (rojo ? '<span style="font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;background:#C24B3F;color:#fff">URGENTE</span>' : "") +
            (x.estado === "en_curso" ? '<span style="font-size:10px;color:#FE7802;font-weight:600">en curso</span>' : "") +
            '<span style="flex:1"></span>' +
            (x.sale ? '<span style="font-family:ui-monospace,monospace;font-size:11px;color:' + (rojo ? "#C24B3F" : "var(--muted,#6B625B)") + '">sale ' + ddmm(x.sale) + "</span>" : "") +
            '<button data-od="mv" data-i="' + i + '" data-d="-1" ' + (i === 0 || st.guardando ? "disabled " : "") + 'title="Subir" style="width:30px;height:28px;border:1px solid var(--line,#E6D7CC);border-radius:7px;background:#fff;cursor:pointer;opacity:' + (i === 0 ? ".35" : "1") + '">▲</button>' +
            '<button data-od="mv" data-i="' + i + '" data-d="1" ' + (i === st.rows.length - 1 || st.guardando ? "disabled " : "") + 'title="Bajar" style="width:30px;height:28px;border:1px solid var(--line,#E6D7CC);border-radius:7px;background:#fff;cursor:pointer;opacity:' + (i === st.rows.length - 1 ? ".35" : "1") + '">▼</button>' +
            "</div>";
        });
        h += '<div style="font-size:10px;color:var(--muted,#6B625B);margin-top:6px">El orden vale solo para ese día y la Tablet lo recibe al momento.</div>';
      }
      h += "</div>";
    }
    el.innerHTML = h + "</div>";
  }

  function wire(el) {
    el.addEventListener("click", function (e) {
      var b = e.target.closest("[data-od]"); if (!b || b.disabled) return;
      var a = b.getAttribute("data-od");
      if (a === "toggle") { st.abierto = !st.abierto; try { localStorage.setItem("acllar-orden-dia-abierto", st.abierto ? "1" : "0"); } catch (x) {} render(el); }
      else if (a === "fecha") { st.fecha = b.getAttribute("data-f"); cargar(el); }
      else if (a === "auto") automatico(el);
      else if (a === "mv") {
        var i = +b.getAttribute("data-i"), j = i + (+b.getAttribute("data-d"));
        if (j < 0 || j >= st.rows.length) return;
        var l = st.rows.slice(), t = l[i]; l[i] = l[j]; l[j] = t;
        guardar(el, l);
      }
    });
  }

  var canal = null;
  setInterval(function () {
    var el = document.getElementById("acllar-orden-dia");
    if (!el) return;
    if (!el.__wired) { el.__wired = true; wire(el); cargar(el); }
    else if (!el.firstChild) render(el);
    if (!canal && sb() && sb().channel) {
      canal = sb().channel("acllar-orden-dia").on("postgres_changes", { event: "*", schema: "public", table: "limpieza_plan" }, function () {
        clearTimeout(canal.__t); canal.__t = setTimeout(function () { var e2 = document.getElementById("acllar-orden-dia"); if (e2 && !st.guardando) cargar(e2); }, 600);
      }).subscribe();
    }
  }, 800);
  setInterval(function () { var el = document.getElementById("acllar-orden-dia"); if (el && el.__wired && !st.guardando) cargar(el); }, 30000);
})();
