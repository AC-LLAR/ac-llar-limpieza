/* Salidas HQ por vehículo (histórico acllar_hq_movimientos).
   Sirve para saber si la última limpieza de un AC sigue valiendo:
   si el vehículo SALIÓ (entrega HQ) el mismo día o después de esa limpieza y antes
   de la salida que estamos mirando, la limpieza ya no vale y hay que volver a limpiar. */
(function () {
  "use strict";
  if (window.__acllarLimpiezaCaducada) return;
  var mapa = new Map(); // "AC-311" -> ["2026-10-02", ...] (días locales de entrega)
  function base(a) { a = String(a || "").trim().toUpperCase(); var m = a.match(/^(AC-\d{2,3})[A-Z]?$/); return m ? m[1] : a; }
  function dia(iso) { var d = new Date(iso); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }

  async function cargar() {
    var sb = window.__ACLLAR_SUPABASE; if (!sb) return false;
    var ses = (await sb.auth.getSession()).data.session; if (!ses) return false;
    var r = await sb.from("acllar_hq_movimientos").select("ac_id,entrega,estatus,cancelada,visto_en_alquiler").eq("cancelada", false).not("entrega", "is", null).limit(20000);
    if (r.error) { console.warn("salidas-hq:", r.error.message); return false; }
    var m = new Map(), hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    (r.data || []).forEach(function (x) {
      if (/cancel|presupuesto|pendiente/i.test(x.estatus || "")) return;
      // Una salida pasada solo cuenta si HQ llegó a marcarla "En Alquiler" (archivo 720).
      // Las reservas que solo aparecieron en el 704 y cuya fecha ya pasó no llegaron a salir.
      if (!x.visto_en_alquiler && new Date(x.entrega) < hoy) return;
      var k = base(x.ac_id); if (!m.has(k)) m.set(k, []); m.get(k).push(dia(x.entrega));
    });
    mapa = m; return true;
  }

  /** true si la limpieza del día `limpiezaDia` ya no vale para la salida del día `salidaDia`
   *  (hubo otra salida entre medias). `extra`: días de salida conocidos por la app (archivos 704/720). */
  window.__acllarLimpiezaCaducada = function (id, limpiezaDia, salidaDia, extra) {
    if (!limpiezaDia || !salidaDia) return false;
    var lista = (mapa.get(base(id)) || []).concat(extra || []);
    return lista.some(function (d) { return d >= limpiezaDia && d < salidaDia; });
  };

  var intentos = 0;
  (function loop() {
    cargar().then(function (ok) { setTimeout(loop, ok ? 10 * 60 * 1000 : Math.min(5000, 300 * (++intentos))); })
      .catch(function () { setTimeout(loop, 5000); });
  })();
})();
