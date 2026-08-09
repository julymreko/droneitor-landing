(function () {
  "use strict";

  /* ============================================================
     i18n — copy exacto tomado de Droneitor Landing.dc.html
     ============================================================ */
  var I18N = {
    es: {
      title: "Droneitor — Fotografía y video aéreo",
      eyebrow: "Servicios de drones comerciales",
      h1a: "Tu proyecto se ve mejor", h1b: "desde el cielo.",
      sub: "Fotografía y video aéreo cinematográfico para bienes raíces, eventos y construcción. Déjanos tus datos y obtén un 10% de descuento en tu primer servicio.",
      t1: "Pilotos certificados", t2: "Servicio asegurado", t3: "Agenda en la semana",
      formTitle: "Obtén tu 10% de descuento",
      lblName: "Nombre", phName: "Tu nombre", errName: "Escribe tu nombre.",
      lblEmail: "Correo", phEmail: "tucorreo@ejemplo.com", errEmail: "Escribe un correo válido.",
      lblPhone: "Teléfono", phPhone: "Tu número de contacto", errPhone: "Escribe un teléfono válido.",
      lblProject: "Tipo de Proyecto", errProject: "Selecciona un tipo de proyecto.",
      optPlaceholder: "Selecciona una opción", optRealEstate: "Bienes Raíces", optEvents: "Eventos", optConstruction: "Construcción", optOther: "Otro",
      captcha: "No soy un robot", errCaptcha: "Completa la verificación de seguridad.",
      sending: "Enviando…",
      errSubmit: "No pudimos enviar tus datos. Revisa tu conexión e inténtalo de nuevo.",
      consent: "Acepto el tratamiento de mis datos y autorizo a Droneitor a contactarme por teléfono, SMS o correo sobre mi descuento y mi servicio.",
      errConsent: "Debes aceptar el aviso de privacidad para continuar.",
      cta: "Quiero mi 10% de descuento",
      ctaUnlock: "Desbloquea tu 10% de descuento",
      microcopy: "Sin spam. Te contactamos solo para tu descuento y tu servicio.",
      legal: "Tus datos están protegidos, no se venden ni se comparten con terceros y jamás se usan para fines ilegales: su tratamiento cumple con la legislación vigente del estado de Florida, incluidas la Florida Information Protection Act (FIPA) y la Florida Telephone Solicitation Act (FTSA).",
      okTitle: "¡Listo!", okBody: "Recibimos tus datos. Te enviaremos tu 10% de descuento y te contactaremos para agendar tu primer vuelo.",
      benEyebrow: "Por qué Droneitor",
      benHeading: "Tomas que impresionan, con la precisión de un equipo profesional.",
      b1t: "Tecnología cine 4K/6K", b1b: "Drones profesionales con estabilización de nivel cine. Cada toma nítida, fluida y lista para publicar.",
      b2t: "Ángulos imposibles", b2b: "Perspectivas aéreas que ninguna cámara a nivel de suelo logra. Muestra tu proyecto a una escala que detiene el scroll.",
      b3t: "Entrega rápida", b3b: "Agenda en días, no en semanas. Recibes el material editado y listo para publicar cuando lo necesitas.",
      b4t: "Precisión certificada", b4b: "Pilotos certificados y planeación milimétrica de cada vuelo. Resultados consistentes y seguros en cada servicio.",
      footerTag: "Fotografía y video aéreo profesional",
      designedBy: "Designed by",
      heroAlt1: "Costa — toma cenital",
      heroAlt2: "Bienes raíces — villa moderna",
      heroAlt3: "Miami Bayside — skyline nocturno",
      heroAlt4: "Eventos — estadio en vivo",
      heroAlt5: "Construcción — avance de obra"
    },
    en: {
      title: "Droneitor — Aerial photo & video",
      eyebrow: "Commercial drone services",
      h1a: "Your project looks better", h1b: "from above.",
      sub: "Cinematic aerial photo & video for real estate, events and construction. Leave your details and get 10% off your first service.",
      t1: "Licensed pilots", t2: "Fully insured", t3: "Same-week booking",
      formTitle: "Get your 10% discount",
      lblName: "Name", phName: "Your name", errName: "Enter your name.",
      lblEmail: "Email", phEmail: "you@example.com", errEmail: "Enter a valid email.",
      lblPhone: "Phone", phPhone: "Your contact number", errPhone: "Enter a valid phone number.",
      lblProject: "Project Type", errProject: "Choose a project type.",
      optPlaceholder: "Select an option", optRealEstate: "Real Estate", optEvents: "Events", optConstruction: "Construction", optOther: "Other",
      captcha: "I'm not a robot", errCaptcha: "Please complete the security check.",
      sending: "Sending…",
      errSubmit: "We couldn't send your details. Check your connection and try again.",
      consent: "I agree to the processing of my data and authorize Droneitor to contact me by phone, SMS or email about my discount and service.",
      errConsent: "You must accept the privacy notice to continue.",
      cta: "Get my 10% discount",
      ctaUnlock: "Unlock my 10% discount",
      microcopy: "No spam. We only contact you about your discount and service.",
      legal: "Your data is protected, never sold or shared with third parties and never used for unlawful purposes: it is handled in compliance with current Florida law, including the Florida Information Protection Act (FIPA) and the Florida Telephone Solicitation Act (FTSA).",
      okTitle: "You're all set.", okBody: "We've got your details. We'll email your 10% discount and reach out to schedule your first flight.",
      benEyebrow: "Why Droneitor",
      benHeading: "Shots that impress, with the precision of a professional crew.",
      b1t: "4K/6K cinema tech", b1b: "Pro drones with cinema-grade stabilization. Every shot sharp, smooth and ready to publish.",
      b2t: "Impossible angles", b2b: "Aerial perspectives no ground camera can reach. Show your project at a scale that stops the scroll.",
      b3t: "Fast turnaround", b3b: "Book in days, not weeks. Delivered edited and ready to post when you need it.",
      b4t: "Certified precision", b4b: "Licensed pilots and millimeter flight planning. Consistent, safe results on every job.",
      footerTag: "Professional aerial photo & video",
      designedBy: "Designed by",
      heroAlt1: "Coastline — aerial top-down shot",
      heroAlt2: "Real estate — modern villa",
      heroAlt3: "Miami Bayside — night skyline",
      heroAlt4: "Events — live stadium",
      heroAlt5: "Construction — site progress"
    }
  };

  // El sitio real (droneitor.com) es en inglés por defecto (og:locale en_US)
  // y el público de campañas es angloparlante en Florida — el idioma por
  // defecto de la landing debe coincidir para SEO. El toggle ES sigue
  // disponible para cambiar manualmente.
  var DEFAULT_LANG = "en";
  var state = { lang: DEFAULT_LANG };

  /* ============================================================
     Idioma
     ============================================================ */
  function setLang(lang) {
    var dict = I18N[lang];
    if (!dict) return;
    state.lang = lang;

    document.documentElement.lang = lang;
    document.title = dict.title;

    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var key = el.getAttribute("data-i18n");
      if (dict[key] != null) el.textContent = dict[key];
    });
    document.querySelectorAll("[data-i18n-ph]").forEach(function (el) {
      var key = el.getAttribute("data-i18n-ph");
      if (dict[key] != null) el.setAttribute("placeholder", dict[key]);
    });
    document.querySelectorAll("[data-i18n-alt]").forEach(function (el) {
      var key = el.getAttribute("data-i18n-alt");
      if (dict[key] != null) el.setAttribute("alt", dict[key]);
    });

    document.getElementById("langEN").classList.toggle("active", lang === "en");
    document.getElementById("langES").classList.toggle("active", lang === "es");

    // El widget de Turnstile ya montado no puede cambiar de idioma:
    // hay que recrearlo. En el primer setLang() todavía no existe y no hace nada.
    if (typeof renderTurnstile === "function") renderTurnstile();
  }

  document.getElementById("langEN").addEventListener("click", function () { setLang("en"); });
  document.getElementById("langES").addEventListener("click", function () { setLang("es"); });

  /* ============================================================
     Hero slider — crossfade + Ken Burns, 5 fotos reales
     ============================================================ */
  (function initSlider() {
    var slides = Array.prototype.slice.call(document.querySelectorAll(".heroSlide"));
    if (!slides.length) return;
    var current = 0;
    slides[0].classList.add("active");

    // Slide 1 (LCP) loads eagerly at full priority. Slides 2-5 sit on the
    // exact same rect (position:absolute inset:0), so native loading="lazy"
    // alone won't actually defer their network request — the browser still
    // sees them "in viewport". We hold their real src/srcset in data-*
    // attributes and only swap them in after the window's load event, so
    // they never compete with the LCP image or fonts for bandwidth.
    function loadSlide(slide) {
      var img = slide.querySelector("img[data-src]");
      if (!img) return;
      if (img.dataset.srcset) { img.srcset = img.dataset.srcset; img.removeAttribute("data-srcset"); }
      img.src = img.dataset.src;
      img.removeAttribute("data-src");
    }

    function loadRemainingSlides() {
      slides.slice(1).forEach(loadSlide);
    }

    if (document.readyState === "complete") {
      loadRemainingSlides();
    } else {
      window.addEventListener("load", loadRemainingSlides, { once: true });
    }

    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return; // se queda en la primera foto, sin animación

    setInterval(function () {
      slides[current].classList.remove("active");
      current = (current + 1) % slides.length;
      loadSlide(slides[current]); // red de seguridad si "load" aún no disparó
      slides[current].classList.add("active");
    }, 6500);
  })();

  /* ============================================================
     Altímetro — progreso de scroll de la página
     ============================================================ */
  (function initAltimeter() {
    var fill = document.getElementById("altFill");
    var val = document.getElementById("altVal");
    if (!fill || !val) return;
    var raf = 0;

    function paint() {
      raf = 0;
      var doc = document.documentElement;
      var scrollTop = window.pageYOffset || doc.scrollTop || 0;
      var vh = window.innerHeight;
      var sh = doc.scrollHeight;
      var prog = Math.min(1, Math.max(0, scrollTop / Math.max(1, sh - vh)));
      fill.style.height = (prog * 100).toFixed(2) + "%";
      val.textContent = "ALT " + Math.round(394 * (1 - prog)) + " FT";
    }

    function tick() { if (!raf) raf = requestAnimationFrame(paint); }
    window.addEventListener("scroll", tick, { passive: true });
    window.addEventListener("resize", tick);
    paint();
  })();

  /* ============================================================
     Reveal-on-scroll de las tarjetas de beneficios
     ============================================================ */
  (function initReveal() {
    var cards = Array.prototype.slice.call(document.querySelectorAll(".ben"));
    if (!cards.length) return;

    if (!("IntersectionObserver" in window)) {
      cards.forEach(function (c) { c.classList.add("in"); });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry, i) {
        if (entry.isIntersecting) {
          var idx = cards.indexOf(entry.target);
          setTimeout(function () { entry.target.classList.add("in"); }, Math.max(0, idx) * 100);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: "0px 0px -10% 0px" });

    cards.forEach(function (c) { observer.observe(c); });
  })();

  /* ============================================================
     Scroll suave al formulario (CTA de la sección de beneficios)
     ============================================================ */
  document.getElementById("scrollToFormBtn").addEventListener("click", function () {
    var el = document.getElementById("formCard");
    if (!el) return;
    var top = el.getBoundingClientRect().top + window.pageYOffset - 96;
    window.scrollTo({ top: top, behavior: "smooth" });
  });

  /* ============================================================
     Atribución de campaña (UTM)

     Esta landing existe para recibir tráfico de anuncios pagados, así que
     hay que saber qué anuncio produjo cada lead. Los parámetros se leen al
     cargar y se guardan en sessionStorage: si el visitante recarga o llega
     por una URL ya limpia antes de enviar, la atribución no se pierde.
     ============================================================ */
  var UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];

  var utmParams = (function captureUtm() {
    var STORAGE_KEY = "droneitor.utm";
    var fromUrl = {};
    var found = false;

    var qs = new URLSearchParams(window.location.search);
    UTM_KEYS.forEach(function (key) {
      var value = qs.get(key);
      if (value) { fromUrl[key] = value.slice(0, 200); found = true; }
    });

    // Safari en modo privado puede lanzar al tocar sessionStorage, y perder
    // la atribución nunca justifica romper el formulario.
    try {
      if (found) {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(fromUrl));
        return fromUrl;
      }
      var saved = sessionStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch (err) {
      return fromUrl;
    }
  })();

  /* ============================================================
     Turnstile

     Se renderiza explícitamente (no con class="cf-turnstile") porque el
     widget no puede cambiar de idioma después de montado: con el toggle
     ES/EN hay que destruirlo y volver a crearlo.
     ============================================================ */

  // Clave pública del widget "Droneitor landing" (modo managed, dominio
  // fly.droneitor.com). Es pública por diseño: va en el cliente. El secreto
  // correspondiente vive en `wrangler secret put TURNSTILE_SECRET_KEY`.
  //
  // Este sitekey sólo resuelve en fly.droneitor.com. Para desarrollo local,
  // sustituir temporalmente por la clave de prueba de Cloudflare
  // "1x00000000000000000000AA" (siempre aprueba) y usar su secreto
  // "1x0000000000000000000000000000000AA" en .dev.vars.
  var TURNSTILE_SITE_KEY = "0x4AAAAAAEK4NCNA7EerQLIs";

  var turnstileWidgetId = null;

  function renderTurnstile() {
    var container = document.getElementById("turnstileWidget");
    if (!window.turnstile || !container) return;

    if (turnstileWidgetId !== null) {
      window.turnstile.remove(turnstileWidgetId);
      turnstileWidgetId = null;
    }
    container.innerHTML = "";

    turnstileWidgetId = window.turnstile.render(container, {
      sitekey: TURNSTILE_SITE_KEY,
      theme: "dark",
      language: state.lang,
      callback: function () {
        document.getElementById("field-captcha").classList.remove("invalid");
        document.querySelector(".captchaMsg").classList.remove("show");
      }
    });
  }

  // La llama el <script> de Turnstile al terminar de cargar (onload=...).
  window.droneitorTurnstileReady = renderTurnstile;

  function getTurnstileToken() {
    if (!window.turnstile || turnstileWidgetId === null) return "";
    return window.turnstile.getResponse(turnstileWidgetId) || "";
  }

  // Los tokens de Turnstile son de un solo uso y caducan (~5 min): sin este
  // reset, cualquier reintento tras un fallo daría "timeout-or-duplicate".
  function resetTurnstile() {
    if (window.turnstile && turnstileWidgetId !== null) {
      window.turnstile.reset(turnstileWidgetId);
    }
  }

  /* ============================================================
     Formulario de captura de leads
     ============================================================ */
  (function initForm() {
    var form = document.getElementById("leadForm");
    var card = document.getElementById("formCard");
    var body = document.getElementById("formBody");
    var success = document.getElementById("formSuccess");
    if (!form) return;

    var fields = {
      name: document.getElementById("f-name"),
      email: document.getElementById("f-email"),
      phone: document.getElementById("f-phone"),
      project: document.getElementById("f-project")
    };
    var consent = document.getElementById("f-consent");
    var captchaRow = document.getElementById("field-captcha");
    var captchaMsg = document.querySelector(".captchaMsg");
    var consentMsg = document.querySelector(".consentMsg");
    var submitBtn = form.querySelector(".ctaSubmit");
    var formError = document.getElementById("formError");

    // Estado visual del <select> vacío vs con valor (para el color del texto)
    fields.project.addEventListener("change", function () {
      fields.project.classList.toggle("hasValue", fields.project.value !== "");
    });

    // Limpiar estado inválido al escribir/cambiar
    Object.keys(fields).forEach(function (key) {
      fields[key].addEventListener("input", function () { clearInvalid(key); });
      fields[key].addEventListener("change", function () { clearInvalid(key); });
    });
    consent.addEventListener("change", function () {
      consentMsg.classList.remove("show");
    });

    function clearInvalid(key) {
      var wrap = document.getElementById("field-" + key);
      if (wrap) wrap.classList.remove("invalid");
    }

    function markInvalid(key) {
      var wrap = document.getElementById("field-" + key);
      if (wrap) wrap.classList.add("invalid");
    }

    function validate() {
      var errors = [];
      var name = fields.name.value.trim();
      var email = fields.email.value.trim();
      var phone = fields.phone.value.trim();
      var project = fields.project.value;

      if (name.length < 2) errors.push("name");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("email");

      var digits = (phone.match(/\d/g) || []).length;
      if (!/^[+()\-\s\d]{7,}$/.test(phone) || digits < 7) errors.push("phone");

      if (project === "") errors.push("project");
      if (!getTurnstileToken()) errors.push("captcha");
      if (!consent.checked) errors.push("consent");

      return errors;
    }

    function showErrors(errors) {
      errors.forEach(function (key) {
        if (key === "captcha") { captchaRow.classList.add("invalid"); captchaMsg.classList.add("show"); }
        else if (key === "consent") { consentMsg.classList.add("show"); }
        else markInvalid(key);
      });
      var first = errors[0];
      var focusEl = fields[first] || (first === "consent" ? consent : null);
      if (focusEl) focusEl.focus();
      else captchaRow.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    function setSubmitting(on) {
      submitBtn.disabled = on;
      submitBtn.textContent = I18N[state.lang][on ? "sending" : "cta"];
    }

    function showFormError() {
      formError.textContent = I18N[state.lang].errSubmit;
      formError.removeAttribute("hidden");
    }

    function showSuccess() {
      card.classList.add("done");
      body.setAttribute("hidden", "");
      success.removeAttribute("hidden");
      success.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    function buildPayload() {
      var lead = {
        name: fields.name.value.trim(),
        email: fields.email.value.trim(),
        phone: fields.phone.value.trim(),
        project: fields.project.value,
        lang: state.lang,
        consent: true,
        turnstileToken: getTurnstileToken()
      };
      UTM_KEYS.forEach(function (key) {
        if (utmParams[key]) lead[key] = utmParams[key];
      });
      return lead;
    }

    function submitLead() {
      setSubmitting(true);

      return fetch("/api/lead", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(buildPayload())
      })
        .then(function (res) {
          return res.json()
            .catch(function () { return {}; })
            .then(function (data) { return { res: res, data: data }; });
        })
        .then(function (out) {
          // El éxito sólo se muestra si el Worker confirmó que el lead quedó
          // guardado en D1. Nunca por haber enviado la petición sin más.
          if (out.res.ok && out.data.ok === true) {
            showSuccess();
            return;
          }

          // El token ya se consumió; sin reset, el reintento fallaría siempre.
          resetTurnstile();

          if (Array.isArray(out.data.errors) && out.data.errors.length) {
            showErrors(out.data.errors);
          } else {
            showFormError();
          }
          setSubmitting(false);
        })
        .catch(function (err) {
          console.error("Envío del lead falló:", err);
          resetTurnstile();
          showFormError();
          setSubmitting(false);
        });
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      formError.setAttribute("hidden", "");

      var errors = validate();
      if (errors.length) {
        showErrors(errors);
        return;
      }

      submitLead();
    });
  })();

  /* ============================================================
     Arranque
     ============================================================ */
  setLang(DEFAULT_LANG);
})();
