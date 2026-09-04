(function () {
  var cardRoot = document.getElementById("campaigns-card-root");
  var filtersRoot = document.getElementById("campaign-filters");
  var search = document.getElementById("campaignSearch");
  var sort = document.getElementById("campaignSort");
  var noResults = document.getElementById("noResults");
  if (!cardRoot || !filtersRoot) return;

  var projects = [];
  var folders = [];
  var activeFolder = "all";
  var activeFilter = "all";
  var currentUser = (window.StudioAPI.user && window.StudioAPI.user()) || {};
  function can(permission) {
    return (
      currentUser.role === "admin" ||
      Boolean(currentUser.permissions && currentUser.permissions[permission])
    );
  }
  var pageParams = new URLSearchParams(location.search),
    initialAction = pageParams.get("action"),
    initialProjectId = pageParams.get("projectId"),
    initialActionHandled = false;

  function esc(v) {
    return String(v ?? "").replace(/[&<>"']/g, function (c) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[c];
    });
  }

  function dateFr(value) {
    if (!value) return "—";
    var d = new Date(value);
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("fr-FR");
  }

  function resumePage(step) {
    return (
      {
        composer: "composer.html",
        personnalisation: "personnalisation.html",
        parametrage: "parametrage.html",
        validation: "validation.html",
      }[step] || "composer.html"
    );
  }

  function statusLabel(status) {
    return (
      {
        draft: "Brouillon",
        configuration_submitted: "Transmise à Me&YouToo",
        review_pending: "À relire par Me&YouToo",
        in_review: "En cours de relecture",
        client_validation_required: "À valider",
        ready_to_publish: "Prête à publier",
        published: "Publiée",
        scheduled: "Programmée",
        active: "Publiée",
        unpublished: "Dépubliée",
        closed: "Terminée",
        completed: "Terminée",
        archived: "Archivée",
      }[status] ||
      status ||
      "Statut inconnu"
    );
  }

  function statusVisual(status) {
    if (status === "draft") return "draft";
    if (status === "client_validation_required") return "validation";
    if (
      [
        "configuration_submitted",
        "review_pending",
        "in_review",
        "ready_to_publish",
      ].includes(status)
    )
      return "submitted";
    if (status === "scheduled") return "scheduled";
    if (status === "published" || status === "active") return "published";
    if (status === "unpublished") return "unpublished";
    if (status === "closed" || status === "completed") return "completed";
    if (status === "archived") return "archived";
    return "draft";
  }

  function themeSlug(p) {
    return String((p && p.theme_slug) || "")
      .trim()
      .toLowerCase();
  }

  function hasTheme(p) {
    return Boolean(themeSlug(p));
  }

  function themeLabel(p) {
    var raw = String(p.theme_title || p.theme_slug || "").trim();
    if (!raw) return "Thématique indisponible";
    var slug = String(p.theme_slug || raw)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-");
    var labels = {
      sexisme: "Sexisme",
      management: "Management inclusif",
      "management-inclusif": "Management inclusif",
      "manager-inclusif": "Management inclusif",
      handicap: "Handicap",
      lgbt: "LGBT+",
      "lgbt-plus": "LGBT+",
      origines: "Diversité des origines",
      "diversite-des-origines": "Diversité des origines",
      religion: "Diversité religieuse",
      "diversite-religieuse": "Diversité religieuse",
      intergenerationnel: "Intergénérationnel",
      collaborateur: "Collaborateur inclusif",
      "collaborateur-inclusif": "Collaborateur inclusif",
    };
    return labels[slug] || raw;
  }

  function query(p) {
    var slug = themeSlug(p);
    if (!slug) return null;
    return (
      "?theme=" +
      encodeURIComponent(slug) +
      "&projectId=" +
      encodeURIComponent(p.id)
    );
  }

  function contentPage(p) {
    var q = query(p);
    return q ? "composer.html" + q : null;
  }

  function campaignName(p) {
    return (
      p.campaign_name ||
      p.respondent_title ||
      p.title ||
      p.theme_title ||
      "Campagne sans nom"
    );
  }

  function campaignDates(p) {
    if (!p.launch_date && !p.close_date)
      return "Dates de campagne non renseignées";
    if (p.launch_date && p.close_date)
      return (
        "Campagne : " + dateFr(p.launch_date) + " → " + dateFr(p.close_date)
      );
    if (p.launch_date) return "Lancement : " + dateFr(p.launch_date);
    return "Clôture : " + dateFr(p.close_date);
  }

  function isoDay(value) {
    return String(value || "").slice(0, 10);
  }
  function addDays(day, count) {
    var d = new Date(day + "T12:00:00");
    d.setDate(d.getDate() + count);
    return d.toISOString().slice(0, 10);
  }
  function askExtensionDate(p) {
    return new Promise(function (resolve) {
      document.getElementById("campaign-extension-dialog")?.remove();
      var current = isoDay(p.close_date),
        minimum = current
          ? addDays(current, 1)
          : new Date().toISOString().slice(0, 10),
        suggested = current ? addDays(current, 7) : minimum;
      var dialog = document.createElement("dialog");
      dialog.id = "campaign-extension-dialog";
      dialog.className = "admin-dialog campaign-lifecycle-dialog";
      dialog.innerHTML =
        '<form method="dialog"><button class="admin-dialog-close" value="cancel" aria-label="Fermer">×</button><p class="eyebrow">Campagne publiée</p><h2>Prolonger « ' +
        esc(campaignName(p)) +
        ' »</h2><p>La campagne et ses liens restent identiques. Seule la date de clôture change.</p><label class="field"><span>Clôture actuelle</span><strong>' +
        esc(dateFr(p.close_date)) +
        '</strong></label><label class="field"><span>Nouvelle date de clôture</span><input id="campaign-new-close-date" type="date" min="' +
        esc(minimum) +
        '" value="' +
        esc(suggested) +
        '" required></label><div class="campaign-lifecycle-note"><strong>Vous n’avez rien à reconstruire.</strong><span>Le contenu, l’URL de passation et l’URL de résultats sont conservés.</span></div><div class="top-actions"><button class="button button-ghost" value="cancel">Annuler</button><button class="button button-primary" id="confirm-extension" type="button">Confirmer la prolongation</button></div></form>';
      document.body.append(dialog);
      var settled = false,
        finish = function (value) {
          if (settled) return;
          settled = true;
          dialog.close();
          dialog.remove();
          resolve(value);
        };
      dialog.addEventListener("cancel", function (e) {
        e.preventDefault();
        finish("");
      });
      dialog.addEventListener("close", function () {
        if (!settled) {
          settled = true;
          dialog.remove();
          resolve("");
        }
      });
      dialog.querySelector('[value="cancel"]').onclick = function () {
        finish("");
      };
      dialog.querySelector(".admin-dialog-close").onclick = function () {
        finish("");
      };
      dialog.querySelector("#confirm-extension").onclick = function () {
        var value = dialog.querySelector("#campaign-new-close-date").value;
        if (!value || value < minimum) {
          dialog.querySelector("#campaign-new-close-date").reportValidity();
          return;
        }
        finish(value);
      };
      dialog.showModal();
    });
  }

  function linkState(p) {
    var share = String(p.communication_share_url || "").trim();
    var results = String(p.communication_results_url || "").trim();
    return {
      share: share,
      results: results,
      shareText: share ? "disponible" : "en attente Me&YouToo",
      resultsText: can("view_results")
        ? results
          ? "disponibles"
          : "non disponibles"
        : "accès non autorisé",
    };
  }

  function invalidThemeAction() {
    return '<span class="campaign-btn campaign-btn-static" title="Le thème réel de ce projet est absent des données API.">Thématique indisponible</span>';
  }

  function primaryAction(p) {
    var q = query(p),
      id = esc(p.id);
    if (!q) return invalidThemeAction();
    if (p.status === "draft")
      return can("edit_campaigns")
        ? '<a class="campaign-btn campaign-btn-primary" href="' +
            resumePage(p.current_step) +
            q +
            '">Reprendre la création</a>'
        : '<a class="campaign-btn campaign-btn-primary" href="campagne-detail.html' +
            q +
            '">Consulter</a>';
    if (p.status === "client_validation_required")
      return (
        '<a class="campaign-btn campaign-btn-primary" href="validation.html' +
        q +
        '">Valider les corrections</a>'
      );
    if (
      [
        "configuration_submitted",
        "review_pending",
        "in_review",
        "ready_to_publish",
      ].includes(p.status)
    )
      return (
        '<a class="campaign-btn campaign-btn-primary" href="validation.html' +
        q +
        '">Suivre la relecture</a>'
      );
    if (
      (p.status === "unpublished" ||
        p.status === "closed" ||
        p.status === "completed") &&
      can("manage_schedule")
    )
      return (
        '<button class="campaign-btn campaign-btn-primary" type="button" data-project-action="reprogram" data-project-id="' +
        id +
        '">🚀 Reprogrammer</button>'
      );
    if (p.status === "archived" && can("manage_schedule"))
      return (
        '<button class="campaign-btn campaign-btn-primary" type="button" data-project-action="restore" data-project-id="' +
        id +
        '">↩️ Restaurer</button>'
      );
    return (
      '<a class="campaign-btn campaign-btn-primary" href="campagne-detail.html' +
      q +
      '">Voir la campagne</a>'
    );
  }

  function secondaryActions(p) {
    var q = query(p),
      id = esc(p.id);
    var more = [], visible = [];
    if (can("organize_folders"))
      more.push(
        '<button type="button" data-project-action="move-folder" data-project-id="' +
          id +
          '">📁 Classer</button>',
      );
    if (can("edit_campaigns"))
      more.push(
        '<button type="button" data-project-action="rename" data-project-id="' +
          id +
          '">✏️ Renommer</button>',
      );
    var content = contentPage(p);
    if (p.status !== "draft") {
      more.push(
        content
          ? '<a href="' +
              content +
              '">👁️ Voir le contenu</a>'
          : invalidThemeAction(),
      );
    }
    if (
      q &&
      can("manage_kit") &&
      [
        "configuration_submitted",
        "review_pending",
        "in_review",
        "client_validation_required",
        "ready_to_publish",
        "scheduled",
        "published",
        "active",
        "unpublished",
        "closed",
        "completed",
      ].includes(p.status)
    )
      visible.push(
        '<a class="campaign-btn campaign-btn-kit" href="kit-communication.html' +
          q +
          '">📣 Kit de com</a>',
      );
    if (
      ["scheduled", "published", "active"].includes(p.status) &&
      can("manage_schedule")
    )
      more.push(
        '<button type="button" data-project-action="extend" data-project-id="' +
          id +
          '">📅 Prolonger</button>',
      );
    if (["published", "active"].includes(p.status) && can("manage_schedule"))
      more.push(
        '<button class="danger" type="button" data-project-action="unpublish" data-project-id="' +
          id +
          '">⏹ Dépublier</button>',
      );
    if (
      !["scheduled", "published", "active"].includes(p.status) &&
      can("edit_campaigns")
    )
      more.push(
        '<button class="danger" type="button" data-project-action="delete" data-project-id="' +
          id +
          '">🗑️ Supprimer</button>',
      );
    if (
      ![
        "draft",
        "configuration_submitted",
        "review_pending",
        "in_review",
        "client_validation_required",
        "ready_to_publish",
      ].includes(p.status) &&
      can("create_campaigns")
    )
      more.push(
        '<button type="button" data-project-action="clone" data-project-id="' +
          id +
          '">🧬 Cloner</button>',
      );

    if (p.status === "unpublished" && can("manage_schedule"))
      more.push(
        '<button type="button" data-project-action="archive" data-project-id="' +
          id +
          '">📦 Archiver</button>',
      );

    var html =
      '<div class="campaign-row-actions">' + primaryAction(p) + visible.join("");
    if (more.length) {
      html +=
        '<details class="campaign-more"><summary>Autres actions</summary><div class="campaign-more-menu">' +
        more.join("") +
        "</div></details>";
    }
    html += "</div>";
    return html;
  }

  function askInternalName(p) {
    return new Promise(function (resolve) {
      document.getElementById("campaign-rename-dialog")?.remove();
      var dialog = document.createElement("dialog");
      dialog.id = "campaign-rename-dialog";
      dialog.className = "admin-dialog campaign-rename-dialog";
      dialog.innerHTML =
        '<form method="dialog"><button class="admin-dialog-close" value="cancel" aria-label="Fermer">×</button><p class="eyebrow">Classement</p><h2>Renommer la campagne</h2><p>Ce nom est uniquement utilisé dans le Studio. Le titre affiché aux répondants ne sera pas modifié.</p><label class="field"><span>Nom interne</span><input id="campaign-internal-name" maxlength="120" minlength="2" required value="' +
        esc(campaignName(p)) +
        '"></label><div class="top-actions"><button class="button button-ghost" value="cancel">Annuler</button><button class="button button-primary" id="confirm-campaign-rename" type="button">Enregistrer le nom</button></div></form>';
      document.body.append(dialog);
      var settled = false;
      function finish(value) {
        if (settled) return;
        settled = true;
        dialog.close();
        dialog.remove();
        resolve(value);
      }
      dialog.addEventListener("cancel", function (e) { e.preventDefault(); finish(""); });
      dialog.querySelectorAll('[value="cancel"]').forEach(function (button) { button.onclick = function () { finish(""); }; });
      dialog.querySelector("#confirm-campaign-rename").onclick = function () {
        var input = dialog.querySelector("#campaign-internal-name"), value = input.value.replace(/\s+/g, " ").trim();
        if (value.length < 2) { input.reportValidity(); return; }
        finish(value);
      };
      dialog.showModal();
      dialog.querySelector("#campaign-internal-name").select();
    });
  }

  function folderById(id) {
    return folders.find(function (folder) { return String(folder.id) === String(id); });
  }

  function askFolderName(title, value) {
    return new Promise(function (resolve) {
      document.getElementById("campaign-folder-dialog")?.remove();
      var dialog = document.createElement("dialog");
      dialog.id = "campaign-folder-dialog";
      dialog.className = "admin-dialog campaign-rename-dialog";
      dialog.innerHTML = '<form method="dialog"><button class="admin-dialog-close" value="cancel" aria-label="Fermer">×</button><p class="eyebrow">Classement</p><h2>' + esc(title) + '</h2><p>Créez un classement simple adapté à votre organisation : année, équipe, thématique ou projet.</p><label class="field"><span>Nom du dossier</span><input id="campaign-folder-name" maxlength="80" minlength="2" required value="' + esc(value || "") + '"></label><div class="top-actions"><button class="button button-ghost" value="cancel">Annuler</button><button class="button button-primary" id="confirm-folder-name" type="button">Enregistrer</button></div></form>';
      document.body.append(dialog);
      var done = false;
      function finish(result) { if (done) return; done = true; dialog.close(); dialog.remove(); resolve(result); }
      dialog.querySelectorAll('[value="cancel"]').forEach(function (b) { b.onclick = function () { finish(""); }; });
      dialog.addEventListener("cancel", function (e) { e.preventDefault(); finish(""); });
      dialog.querySelector("#confirm-folder-name").onclick = function () {
        var input = dialog.querySelector("#campaign-folder-name"), result = input.value.replace(/\s+/g, " ").trim();
        if (result.length < 2) { input.reportValidity(); return; }
        finish(result);
      };
      dialog.showModal(); dialog.querySelector("#campaign-folder-name").focus();
    });
  }

  function askMoveFolder(p) {
    return new Promise(function (resolve) {
      document.getElementById("campaign-move-folder-dialog")?.remove();
      var dialog = document.createElement("dialog");
      dialog.id = "campaign-move-folder-dialog";
      dialog.className = "admin-dialog campaign-rename-dialog";
      dialog.innerHTML = '<form method="dialog"><button class="admin-dialog-close" value="cancel" aria-label="Fermer">×</button><p class="eyebrow">Classement</p><h2>Classer la campagne</h2><p>« ' + esc(campaignName(p)) + ' »</p><label class="field"><span>Dossier</span><select id="campaign-folder-select"><option value="">Non classées</option>' + folders.map(function (f) { return '<option value="' + esc(f.id) + '" ' + (String(p.folder_id || "") === String(f.id) ? "selected" : "") + '>' + esc(f.name) + '</option>'; }).join("") + '</select></label><div class="top-actions"><button class="button button-ghost" value="cancel">Annuler</button><button class="button button-primary" id="confirm-folder-move" type="button">Classer</button></div></form>';
      document.body.append(dialog);
      var done = false;
      function finish(result) { if (done) return; done = true; dialog.close(); dialog.remove(); resolve(result); }
      dialog.querySelectorAll('[value="cancel"]').forEach(function (b) { b.onclick = function () { finish(null); }; });
      dialog.addEventListener("cancel", function (e) { e.preventDefault(); finish(null); });
      dialog.querySelector("#confirm-folder-move").onclick = function () { finish(dialog.querySelector("#campaign-folder-select").value); };
      dialog.showModal();
    });
  }

  function renderFolderBar() {
    var root = document.getElementById("campaign-folder-bar");
    if (!root) return;
    function chip(key, label, count) { return '<button type="button" class="campaign-folder-chip ' + (activeFolder === key ? "is-active" : "") + '" data-folder-filter="' + esc(key) + '"><span>' + label + '</span><strong>' + count + '</strong></button>'; }
    var unclassified = projects.filter(function (p) { return !p.folder_id; }).length;
    root.innerHTML = '<div class="campaign-folder-heading"><div><strong>Dossiers</strong><span>Retrouvez rapidement vos campagnes</span></div>' + (can("organize_folders") ? '<button class="campaign-folder-create" type="button" data-folder-create>+ Nouveau dossier</button>' : "") + '</div><div class="campaign-folder-list">' + chip("all", "🗂️ Toutes", projects.length) + chip("unclassified", "📄 Non classées", unclassified) + folders.map(function (f) { return '<span class="campaign-folder-group">' + chip(String(f.id), "📁 " + esc(f.name), projects.filter(function (p) { return String(p.folder_id || "") === String(f.id); }).length) + (can("organize_folders") ? '<button type="button" class="campaign-folder-manage" data-folder-manage="' + esc(f.id) + '" aria-label="Gérer le dossier ' + esc(f.name) + '">•••</button>' : "") + '</span>'; }).join("") + '</div>';
    root.querySelectorAll("[data-folder-filter]").forEach(function (b) { b.onclick = function () { activeFolder = b.dataset.folderFilter; renderFolderBar(); renderCards(); }; });
    root.querySelector("[data-folder-create]")?.addEventListener("click", async function () { var name = await askFolderName("Nouveau dossier", ""); if (!name) return; await StudioAPI.request("/api/campaign-folders", { method: "POST", body: JSON.stringify({ name: name }) }); await load(); });
    root.querySelectorAll("[data-folder-manage]").forEach(function (b) { b.onclick = async function () { var folder = folderById(b.dataset.folderManage); if (!folder) return; var rename = await StudioModal.confirm({ eyebrow: "Dossier", title: folder.name, message: "Renommez ce dossier, ou supprimez-le pour replacer ses campagnes dans « Non classées ».", cancelLabel: "Supprimer le dossier", confirmLabel: "Renommer" }); if (rename) { var name = await askFolderName("Renommer le dossier", folder.name); if (!name || name === folder.name) return; await StudioAPI.request("/api/campaign-folders/" + folder.id, { method: "PATCH", body: JSON.stringify({ name: name }) }); } else { var remove = await StudioModal.confirm({ type: "danger", title: "Supprimer le dossier « " + folder.name + " » ?", message: "Les campagnes ne seront pas supprimées. Elles retourneront dans « Non classées ».", cancelLabel: "Conserver", confirmLabel: "Supprimer le dossier" }); if (!remove) return; await StudioAPI.request("/api/campaign-folders/" + folder.id, { method: "DELETE" }); if (activeFolder === String(folder.id)) activeFolder = "all"; } await load(); }; });
  }

  function extraBadges(p) {
    var parts = [];
    if (p.reprogrammed_at || p.reprogrammedAt)
      parts.push(
        '<span class="campaign-context-tag reprogrammed">Reprogrammée</span>',
      );
    if (p.extended_at || p.extendedAt)
      parts.push(
        '<span class="campaign-context-tag extended">Prolongée</span>',
      );
    return parts.join("");
  }

  function cardHtml(p) {
    var visual = statusVisual(p.status);
    var links = linkState(p);
    var themeWarning = hasTheme(p)
      ? ""
      : '<div class="composer-alert" style="margin:12px 0 0">Le thème réel de cette campagne est absent des données API. Aucun thème de remplacement n’est utilisé.</div>';
    return (
      '<article class="campaign-project-card ' +
      visual +
      '-card">' +
      '<div class="campaign-status-bar ' +
      visual +
      '"></div>' +
      '<div class="campaign-project-body">' +
      '<div class="campaign-project-title">🧩 ' +
      esc(campaignName(p)) +
      "</div>" +
      '<div class="campaign-project-meta">' +
      "Créée le " +
      dateFr(p.created_at) +
      " · " +
      esc(campaignDates(p)) +
      "<br>" +
      "Lien de diffusion : " +
      esc(links.shareText) +
      " · Résultats : " +
      esc(links.resultsText) +
      "</div>" +
      '<div class="campaign-tag-row">' +
      '<span class="campaign-topic-tag">' +
      esc(themeLabel(p)) +
      "</span>" +
      '<span class="campaign-status-tag ' +
      visual +
      '">' +
      esc(statusLabel(p.status)) +
      "</span>" +
      (folderById(p.folder_id) ? '<span class="campaign-folder-tag">📁 ' + esc(folderById(p.folder_id).name) + '</span>' : "") +
      extraBadges(p) +
      "</div>" +
      themeWarning +
      (["unpublished", "closed", "completed", "archived"].includes(p.status)
        ? '<div class="campaign-reprogram-hint"><strong>Relancer ce même autodiagnostic</strong><span>Utilisez « Reprogrammer » pour conserver le contenu et les mêmes liens. Il n’est pas nécessaire de reconstruire une campagne sur ce thème.</span></div>'
        : "") +
      secondaryActions(p) +
      "</div>" +
      "</article>"
    );
  }

  async function projectAction(action, id) {
    var p = projects.find(function (x) {
      return String(x.id) === String(id);
    });
    if (!p) return;
    if (action === "rename") {
      var internalName = await askInternalName(p);
      if (!internalName || internalName === campaignName(p)) return;
      await StudioAPI.request("/api/projects/" + id + "/internal-name", {
        method: "PATCH",
        body: JSON.stringify({ campaignName: internalName }),
      });
      return load();
    }
    if (action === "move-folder") {
      var folderId = await askMoveFolder(p);
      if (folderId === null) return;
      await StudioAPI.request("/api/projects/" + id + "/folder", {
        method: "PATCH",
        body: JSON.stringify({ folderId: folderId || null }),
      });
      var selectedFolder = folderById(folderId);
      await StudioModal.alert({
        eyebrow: "Classement enregistré",
        title: selectedFolder ? "Campagne ajoutée à « " + selectedFolder.name + " »" : "Campagne replacée dans « Non classées »",
        message: "Ce classement est personnel et n’affecte pas celui des autres utilisateurs.",
        type: "success",
        confirmLabel: "Fermer",
      });
      return load();
    }
    if (action === "delete") {
      var ok = await StudioModal.confirm({
        eyebrow: "Faire du tri",
        type: "danger",
        title: "Supprimer « " + campaignName(p) + " » ?",
        message:
          "Cet autodiagnostic, son contenu personnalisé et ses fichiers seront définitivement supprimés. Cette action ne peut pas être annulée.",
        cancelLabel: "Conserver cet AD",
        confirmLabel: "Supprimer définitivement",
      });
      if (!ok) return;
      await StudioAPI.request("/api/projects/" + id, { method: "DELETE" });
      await StudioModal.alert({
        eyebrow: "Autodiagnostic supprimé",
        title: "La suppression est terminée",
        message: "« " + campaignName(p) + " » a été retiré de votre espace.",
        type: "success",
        confirmLabel: "Fermer",
      });
      return load();
    }
    if (action === "archive") {
      var ok2 = await StudioModal.confirm({
        title: "Archiver cet autodiagnostic ?",
        message: "Il sera déplacé dans vos archives et restera reprogrammable.",
        confirmLabel: "Archiver",
      });
      if (!ok2) return;
      await StudioAPI.request("/api/projects/" + id + "/archive", {
        method: "PATCH",
        body: "{}",
      });
      return load();
    }
    if (action === "extend") {
      var closeDate = await askExtensionDate(p);
      if (!closeDate) return;
      await StudioAPI.request("/api/projects/" + id + "/extend", {
        method: "PATCH",
        body: JSON.stringify({ closeDate: closeDate }),
      });
      await StudioModal.alert({
        eyebrow: "Campagne prolongée",
        title: "La nouvelle date est enregistrée",
        message: "La campagne, son contenu et ses liens restent inchangés.",
        type: "success",
        confirmLabel: "Fermer",
      });
      return load();
    }
    if (action === "unpublish") {
      var okUnpublish = await StudioModal.confirm({
        eyebrow: "Campagne publiée",
        type: "warning",
        title: "Dépublier « " + campaignName(p) + " » ?",
        message:
          "La campagne ne sera plus accessible aux répondants. Son contenu, ses résultats et ses liens seront conservés. Vous pourrez ensuite l’archiver ou la reprogrammer.",
        cancelLabel: "Laisser publiée",
        confirmLabel: "Dépublier la campagne",
      });
      if (!okUnpublish) return;
      await StudioAPI.request("/api/projects/" + id + "/unpublish", {
        method: "PATCH",
        body: "{}",
      });
      await StudioModal.alert({
        eyebrow: "Campagne dépubliée",
        title: "La campagne n’est plus accessible",
        message:
          "Vous pouvez maintenant l’archiver ou la reprogrammer avec les mêmes liens.",
        type: "success",
        confirmLabel: "Fermer",
      });
      return load();
    }
    if (action === "restore") {
      var okRestore = await StudioModal.confirm({
        title: "Restaurer cette campagne ?",
        message: "Elle reviendra dans vos campagnes dépubliées.",
        confirmLabel: "Restaurer",
      });
      if (!okRestore) return;
      await StudioAPI.request("/api/projects/" + id + "/restore", {
        method: "PATCH",
        body: "{}",
      });
      return load();
    }
    if (action === "reprogram") {
      var q = query(p);
      if (!q)
        throw new Error(
          "Le thème réel de cette campagne est absent. Reprogrammation impossible sans corriger les données du projet.",
        );
      var ok3 = await StudioModal.confirm({
        eyebrow: "Réutiliser une campagne existante",
        title: "Reprogrammer cet autodiagnostic ?",
        message:
          "Vous n’avez pas besoin de reconstruire une campagne sur le même thème. Le contenu, l’URL de passation et l’URL de résultats seront conservés ; vous choisirez seulement de nouvelles dates.",
        confirmLabel: "Reprogrammer avec les mêmes liens",
      });
      if (!ok3) return;
      await StudioAPI.request("/api/projects/" + id + "/reprogram", {
        method: "POST",
        body: "{}",
      });
      location.href = "parametrage.html" + q + "&reprogram=1";
      return;
    }
    if (action === "clone") {
      if (!hasTheme(p))
        throw new Error(
          "Le thème réel de cette campagne est absent. Clonage impossible sans corriger les données du projet.",
        );
      var ok4 = await StudioModal.confirm({
        title: "Cloner cet autodiagnostic ?",
        message:
          "Une copie indépendante sera créée et recevra de nouveaux liens après publication.",
        confirmLabel: "Cloner",
      });
      if (!ok4) return;
      var r = await StudioAPI.request("/api/projects/" + id + "/clone", {
        method: "POST",
        body: "{}",
      });
      location.href =
        "composer.html?theme=" +
        encodeURIComponent(themeSlug(p)) +
        "&projectId=" +
        encodeURIComponent(r.project.id);
    }
  }

  function bindProjectActions() {
    document.querySelectorAll("[data-project-action]").forEach(function (b) {
      b.onclick = function (e) {
        e.preventDefault();
        e.stopPropagation();
        projectAction(b.dataset.projectAction, b.dataset.projectId).catch(
          function (err) {
            StudioModal.alert({
              title: "Action impossible",
              message: err.message || "Une erreur est survenue.",
              confirmLabel: "Fermer",
            });
          },
        );
      };
    });
  }

  function renderAlerts() {
    var submitted = projects.filter(function (p) {
      return [
        "configuration_submitted",
        "review_pending",
        "in_review",
        "client_validation_required",
        "ready_to_publish",
      ].includes(p.status);
    });
    var results = can("view_results")
      ? projects.filter(function (p) {
          return Boolean(String(p.communication_results_url || "").trim());
        })
      : [];
    var now = new Date();
    var soonLimit = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    var startingSoon = projects.filter(function (p) {
      if (p.status !== "scheduled" || !p.launch_date) return false;
      var d = new Date(p.launch_date);
      return !Number.isNaN(d.getTime()) && d >= now && d <= soonLimit;
    });
    var endingSoon = projects.filter(function (p) {
      if (!["scheduled", "published", "active"].includes(p.status)) return false;
      if (!p.close_date) return false;
      var d = new Date(p.close_date);
      return !Number.isNaN(d.getTime()) && d >= now && d <= soonLimit;
    });

    document.getElementById("submitted-count").textContent =
      submitted.length +
      " configuration" +
      (submitted.length > 1 ? "s" : "") +
      " transmise" +
      (submitted.length > 1 ? "s" : "");
    document.getElementById("starting-soon-count").textContent =
      startingSoon.length +
      " campagne" +
      (startingSoon.length > 1 ? "s" : "") +
      " commence" +
      (startingSoon.length > 1 ? "nt" : "") +
      " bientôt";
    document.getElementById("starting-soon-text").textContent = startingSoon.length
      ? "Cliquez pour afficher les campagnes et préparer leur plan de communication."
      : "Aucun lancement prévu dans les 14 prochains jours.";
    document.getElementById("results-count").textContent =
      results.length +
      " campagne" +
      (results.length > 1 ? "s" : "") +
      " avec résultats";
    document.getElementById("ending-soon-count").textContent =
      endingSoon.length +
      " campagne" +
      (endingSoon.length > 1 ? "s" : "") +
      " se termine" +
      (endingSoon.length > 1 ? "nt" : "") +
      " bientôt";
    document.getElementById("ending-soon-text").textContent = endingSoon.length
      ? "Cliquez pour afficher les campagnes concernées et préparer une dernière relance."
      : "Aucune clôture prévue dans les 14 prochains jours.";
  }

  function statusKey(p) {
    return p.status || "unknown";
  }

  function filterLabel(key) {
    if (key === "all") return "Toutes";
    if (key === "results") return "Résultats";
    if (key === "startingSoon") return "Début proche";
    if (key === "endingSoon") return "Fin proche";
    if (key === "validation") return "À valider";
    if (key === "review") return "En relecture";
    return statusLabel(key);
  }

  function countForFilter(key) {
    if (key === "all") return projects.length;
    if (key === "results")
      return can("view_results")
        ? projects.filter(function (p) {
            return Boolean(String(p.communication_results_url || "").trim());
          }).length
        : 0;
    if (key === "validation")
      return projects.filter(function (p) {
        return p.status === "client_validation_required";
      }).length;
    if (key === "review")
      return projects.filter(function (p) {
        return [
          "configuration_submitted",
          "review_pending",
          "in_review",
          "ready_to_publish",
        ].includes(p.status);
      }).length;
    if (key === "startingSoon") {
      var nowStart = new Date(),
        startLimit = new Date(nowStart.getTime() + 14 * 24 * 60 * 60 * 1000);
      return projects.filter(function (p) {
        var d = new Date(p.launch_date);
        return p.status === "scheduled" && p.launch_date && !Number.isNaN(d.getTime()) && d >= nowStart && d <= startLimit;
      }).length;
    }
    if (key === "endingSoon") {
      var now = new Date(),
        limit = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
      return projects.filter(function (p) {
        var d = new Date(p.close_date);
        return (
          ["scheduled", "published", "active"].includes(p.status) &&
          p.close_date &&
          !Number.isNaN(d.getTime()) &&
          d >= now &&
          d <= limit
        );
      }).length;
    }
    return projects.filter(function (p) {
      return statusKey(p) === key;
    }).length;
  }

  function buildFilters() {
    var order = [
      "all",
      "startingSoon",
      "endingSoon",
      "validation",
      "review",
      "results",
      "draft",
      "scheduled",
      "published",
      "unpublished",
      "archived",
    ];
    filtersRoot.innerHTML = order
      .filter(function (key) {
        return key === "all" || countForFilter(key) > 0;
      })
      .map(function (key) {
        return (
          '<button class="campaign-filter-tab' +
          (activeFilter === key ? " active" : "") +
          '" type="button" data-filter="' +
          esc(key) +
          '">' +
          esc(filterLabel(key)) +
          " <span>" +
          countForFilter(key) +
          "</span></button>"
        );
      })
      .join("");
    filtersRoot.querySelectorAll("[data-filter]").forEach(function (button) {
      button.addEventListener("click", function () {
        activeFilter = button.getAttribute("data-filter");
        buildFilters();
        renderCards();
      });
    });
  }

  function matchesFilter(p) {
    if (activeFilter === "all") return true;
    if (activeFilter === "results")
      return can("view_results") && Boolean(String(p.communication_results_url || "").trim());
    if (activeFilter === "validation")
      return p.status === "client_validation_required";
    if (activeFilter === "review")
      return [
        "configuration_submitted",
        "review_pending",
        "in_review",
        "ready_to_publish",
      ].includes(p.status);
    if (activeFilter === "startingSoon") {
      if (p.status !== "scheduled" || !p.launch_date) return false;
      var nowStart = new Date(),
        startLimit = new Date(nowStart.getTime() + 14 * 24 * 60 * 60 * 1000),
        startDate = new Date(p.launch_date);
      return !Number.isNaN(startDate.getTime()) && startDate >= nowStart && startDate <= startLimit;
    }
    if (activeFilter === "endingSoon") {
      if (!["scheduled", "published", "active"].includes(p.status) || !p.close_date)
        return false;
      var now = new Date(),
        limit = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
        d = new Date(p.close_date);
      return !Number.isNaN(d.getTime()) && d >= now && d <= limit;
    }
    return statusKey(p) === activeFilter;
  }

  function renderCards() {
    var term = (search && search.value ? search.value : "")
      .trim()
      .toLowerCase();
    var filtered = projects.filter(function (p) {
      var haystack = [campaignName(p), themeLabel(p), statusLabel(p.status)]
        .join(" ")
        .toLowerCase();
      var inFolder = activeFolder === "all" || (activeFolder === "unclassified" ? !p.folder_id : String(p.folder_id || "") === activeFolder);
      return inFolder && matchesFilter(p) && (!term || haystack.indexOf(term) !== -1);
    });
    var mode = (sort && sort.value) || "updated-desc";
    filtered.sort(function (a, b) {
      if (mode === "name-asc") return campaignName(a).localeCompare(campaignName(b), "fr", { sensitivity: "base" });
      if (mode === "launch-asc") return String(a.launch_date || "9999-12-31").localeCompare(String(b.launch_date || "9999-12-31"));
      if (mode === "close-asc") return String(a.close_date || "9999-12-31").localeCompare(String(b.close_date || "9999-12-31"));
      return new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0);
    });
    cardRoot.innerHTML = filtered.map(cardHtml).join("");
    noResults.hidden = filtered.length !== 0;
    bindProjectActions();
  }

  function bindQuickFilters() {
    document.querySelectorAll("[data-quick-filter]").forEach(function (button) {
      button.addEventListener("click", function () {
        activeFilter = button.getAttribute("data-quick-filter");
        buildFilters();
        renderCards();
        document
          .querySelector(".campaign-browser")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  async function enrichCommunication(project) {
    if (!project || !project.id) return project;
    try {
      var data = await window.StudioAPI.request(
        "/api/projects/" +
          encodeURIComponent(project.id) +
          "/communication-assets",
      );
      var communication = (data && data.communication) || {};
      project.communication_share_url =
        communication.shareUrl || project.communication_share_url || "";
      project.communication_results_url =
        communication.resultsUrl || project.communication_results_url || "";
      project.communication_video_url =
        communication.videoDownloadUrl || project.communication_video_url || "";
    } catch (e) {}
    return project;
  }

  async function load() {
    try {
      var me = await window.StudioAPI.request("/api/me");
      currentUser = me.user || currentUser;
      localStorage.setItem("studio_user", JSON.stringify(currentUser));
      var newCampaign = document.querySelector(
        'a[href="bibliotheque.html"].button-primary',
      );
      if (newCampaign) newCampaign.hidden = !can("create_campaigns");
      var resultsCard = document.querySelector('[data-quick-filter="results"]');
      if (resultsCard) resultsCard.hidden = !can("view_results");
      var data = await window.StudioAPI.request(
        "/api/projects?organizationId=" +
          encodeURIComponent(window.StudioAPI.organizationId()),
      );
      projects = Array.isArray(data.projects) ? data.projects : [];
      var folderData = await window.StudioAPI.request(
        "/api/campaign-folders?organizationId=" +
          encodeURIComponent(window.StudioAPI.organizationId()),
      );
      folders = Array.isArray(folderData.folders) ? folderData.folders : [];
      projects.forEach(function (project) { project.folder_id = null; });
      (folderData.assignments || []).forEach(function (assignment) {
        var project = projects.find(function (item) { return String(item.id) === String(assignment.project_id); });
        if (project) project.folder_id = assignment.folder_id;
      });
      await Promise.all(projects.map(enrichCommunication));
      renderAlerts();
      renderFolderBar();
      buildFilters();
      renderCards();
      if (!initialActionHandled && initialAction && initialProjectId) {
        initialActionHandled = true;
        projectAction(initialAction, initialProjectId).catch(function (err) {
          StudioModal.alert({
            title: "Action impossible",
            message: err.message || "Une erreur est survenue.",
            confirmLabel: "Fermer",
          });
        });
      }
    } catch (e) {
      cardRoot.innerHTML =
        '<div class="composer-alert">Impossible de charger les campagnes : ' +
        esc(e.message) +
        "</div>";
    }
  }

  if (search) search.addEventListener("input", renderCards);
  if (sort) sort.addEventListener("change", renderCards);
  bindQuickFilters();
  load();
})();
