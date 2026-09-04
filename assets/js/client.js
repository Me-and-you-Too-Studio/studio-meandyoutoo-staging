(function () {
  if (!StudioAPI.requireAuth("admin")) return;
  const $ = (s) => document.querySelector(s),
    $$ = (s) => [...document.querySelectorAll(s)],
    esc = (v) =>
      String(v ?? "").replace(
        /[&<>"']/g,
        (c) =>
          ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
          })[c],
      );
  const fmt = (v) => Number(v || 0).toLocaleString("fr-FR"),
    date = (v) =>
      v
        ? new Date(String(v).slice(0, 10) + "T12:00:00").toLocaleDateString(
            "fr-FR",
          )
        : "—",
    dateTime = (v) =>
      v
        ? new Date(v).toLocaleString("fr-FR", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "Jamais";
  const params = new URLSearchParams(location.search),
    requestedOrg = params.get("organizationId"),
    requestedProject = params.get("projectId"),
    requestedPublish = params.get("publish") === "1";
  let organization = null,
    users = new Map(),
    projects = new Map(),
    folders = [],
    activeFolder = "all",
    activeTheme = "all",
    filter = "all",
    sortMode = "updated-desc",
    publishOpened = false;
  const orgUsers = (o) => (Array.isArray(o?.users) ? o.users : []),
    orgProjects = (o) => (Array.isArray(o?.projects) ? o.projects : []),
    orgSectors = (o) =>
      Array.isArray(o?.sectors) && o.sectors.length
        ? o.sectors
        : o?.sector
          ? [o.sector]
          : [],
    remaining = (o) =>
      o?.pack_unlimited
        ? null
        : Math.max(
            0,
            Number(o?.passations_quota || 0) - Number(o?.passations_used || 0),
          );
  const accessLabels = {
      owner: "Responsable du compte",
      manager: "Gestionnaire de campagnes",
      contributor: "Contributeur",
      viewer: "Lecture seule",
    },
    permissionLabels = {
      manage_users: "Gérer les comptes et les accès",
      create_campaigns: "Créer des campagnes",
      edit_campaigns: "Modifier et renommer les campagnes, et demander des ajustements",
      organize_folders: "Organiser les campagnes dans des dossiers",
      submit_campaigns:
        "Transmettre une configuration à Me&YouToo pour relecture",
      manage_schedule: "Programmer, prolonger et reprogrammer",
      manage_kit: "Gérer le kit de communication et le lien de diffusion",
      view_results: "Voir le lien des résultats et les statistiques",
      order_passations: "Commander des passations",
      track_orders: "Suivre les commandes de passations",
    },
    permissionPresets = {
      owner: {
        manage_users: true,
        create_campaigns: true,
        edit_campaigns: true,
        organize_folders: true,
        submit_campaigns: true,
        manage_schedule: true,
        manage_kit: true,
        view_results: true,
        order_passations: true,
        track_orders: true,
      },
      manager: {
        manage_users: false,
        create_campaigns: true,
        edit_campaigns: true,
        organize_folders: true,
        submit_campaigns: true,
        manage_schedule: true,
        manage_kit: true,
        view_results: true,
        order_passations: false,
        track_orders: true,
      },
      contributor: {
        manage_users: false,
        create_campaigns: true,
        edit_campaigns: true,
        organize_folders: false,
        submit_campaigns: true,
        manage_schedule: false,
        manage_kit: true,
        view_results: false,
        order_passations: false,
        track_orders: false,
      },
      viewer: {
        manage_users: false,
        create_campaigns: false,
        edit_campaigns: false,
        organize_folders: false,
        submit_campaigns: false,
        manage_schedule: false,
        manage_kit: false,
        view_results: false,
        order_passations: false,
        track_orders: false,
      },
    };
  function renderPermissionFields(values = {}) {
    const root = $("#user-permissions");
    root.innerHTML = Object.entries(permissionLabels)
      .map(
        ([key, label]) =>
          '<label><input type="checkbox" data-user-permission="' +
          key +
          '" ' +
          (values[key] ? "checked" : "") +
          "> <span>" +
          esc(label) +
          "</span></label>",
      )
      .join("");
  }
  function selectedPermissions() {
    return Object.fromEntries(
      $$("[data-user-permission]").map((input) => [
        input.dataset.userPermission,
        input.checked,
      ]),
    );
  }
  function showError(message) {
    const box = $("#client-alert");
    box.hidden = false;
    box.textContent = message;
    box.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  function normalizedStatus(p) {
    return p.status === "configuration_submitted"
      ? "review_pending"
      : ["completed", "closed"].includes(p.status)
        ? "unpublished"
        : p.status;
  }
  function statusLabel(p) {
    return (
      {
        draft: "Brouillon",
        review_pending: "À relire",
        in_review: "En relecture",
        client_validation_required: "Validation client requise",
        ready_to_publish: "Prête à publier",
        scheduled: "Programmée",
        published: "Publiée",
        active: "Publiée",
        unpublished: "Dépubliée",
        archived: "Archivée",
      }[normalizedStatus(p)] ||
      p.status ||
      "—"
    );
  }
  function daysUntilClose(p) {
    if (!p.close_date) return null;
    const close = new Date(String(p.close_date).slice(0, 10) + "T12:00:00"),
      now = new Date();
    now.setHours(12, 0, 0, 0);
    return Math.ceil((close - now) / 86400000);
  }
  function daysUntilStart(p) {
    if (!p.launch_date) return null;
    const start = new Date(String(p.launch_date).slice(0, 10) + "T12:00:00"),
      now = new Date();
    now.setHours(12, 0, 0, 0);
    return Math.ceil((start - now) / 86400000);
  }
  function isStartingSoon(p) {
    const days = daysUntilStart(p);
    return normalizedStatus(p) === "scheduled" && days !== null && days >= 0 && days <= 14;
  }
  function isEndingSoon(p) {
    const st = normalizedStatus(p),
      days = daysUntilClose(p);
    return (
      ["scheduled", "published", "active"].includes(st) &&
      days !== null &&
      days >= 0 &&
      days <= 14
    );
  }
  function adFilterKey(p) {
    const st = normalizedStatus(p);
    if (
      [
        "review_pending",
        "in_review",
        "client_validation_required",
        "ready_to_publish",
      ].includes(st)
    )
      return "sent";
    if (st === "draft") return "draft";
    if (st === "archived") return "archived";
    if (st === "unpublished") return "unpublished";
    if (st === "scheduled") return "scheduled";
    if (["published", "active"].includes(st)) return "published";
    return st;
  }
  function actions(p) {
    const st = normalizedStatus(p),
      id = p.id,
      q = "?projectId=" + encodeURIComponent(id),
      more = [];
    more.push('<button type="button" data-rename="' + id + '">✏️ Renommer</button>');
    more.push('<button type="button" data-move-folder="' + id + '">📁 Classer</button>');
    let primary = "";
    if (st === "ready_to_publish")
      primary = '<button class="button button-primary" type="button" data-publish="' + id + '">🚀 Publier</button>';
    else if (["unpublished", "archived"].includes(st))
      primary = '<button class="button button-primary" type="button" data-reprogram="' + id + '">🚀 Reprogrammer</button>';
    else if (st === "draft")
      primary =
        '<a class="button button-primary" href="' +
          (p.current_step === "parametrage"
            ? "parametrage.html"
            : p.current_step === "personnalisation"
              ? "personnalisation.html"
              : "composer.html") +
          q +
          '">✏️ Reprendre</a>';
    else if (
      [
        "review_pending",
        "in_review",
        "client_validation_required",
        "ready_to_publish",
      ].includes(st)
    )
      primary =
        '<a class="button button-primary" href="validation.html' +
          q +
          '">🔎 Relecture et corrections</a>';
    else
      primary =
        '<a class="button button-secondary" href="campagne-detail.html' +
          q +
          '">👁️ Voir la campagne</a>';
    const kit = '<a class="button button-secondary" href="kit-communication.html' + q + '">📣 Kit de com</a>';
    if (["scheduled", "published", "active"].includes(st))
      more.push(
        '<button type="button" data-extend="' +
          id +
          '">📅 Prolonger</button>',
      );
    if (["published", "active"].includes(st))
      more.push(
        '<button class="danger" type="button" data-unpublish="' +
          id +
          '">⏹ Dépublier</button>',
      );
    if (
      ["scheduled", "published", "active", "unpublished", "archived"].includes(
        st,
      )
    )
      more.push(
        '<button type="button" data-clone="' +
          id +
          '">🧬 Cloner</button>',
      );
    if (st === "unpublished")
      more.push(
        '<button type="button" data-archive="' +
          id +
          '">📦 Archiver</button>',
      );
    if (!["published", "active", "scheduled"].includes(st))
      more.push(
        '<button class="danger" type="button" data-delete-project="' +
          id +
          '">🗑️ Supprimer</button>',
      );
    return primary + kit + '<details class="campaign-more"><summary>Autres actions</summary><div class="campaign-more-menu">' + more.join("") + '</div></details>';
  }
  function card(p) {
    const st = normalizedStatus(p),
      theme = p.theme_title || "Thématique",
      title = p.campaign_name || p.title || "Sans nom",
      respondent = p.respondent_title || title,
      contact = orgUsers(organization)[0],
      commanditaire = contact
        ? esc((contact.first_name || "") + " " + (contact.last_name || "")) +
          " — " +
          esc(contact.email || "")
        : "Non renseigné dans cet AD.",
      days = daysUntilClose(p),
      startDays = daysUntilStart(p),
      starting = isStartingSoon(p)
        ? '<span class="admin-ad-status status-starting">Début dans ' +
          startDays +
          " jour" +
          (startDays > 1 ? "s" : "") +
          "</span>"
        : "",
      ending = isEndingSoon(p)
        ? '<span class="admin-ad-status status-ending">Fin dans ' +
          days +
          " jour" +
          (days > 1 ? "s" : "") +
          "</span>"
        : "";
    const folder = folders.find((item) => String(item.id) === String(p.folder_id || ""));
    return (
      '<article class="admin-ad-card" data-ad-card data-status="' +
      adFilterKey(p) +
      '" data-folder-id="' +
      esc(p.folder_id || "") +
      '" data-theme="' +
      esc(theme) +
      '" data-ending-soon="' +
      (isEndingSoon(p) ? "true" : "false") +
      '" data-starting-soon="' +
      (isStartingSoon(p) ? "true" : "false") +
      '" data-has-results="' +
      (String(p.communication_results_url || "").trim() ? "true" : "false") +
      '" data-search="' +
      esc((title + " " + theme + " " + respondent).toLowerCase()) +
      '" id="admin-ad-' +
      p.id +
      '"><h3>' +
      esc(title) +
      '</h3><div class="admin-ad-meta">Base catalogue : <strong>' +
      esc(theme) +
      '</strong></div><div class="admin-ad-meta">Titre répondants : <strong>' +
      esc(respondent) +
      '</strong></div><div class="admin-ad-tags"><span class="admin-ad-theme">' +
      esc(theme) +
      '</span><span class="admin-ad-status status-' +
      st +
      '">' +
      statusLabel(p) +
      "</span>" +
      (folder ? '<span class="campaign-folder-tag">📁 ' + esc(folder.name) + '</span>' : "") +
      starting +
      ending +
      '</div><div class="admin-ad-commanditaire"><strong>Commanditaire campagne</strong><span>' +
      commanditaire +
      '</span></div><div class="admin-ad-dates">Début : ' +
      date(p.launch_date) +
      "<br>Fin : " +
      date(p.close_date) +
      '</div><div class="admin-ad-actions">' +
      actions(p) +
      "</div></article>"
    );
  }
  function userRow(u) {
    const status = !u.active
        ? "Désactivé"
        : u.must_change_password
          ? "Invitation à finaliser"
          : "Activé",
      level = accessLabels[u.access_level] || accessLabels.manager;
    return (
      '<article class="admin-inline-user"><div><strong>' +
      esc((u.first_name || "") + " " + (u.last_name || "")) +
      "</strong><span>" +
      esc(u.job_title || "Fonction non renseignée") +
      " · " +
      esc(u.email) +
      '</span><small><b class="access-level-badge">' +
      esc(level) +
      "</b> · " +
      status +
      " · activité " +
      dateTime(u.last_seen_at || u.last_login_at) +
      "</small></div><div>" +
      (u.must_change_password && u.active
        ? '<button data-resend-client="' + u.id + '">Renvoyer</button>'
        : "") +
      '<button data-edit-client="' +
      u.id +
      '">Modifier les droits</button><button data-toggle-client="' +
      u.id +
      '" data-active="' +
      (u.active ? "false" : "true") +
      '">' +
      (u.active ? "Désactiver" : "Réactiver") +
      '</button><button class="danger" data-delete-client="' +
      u.id +
      '">Supprimer</button></div></article>'
    );
  }
  function sortProjects(rows) {
    return [...rows].sort((a, b) => {
      const nameA = a.campaign_name || a.title || "",
        nameB = b.campaign_name || b.title || "";
      if (sortMode === "name-asc") return nameA.localeCompare(nameB, "fr", { sensitivity: "base" });
      if (sortMode === "launch-asc") return String(a.launch_date || "9999-12-31").localeCompare(String(b.launch_date || "9999-12-31"));
      if (sortMode === "close-asc") return String(a.close_date || "9999-12-31").localeCompare(String(b.close_date || "9999-12-31"));
      return new Date(b.updated_at || 0) - new Date(a.updated_at || 0);
    });
  }
  function askFolderValue(title, value = "", project = null) {
    return new Promise((resolve) => {
      document.getElementById("admin-folder-dialog")?.remove();
      const dialog = document.createElement("dialog");
      dialog.id = "admin-folder-dialog";
      dialog.className = "admin-dialog campaign-rename-dialog";
      const move = Boolean(project);
      dialog.innerHTML = '<form method="dialog"><button class="admin-dialog-close" value="cancel" aria-label="Fermer">×</button><p class="eyebrow">Classement client</p><h2>' + esc(title) + '</h2>' + (move ? '<p>« ' + esc(project.campaign_name || project.title || "Campagne") + ' »</p><label class="field"><span>Dossier</span><select id="admin-folder-value"><option value="">Non classées</option>' + folders.map((f) => '<option value="' + esc(f.id) + '" ' + (String(project.folder_id || "") === String(f.id) ? "selected" : "") + '>' + esc(f.name) + '</option>').join("") + '</select></label>' : '<p>Utilisez un nom utile au client : année, équipe, thématique ou projet.</p><label class="field"><span>Nom du dossier</span><input id="admin-folder-value" minlength="2" maxlength="80" required value="' + esc(value) + '"></label>') + '<div class="top-actions"><button class="button button-ghost" value="cancel">Annuler</button><button class="button button-primary" type="button" id="admin-folder-confirm">Enregistrer</button></div></form>';
      document.body.append(dialog);
      let done = false;
      const finish = (result) => { if (done) return; done = true; dialog.close(); dialog.remove(); resolve(result); };
      dialog.querySelectorAll('[value="cancel"]').forEach((b) => b.onclick = () => finish(null));
      dialog.addEventListener("cancel", (e) => { e.preventDefault(); finish(null); });
      dialog.querySelector("#admin-folder-confirm").onclick = () => { const input = dialog.querySelector("#admin-folder-value"), result = move ? input.value : input.value.replace(/\s+/g, " ").trim(); if (!move && result.length < 2) { input.reportValidity(); return; } finish(result); };
      dialog.showModal();
    });
  }
  function renderFolderBar(ps) {
    const root = $("#client-folder-bar");
    if (!root) return;
    const chip = (key, label, count) => '<button type="button" class="campaign-folder-chip ' + (activeFolder === key ? "is-active" : "") + '" data-admin-folder-filter="' + esc(key) + '"><span>' + label + '</span><strong>' + count + '</strong></button>';
    root.innerHTML = '<div class="campaign-folder-heading"><div><strong>Mes dossiers pour ce client</strong><span>Votre classement personnel des campagnes</span></div><button class="campaign-folder-create" type="button" data-admin-folder-create>+ Nouveau dossier</button></div><div class="campaign-folder-list">' + chip("all", "🗂️ Toutes", ps.length) + chip("unclassified", "📄 Non classées", ps.filter((p) => !p.folder_id).length) + folders.map((f) => '<span class="campaign-folder-group">' + chip(String(f.id), "📁 " + esc(f.name), ps.filter((p) => String(p.folder_id || "") === String(f.id)).length) + '<button type="button" class="campaign-folder-manage" data-admin-folder-manage="' + esc(f.id) + '" aria-label="Gérer ' + esc(f.name) + '">•••</button></span>').join("") + '</div>';
  }
  function render() {
    const ps = sortProjects(orgProjects(organization)),
      rem = remaining(organization),
      used = Number(organization.passations_used || 0),
      quota = Number(organization.passations_quota || 0),
      rate = quota ? Math.min(100, Math.round((used / quota) * 100)) : 0;
    projects = new Map(ps.map((p) => [String(p.id), p]));
    renderFolderBar(ps);
    $("#client-name").textContent = organization.name || "Dossier client";
    $("#client-subtitle").textContent =
      (orgSectors(organization).join(" · ") || "Secteur non renseigné") +
      " · " +
      ps.length +
      " autodiagnostic" +
      (ps.length > 1 ? "s" : "") +
      " · " +
      orgUsers(organization).length +
      " compte" +
      (orgUsers(organization).length > 1 ? "s" : "");
    $("#client-summary").innerHTML =
      "<article><span>Crédits attribués</span><strong>" +
      (organization.pack_unlimited ? "Illimité" : fmt(quota)) +
      "</strong><small>Fin : " +
      date(organization.pack_expires_at) +
      "</small></article><article><span>Restants</span><strong>" +
      (organization.pack_unlimited ? "∞" : fmt(rem)) +
      "</strong><small>Solde disponible</small></article><article><span>Utilisation</span><strong>" +
      rate +
      "%</strong><small>" +
      fmt(used) +
      " utilisés</small></article><article><span>Accès</span><strong>" +
      (organization.active === false ? "Fermé" : "Ouvert") +
      "</strong><small>" +
      orgUsers(organization).length +
      " compte" +
      (orgUsers(organization).length > 1 ? "s" : "") +
      "</small></article>";
    const counts = {
      all: ps.length,
      startingSoon: ps.filter(isStartingSoon).length,
      endingSoon: ps.filter(isEndingSoon).length,
      results: ps.filter((p) => Boolean(String(p.communication_results_url || "").trim())).length,
      sent: 0,
      draft: 0,
      scheduled: 0,
      published: 0,
      unpublished: 0,
      archived: 0,
    };
    ps.forEach((p) => {
      const k = adFilterKey(p);
      if (counts[k] != null) counts[k]++;
    });
    const chips = [
      ["all", "✨ Tous"],
      ["startingSoon", "🚀 Début proche"],
      ["endingSoon", "🔴 Fin proche"],
      ["sent", "🚀 À publier"],
      ["results", "📊 Résultats disponibles"],
      ["draft", "✏️ Brouillons"],
      ["scheduled", "🗓️ Programmées"],
      ["published", "🟢 Publiées"],
      ["unpublished", "🛑 Dépubliées"],
      ["archived", "📦 Archivées"],
    ];
    $("#client-campaign-watch").innerHTML =
      '<button type="button" class="admin-campaign-watch-card starting" data-watch-filter="startingSoon"><span class="admin-watch-icon">🚀</span><div><strong>' +
      counts.startingSoon +
      " campagne" +
      (counts.startingSoon > 1 ? "s" : "") +
      " commence" +
      (counts.startingSoon > 1 ? "nt" : "") +
      ' bientôt</strong><small>Dans les 14 prochains jours · préparer le plan de communication.</small></div></button>' +
      '<button type="button" class="admin-campaign-watch-card ending" data-watch-filter="endingSoon"><span class="admin-watch-icon">⏰</span><div><strong>' +
      counts.endingSoon +
      " campagne" +
      (counts.endingSoon > 1 ? "s" : "") +
      " se termine" +
      (counts.endingSoon > 1 ? "nt" : "") +
      ' bientôt</strong><small>Dans les 14 prochains jours · prévoir une dernière relance.</small></div></button>' +
      '<button type="button" class="admin-campaign-watch-card publish" data-watch-filter="sent"><span class="admin-watch-icon">📤</span><div><strong>' +
      counts.sent +
      ' à publier</strong><small>Configurations transmises ou en cours de relecture.</small></div></button>' +
      '<button type="button" class="admin-campaign-watch-card scheduled" data-watch-filter="scheduled"><span class="admin-watch-icon">🗓️</span><div><strong>' +
      counts.scheduled +
      ' programmée' +
      (counts.scheduled > 1 ? "s" : "") +
      '</strong><small>Campagnes planifiées à une date future.</small></div></button>' +
      '<button type="button" class="admin-campaign-watch-card results" data-watch-filter="results"><span class="admin-watch-icon">📊</span><div><strong>' +
      counts.results +
      ' résultat' +
      (counts.results > 1 ? "s" : "") +
      ' disponible' +
      (counts.results > 1 ? "s" : "") +
      '</strong><small>Liens accessibles dès la programmation et pendant la campagne.</small></div></button>';
    $("#client-ad-filters").innerHTML =
      chips
        .filter(([k]) => k === "all" || counts[k] > 0)
        .map(
          ([k, l]) =>
            '<button type="button" class="' +
            (k === filter ? "is-active" : "") +
            '" data-ad-filter="' +
            k +
            '">' +
            l +
            " <strong>" +
            counts[k] +
            "</strong></button>",
        )
        .join("") +
      '<label class="admin-ad-search">🔎 <input id="client-ad-search" type="search" placeholder="Rechercher un AD, une thématique…"></label>';
    $("#client-ad-filters").insertAdjacentHTML(
      "beforeend",
      '<label class="admin-ad-sort">Trier par <select id="client-ad-sort"><option value="updated-desc">Dernière modification</option><option value="name-asc">Nom A–Z</option><option value="launch-asc">Lancement le plus proche</option><option value="close-asc">Clôture la plus proche</option></select></label>',
    );
    const themes = [...new Set(ps.map((p) => p.theme_title).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));
    $("#client-ad-filters").insertAdjacentHTML("beforeend", '<label class="admin-ad-sort admin-theme-sort">Thématique <select id="admin-theme-filter"><option value="all">Toutes les thématiques</option>' + themes.map((theme) => '<option value="' + esc(theme) + '" ' + (activeTheme === theme ? "selected" : "") + '>' + esc(theme) + ' · ' + ps.filter((p) => p.theme_title === theme).length + '</option>').join("") + '</select></label>');
    $("#client-ad-sort").value = sortMode;
    $("#client-ads").innerHTML =
      ps.map(card).join("") ||
      '<p class="admin-empty">Aucun autodiagnostic.</p>';
    $("#client-users").innerHTML =
      orgUsers(organization).map(userRow).join("") ||
      '<p class="admin-empty">Aucun compte.</p>';
    $("#client-credits").innerHTML =
      '<label>Crédits attribués<input id="client-quota" type="number" min="0" value="' +
      (organization.passations_quota || 0) +
      '"></label><label>Crédits utilisés<input id="client-used" type="number" min="0" value="' +
      (organization.passations_used || 0) +
      '"></label><label>Validité<input id="client-expiry" type="date" value="' +
      (organization.pack_expires_at
        ? String(organization.pack_expires_at).slice(0, 10)
        : "") +
      '"></label><button class="button button-primary" id="save-client-credits">Enregistrer</button>';
    bind();
    if (requestedProject) {
      const ad = document.getElementById("admin-ad-" + requestedProject);
      if (ad) {
        ad.classList.add("admin-ad-highlight");
        setTimeout(
          () => ad.scrollIntoView({ behavior: "smooth", block: "center" }),
          60,
        );
      }
    }
  }
  function applyFilter() {
    const q = ($("#client-ad-search")?.value || "").toLowerCase().trim();
    $$("[data-ad-card]").forEach((c) => {
      const ok =
        filter === "all" ||
        (filter === "results"
          ? Boolean(c.dataset.hasResults === "true")
          : ["endingSoon", "startingSoon"].includes(filter)
          ? c.dataset[filter] === "true"
          : c.dataset.status === filter);
      const folderOk = activeFolder === "all" || (activeFolder === "unclassified" ? !c.dataset.folderId : c.dataset.folderId === activeFolder);
      const themeOk = activeTheme === "all" || c.dataset.theme === activeTheme;
      c.hidden = !(folderOk && themeOk && ok && (!q || c.dataset.search.includes(q)));
    });
  }
  async function mutate(id, path, options, success) {
    try {
      await StudioAPI.request("/api/projects/" + id + path, options);
      if (success) await success();
      else await load();
    } catch (e) {
      showError(e.message);
    }
  }
  async function openPublish(id) {
    const p = projects.get(String(id));
    if (!p) return;
    $("#publish-project-id").value = id;
    $("#publish-start").value = p.launch_date
      ? String(p.launch_date).slice(0, 10)
      : "";
    $("#publish-end").value = p.close_date
      ? String(p.close_date).slice(0, 10)
      : "";
    let shareUrl = p.communication_share_url || "",
      resultsUrl = p.communication_results_url || "";
    try {
      const data = await StudioAPI.request(
        "/api/projects/" + encodeURIComponent(id) + "/communication-assets",
      );
      shareUrl = data?.communication?.shareUrl || shareUrl;
      resultsUrl = data?.communication?.resultsUrl || resultsUrl;
    } catch (_error) {}
    $("#publish-share").value = shareUrl;
    $("#publish-results").value = resultsUrl;
    $("#publish-dialog").showModal();
  }
  async function publish() {
    const form = $("#publish-form");
    if (!form.reportValidity()) return;
    const id = $("#publish-project-id").value;
    try {
      await StudioAPI.request("/api/admin/projects/" + id + "/publish", {
        method: "PATCH",
        body: JSON.stringify({
          launchDate: $("#publish-start").value,
          closeDate: $("#publish-end").value,
          shareUrl: $("#publish-share").value.trim(),
          resultsUrl: $("#publish-results").value.trim(),
        }),
      });
      $("#publish-dialog").close();
      await StudioModal.alert({
        title: "Autodiagnostic publié",
        message:
          "La campagne est publiée et les liens sont disponibles dans le kit de communication.",
        confirmLabel: "Fermer",
      });
      load();
    } catch (e) {
      showError(e.message);
    }
  }
  function isoDay(v) {
    return v ? String(v).slice(0, 10) : "";
  }
  function addDays(v, n) {
    const d = new Date(v + "T12:00:00");
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  }
  function askExtensionDate(p) {
    return new Promise((resolve) => {
      document.getElementById("admin-extension-dialog")?.remove();
      const current = isoDay(p.close_date),
        minimum = current
          ? addDays(current, 1)
          : new Date().toISOString().slice(0, 10),
        suggested = current ? addDays(current, 7) : minimum,
        dialog = document.createElement("dialog");
      dialog.id = "admin-extension-dialog";
      dialog.className = "admin-dialog campaign-lifecycle-dialog";
      dialog.innerHTML =
        '<form method="dialog"><button class="admin-dialog-close" value="cancel" aria-label="Fermer">×</button><p class="eyebrow">Action Me&YouToo pour le client</p><h2>Prolonger « ' +
        esc(p.campaign_name || p.title || "cette campagne") +
        ' »</h2><p>Seule la date de clôture change. Le contenu et les liens restent identiques, et le client sera notifié.</p><label class="field"><span>Clôture actuelle</span><strong>' +
        date(p.close_date) +
        '</strong></label><label class="field"><span>Nouvelle date de clôture</span><input id="admin-new-close-date" type="date" min="' +
        minimum +
        '" value="' +
        suggested +
        '" required></label><div class="top-actions"><button class="button button-ghost" value="cancel">Annuler</button><button class="button button-primary" id="admin-confirm-extension" type="button">Prolonger et notifier</button></div></form>';
      document.body.append(dialog);
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        dialog.close();
        dialog.remove();
        resolve(value);
      };
      dialog.addEventListener("cancel", (e) => {
        e.preventDefault();
        finish("");
      });
      dialog
        .querySelectorAll('[value="cancel"]')
        .forEach((b) => (b.onclick = () => finish("")));
      dialog.querySelector("#admin-confirm-extension").onclick = () => {
        const input = dialog.querySelector("#admin-new-close-date"),
          value = input.value;
        if (!value || value < minimum) {
          input.reportValidity();
          return;
        }
        finish(value);
      };
      dialog.showModal();
    });
  }
  function askInternalName(p) {
    return new Promise((resolve) => {
      document.getElementById("admin-rename-dialog")?.remove();
      const dialog = document.createElement("dialog");
      dialog.id = "admin-rename-dialog";
      dialog.className = "admin-dialog campaign-rename-dialog";
      dialog.innerHTML =
        '<form method="dialog"><button class="admin-dialog-close" value="cancel" aria-label="Fermer">×</button><p class="eyebrow">Classement du client</p><h2>Renommer la campagne</h2><p>Ce nom sert uniquement au classement dans le Studio. Le titre affiché aux répondants reste inchangé.</p><label class="field"><span>Nom interne</span><input id="admin-internal-name" maxlength="120" minlength="2" required value="' +
        esc(p.campaign_name || p.title || "") +
        '"></label><div class="top-actions"><button class="button button-ghost" value="cancel">Annuler</button><button class="button button-primary" id="admin-confirm-rename" type="button">Enregistrer le nom</button></div></form>';
      document.body.append(dialog);
      let settled = false;
      const finish = (value) => { if (settled) return; settled = true; dialog.close(); dialog.remove(); resolve(value); };
      dialog.addEventListener("cancel", (e) => { e.preventDefault(); finish(""); });
      dialog.querySelectorAll('[value="cancel"]').forEach((button) => (button.onclick = () => finish("")));
      dialog.querySelector("#admin-confirm-rename").onclick = () => {
        const input = dialog.querySelector("#admin-internal-name"), value = input.value.replace(/\s+/g, " ").trim();
        if (value.length < 2) { input.reportValidity(); return; }
        finish(value);
      };
      dialog.showModal();
      dialog.querySelector("#admin-internal-name").select();
    });
  }
  function bindProjectActions() {
    $$('[data-move-folder]').forEach(
      (b) =>
        (b.onclick = async () => {
          const p = projects.get(String(b.dataset.moveFolder)), folderId = await askFolderValue("Classer la campagne", "", p);
          if (folderId === null) return;
          try {
            await StudioAPI.request("/api/projects/" + p.id + "/folder", { method: "PATCH", body: JSON.stringify({ folderId: folderId || null }) });
            const selectedFolder = folders.find((folder) => String(folder.id) === String(folderId));
            await StudioModal.alert({ eyebrow: "Classement enregistré", title: selectedFolder ? "Campagne ajoutée à « " + selectedFolder.name + " »" : "Campagne replacée dans « Non classées »", message: "Ce classement est propre à votre espace administrateur.", type: "success", confirmLabel: "Fermer" });
            await load();
          } catch (e) { showError(e.message); }
        }),
    );
    $$('[data-rename]').forEach(
      (b) =>
        (b.onclick = async () => {
          const p = projects.get(String(b.dataset.rename)),
            internalName = await askInternalName(p);
          if (!internalName || internalName === (p.campaign_name || p.title || "")) return;
          await mutate(p.id, "/internal-name", {
            method: "PATCH",
            body: JSON.stringify({ campaignName: internalName }),
          });
        }),
    );
    $$("[data-publish]").forEach(
      (b) => (b.onclick = () => openPublish(b.dataset.publish)),
    );
    $$("[data-extend]").forEach(
      (b) =>
        (b.onclick = async () => {
          const p = projects.get(String(b.dataset.extend)),
            closeDate = await askExtensionDate(p);
          if (closeDate)
            mutate(p.id, "/extend", {
              method: "PATCH",
              body: JSON.stringify({ closeDate }),
            });
        }),
    );
    $$("[data-unpublish]").forEach(
      (b) =>
        (b.onclick = async () => {
          const p = projects.get(String(b.dataset.unpublish)),
            ok = await StudioModal.confirm({
              eyebrow: "Action Me&YouToo pour le client",
              type: "warning",
              title:
                "Dépublier « " +
                (p.campaign_name || p.title || "cette campagne") +
                " » ?",
              message:
                "La campagne ne sera plus accessible. Son contenu, ses résultats et ses liens seront conservés. Le client sera notifié.",
              cancelLabel: "Laisser publiée",
              confirmLabel: "Dépublier et notifier",
            });
          if (ok) mutate(p.id, "/unpublish", { method: "PATCH", body: "{}" });
        }),
    );
    $$("[data-reprogram]").forEach(
      (b) =>
        (b.onclick = async () => {
          const p = projects.get(String(b.dataset.reprogram)),
            ok = await StudioModal.confirm({
              title: "Reprogrammer cet autodiagnostic ?",
              message:
                "La même campagne et les mêmes liens seront conservés. Vous pourrez modifier les nouvelles dates dans le paramétrage. Le client sera notifié de l’action réalisée par Me&YouToo.",
              confirmLabel: "Reprogrammer",
            });
          if (ok)
            mutate(
              p.id,
              "/reprogram",
              { method: "POST", body: "{}" },
              () =>
                (location.href =
                  "parametrage.html?projectId=" + p.id + "&reprogram=1"),
            );
        }),
    );
    $$("[data-clone]").forEach(
      (b) =>
        (b.onclick = async () => {
          const p = projects.get(String(b.dataset.clone)),
            ok = await StudioModal.confirm({
              title: "Cloner cet autodiagnostic ?",
              message:
                "Une nouvelle copie indépendante sera créée. Elle recevra de nouveaux liens lors de sa publication. Le client sera informé que Me&YouToo a créé ce brouillon pour lui.",
              confirmLabel: "Cloner",
            });
          if (ok)
            mutate(p.id, "/clone", { method: "POST", body: "{}" }, async () => {
              const r = await StudioAPI.request(
                "/api/projects?organizationId=" +
                  encodeURIComponent(organization.id),
              );
              const newest = (r.projects || [])
                .filter((x) => String(x.id) !== String(p.id))
                .sort(
                  (a, b) => new Date(b.created_at) - new Date(a.created_at),
                )[0];
              location.href = "composer.html?projectId=" + (newest?.id || "");
            });
        }),
    );
    $$("[data-archive]").forEach(
      (b) =>
        (b.onclick = async () => {
          const ok = await StudioModal.confirm({
            title: "Archiver cet autodiagnostic ?",
            message:
              "Il quittera la liste principale mais restera disponible dans les archives. Le client sera notifié.",
            confirmLabel: "Archiver et notifier",
          });
          if (ok)
            mutate(b.dataset.archive, "/archive", {
              method: "PATCH",
              body: "{}",
            });
        }),
    );
    $$("[data-delete-project]").forEach(
      (b) =>
        (b.onclick = async () => {
          const p = projects.get(String(b.dataset.deleteProject)),
            name = p?.campaign_name || p?.title || "cet autodiagnostic",
            ok = await StudioModal.confirm({
              eyebrow: "Administration",
              type: "danger",
              title: "Supprimer « " + name + " » ?",
              message:
                "L’autodiagnostic, ses personnalisations et ses fichiers seront définitivement supprimés pour le client. Cette action ne peut pas être annulée.",
              cancelLabel: "Conserver cet AD",
              confirmLabel: "Supprimer définitivement",
            });
          if (!ok) return;
          await mutate(p.id, "", { method: "DELETE" }, async () => {
            await StudioModal.alert({
              eyebrow: "Autodiagnostic supprimé",
              title: "La suppression est terminée",
              message: "« " + name + " » a été retiré du dossier client.",
              type: "success",
              confirmLabel: "Fermer",
            });
            await load();
          });
        }),
    );
  }
  function bind() {
    $('#admin-theme-filter')?.addEventListener('change', (event) => { activeTheme = event.target.value; applyFilter(); });
    $$('[data-admin-folder-filter]').forEach((btn) => btn.onclick = () => { activeFolder = btn.dataset.adminFolderFilter; render(); });
    $('[data-admin-folder-create]')?.addEventListener('click', async () => { const name = await askFolderValue("Nouveau dossier"); if (!name) return; await StudioAPI.request('/api/campaign-folders', { method: 'POST', body: JSON.stringify({ organizationId: organization.id, name }) }); await load(); });
    $$('[data-admin-folder-manage]').forEach((btn) => btn.onclick = async () => {
      const folder = folders.find((f) => String(f.id) === String(btn.dataset.adminFolderManage));
      if (!folder) return;
      const rename = await StudioModal.confirm({ eyebrow: 'Classement client', title: folder.name, message: 'Vous pouvez renommer ce dossier ou le supprimer. Ses campagnes ne seront jamais supprimées.', cancelLabel: 'Supprimer le dossier', confirmLabel: 'Renommer' });
      if (rename) {
        const name = await askFolderValue('Renommer le dossier', folder.name);
        if (!name || name === folder.name) return;
        await StudioAPI.request('/api/campaign-folders/' + folder.id, { method: 'PATCH', body: JSON.stringify({ organizationId: organization.id, name }) });
      } else {
        const remove = await StudioModal.confirm({ type: 'danger', title: 'Supprimer le dossier « ' + folder.name + ' » ?', message: 'Toutes ses campagnes retourneront dans « Non classées ». Aucune campagne ne sera supprimée.', cancelLabel: 'Conserver', confirmLabel: 'Supprimer le dossier' });
        if (!remove) return;
        await StudioAPI.request('/api/campaign-folders/' + folder.id + '?organizationId=' + encodeURIComponent(organization.id), { method: 'DELETE' });
        if (activeFolder === String(folder.id)) activeFolder = 'all';
      }
      await load();
    });
    $$("[data-ad-filter]").forEach(
      (btn) =>
        (btn.onclick = () => {
          filter = btn.dataset.adFilter;
          $$("[data-ad-filter]").forEach((x) =>
            x.classList.toggle("is-active", x === btn),
          );
          applyFilter();
        }),
    );
    $$('[data-watch-filter]').forEach(
      (btn) =>
        (btn.onclick = () => {
          filter = btn.dataset.watchFilter;
          $$('[data-ad-filter]').forEach((x) =>
            x.classList.toggle('is-active', x.dataset.adFilter === filter),
          );
          applyFilter();
          document.getElementById('client-ad-filters')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }),
    );
    $("#client-ad-search").oninput = applyFilter;
    $("#client-ad-sort").onchange = (event) => {
      sortMode = event.target.value;
      render();
    };
    $("#save-client-credits").onclick = saveCredits;
    bindUserActions();
    bindProjectActions();
  }
  function openUser(u = null) {
    const f = $("#user-form");
    f.reset();
    f.dataset.editId = u?.id || "";
    $("#user-org-id").value = organization.id;
    $("#user-dialog h2").textContent = u
      ? "Modifier le compte et ses droits"
      : "Ajouter un accès supplémentaire";
    $("#save-user").textContent = u
      ? "Enregistrer les droits"
      : "Créer et envoyer l’invitation";
    const level = u?.access_level || "manager";
    $("#user-access-level").value = level;
    renderPermissionFields(
      u?.permissions && Object.keys(u.permissions).length
        ? u.permissions
        : permissionPresets[level],
    );
    if (u) {
      $("#user-first").value = u.first_name || "";
      $("#user-last").value = u.last_name || "";
      $("#user-job-title").value = u.job_title || "";
      $("#user-phone").value = u.phone || "";
      $("#user-email").value = u.email || "";
    }
    $("#user-access-level").onchange = () =>
      renderPermissionFields(
        permissionPresets[$("#user-access-level").value] ||
          permissionPresets.manager,
      );
    $("#user-dialog").showModal();
  }
  function bindUserActions() {
    $$("[data-resend-client]").forEach(
      (b) =>
        (b.onclick = async () => {
          try {
            await StudioAPI.request(
              "/api/admin/users/" +
                b.dataset.resendClient +
                "/resend-invitation",
              { method: "POST", body: "{}" },
            );
            await StudioModal.alert({
              title: "Invitation renvoyée",
              message: "Un nouveau lien a été envoyé.",
              confirmLabel: "Fermer",
            });
          } catch (e) {
            showError(e.message);
          }
        }),
    );
    $$("[data-edit-client]").forEach(
      (b) =>
        (b.onclick = () => openUser(users.get(String(b.dataset.editClient)))),
    );
    $$("[data-toggle-client]").forEach(
      (b) =>
        (b.onclick = async () => {
          try {
            await StudioAPI.request(
              "/api/admin/client-users/" + b.dataset.toggleClient,
              {
                method: "PATCH",
                body: JSON.stringify({ active: b.dataset.active === "true" }),
              },
            );
            load();
          } catch (e) {
            showError(e.message);
          }
        }),
    );
    $$("[data-delete-client]").forEach(
      (b) =>
        (b.onclick = async () => {
          const u = users.get(String(b.dataset.deleteClient)),
            ok = await StudioModal.confirm({
              type: "danger",
              title: "Supprimer ce compte client ?",
              message:
                "L’accès de " +
                (u?.first_name || "") +
                " " +
                (u?.last_name || "") +
                " sera définitivement supprimé.",
              confirmLabel: "Supprimer",
            });
          if (!ok) return;
          try {
            await StudioAPI.request(
              "/api/admin/client-users/" + b.dataset.deleteClient,
              { method: "DELETE" },
            );
            load();
          } catch (e) {
            showError(e.message);
          }
        }),
    );
  }
  async function saveCredits() {
    try {
      await StudioAPI.request("/api/admin/organizations/" + organization.id, {
        method: "PATCH",
        body: JSON.stringify({
          passationsQuota: Number($("#client-quota").value) || 0,
          passationsUsed: Number($("#client-used").value) || 0,
          packExpiresAt: $("#client-expiry").value || null,
        }),
      });
      await load();
    } catch (e) {
      showError(e.message);
    }
  }
  async function saveUser() {
    const f = $("#user-form");
    if (!f.reportValidity()) return;
    const id = f.dataset.editId,
      payload = {
        organizationId: organization.id,
        firstName: $("#user-first").value.trim(),
        lastName: $("#user-last").value.trim(),
        jobTitle: $("#user-job-title").value.trim(),
        phone: $("#user-phone").value.trim(),
        email: $("#user-email").value.trim(),
        accessLevel: $("#user-access-level").value,
        permissions: selectedPermissions(),
      };
    try {
      await StudioAPI.request(
        id ? "/api/admin/client-users/" + id : "/api/admin/users",
        { method: id ? "PATCH" : "POST", body: JSON.stringify(payload) },
      );
      $("#user-dialog").close();
      load();
    } catch (e) {
      showError(e.message);
    }
  }
  async function load() {
    try {
      $("#client-alert").hidden = true;
      let data = null;
      if (requestedOrg) {
        data = await StudioAPI.request(
          "/api/admin/organizations/" +
            encodeURIComponent(requestedOrg) +
            "/dossier",
        );
      } else if (requestedProject) {
        data = await StudioAPI.request(
          "/api/admin/projects/" +
            encodeURIComponent(requestedProject) +
            "/dossier",
        );
      } else {
        showError(
          "Dossier client introuvable. Revenez au cockpit clients et ouvrez un client.",
        );
        return;
      }
      organization = data?.organization || null;
      if (!organization) {
        showError(
          "Dossier client introuvable. Revenez au cockpit clients et ouvrez un client.",
        );
        return;
      }
      const folderData = await StudioAPI.request('/api/campaign-folders?organizationId=' + encodeURIComponent(organization.id));
      folders = Array.isArray(folderData.folders) ? folderData.folders : [];
      orgProjects(organization).forEach((project) => { project.folder_id = null; });
      (folderData.assignments || []).forEach((assignment) => {
        const project = orgProjects(organization).find((item) => String(item.id) === String(assignment.project_id));
        if (project) project.folder_id = assignment.folder_id;
      });
      users = new Map(orgUsers(organization).map((u) => [String(u.id), u]));
      render();
      if (
        requestedPublish &&
        requestedProject &&
        !publishOpened &&
        normalizedStatus(projects.get(String(requestedProject)) || {}) ===
          "ready_to_publish"
      ) {
        publishOpened = true;
        openPublish(requestedProject);
      }
    } catch (e) {
      showError(e.message || "Impossible de charger le dossier client.");
    }
  }
  const refreshClient = $("#refresh-client"),
    addClientUser = $("#add-client-user"),
    userDialogEl = $("#user-dialog"),
    publishDialogEl = $("#publish-dialog");
  if (refreshClient) refreshClient.onclick = load;
  if (addClientUser) addClientUser.onclick = () => openUser();
  const closeUser = () => userDialogEl?.close();
  const closeUserBtn = $("#close-user-dialog"),
    cancelUserBtn = $("#cancel-user-dialog"),
    saveUserBtn = $("#save-user");
  if (closeUserBtn) closeUserBtn.onclick = closeUser;
  if (cancelUserBtn) cancelUserBtn.onclick = closeUser;
  if (saveUserBtn)
    saveUserBtn.onclick = (e) => {
      e.preventDefault();
      saveUser();
    };
  if (userDialogEl)
    userDialogEl.onclick = (e) => {
      if (e.target === userDialogEl) userDialogEl.close();
    };
  const closePublish = () => publishDialogEl?.close();
  const closePublishBtn = $("#close-publish-dialog"),
    cancelPublishBtn = $("#cancel-publish-dialog"),
    confirmPublishBtn = $("#confirm-publish");
  if (closePublishBtn) closePublishBtn.onclick = closePublish;
  if (cancelPublishBtn) cancelPublishBtn.onclick = closePublish;
  if (confirmPublishBtn)
    confirmPublishBtn.onclick = (e) => {
      e.preventDefault();
      publish();
    };
  if (publishDialogEl)
    publishDialogEl.onclick = (e) => {
      if (e.target === publishDialogEl) publishDialogEl.close();
    };
  load();
})();
