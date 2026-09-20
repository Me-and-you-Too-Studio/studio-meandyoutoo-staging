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
    catalogThemes = [],
    folders = [],
    activeFolder = "all",
    activeTheme = "all",
    filter = "all",
    sortMode = "updated-desc",
    publishOpened = false,
    resourceDocuments = [],
    resourceLinks = [],
    selectedExistingUser = null,
    existingSearchTimer = null;
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
  const campaignLocaleNames = {
    fr:"Français", nl:"Néerlandais", "nl-be":"Néerlandais Belgique", en:"Anglais",
    de:"Allemand", es:"Espagnol", it:"Italien", pt:"Portugais", br:"Portugais Brésil",
    bg:"Bulgare", ja:"Japonais", "ko-kr":"Coréen", pl:"Polonais", ro:"Roumain",
    ru:"Russe", "sv-se":"Suédois", tr:"Turc", zf:"Chinois simplifié", zh:"Chinois traditionnel",
    cs:"Tchèque", sk:"Slovaque", id:"Indonésien", ar:"Arabe"
  };
  function campaignLocales(p){
    return [...new Set((Array.isArray(p?.locales)?p.locales:[])
      .concat(p?.selected_locale?[p.selected_locale]:[])
      .map(v=>String(v||"").trim().toLowerCase().replaceAll("_","-")).filter(Boolean))];
  }
  function campaignLocalesHtml(p){
    const locales=campaignLocales(p);
    if(!locales.length)return "";
    return '<div class="admin-ad-meta">Langues : <strong>' +
      locales.map(loc=>esc((campaignLocaleNames[loc]||loc.toUpperCase())+' ('+loc.toUpperCase()+')')).join(' · ') +
      '</strong></div>';
  }

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
  function showMediaMessage(message, tone = "success") {
    const box = $("#client-media-alert");
    if (!box) return;
    box.hidden = false;
    box.dataset.tone = tone;
    box.textContent = message;
  }
  function formatBytes(value) {
    const n = Number(value) || 0;
    if (n < 1024) return n + " o";
    if (n < 1024 * 1024) return (n / 1024).toFixed(1).replace(".0", "") + " Ko";
    return (n / (1024 * 1024)).toFixed(1).replace(".0", "") + " Mo";
  }
  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Lecture du PDF impossible"));
      reader.onload = () => resolve(String(reader.result || "").split(",").pop() || "");
      reader.readAsDataURL(file);
    });
  }
  async function loadMediaLibrary() {
    if (!organization?.id) { resourceDocuments = []; resourceLinks = []; return; }
    try {
      const data = await StudioAPI.request(
        "/api/admin/organizations/" + encodeURIComponent(organization.id) + "/resource-library",
      );
      resourceDocuments = Array.isArray(data?.documents) ? data.documents : [];
      resourceLinks = Array.isArray(data?.links) ? data.links : [];
    } catch (error) {
      resourceDocuments = [];
      resourceLinks = [];
      showMediaMessage(error.message || "Impossible de charger la médiathèque du client.", "danger");
    }
  }
  async function downloadMediaDocument(documentId, filename) {
    const url = StudioAPI.base() + "/api/admin/organizations/" + encodeURIComponent(organization.id) + "/resource-library/" + encodeURIComponent(documentId) + "/download";
    const response = await fetch(url, { headers: { Authorization: "Bearer " + StudioAPI.token() } });
    if (!response.ok) {
      let message = "Téléchargement impossible";
      try { const body = await response.json(); message = body.error || message; } catch (_) {}
      throw new Error(message);
    }
    const blob = await response.blob();
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = filename || "document.pdf";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  }
  function campaignMediaLabel(project) {
    const title = project?.campaign_name || project?.title || project?.theme_title || ("Campagne " + project?.id);
    const surveyId = project?.legacy_survey_id;
    const slug = String(project?.legacy_slug || "").trim();
    if (surveyId) return title + " — Survey #" + surveyId + (slug ? " · " + slug : "");
    return title;
  }
  function openMediaAssociation(documentItem) {
    const campaigns = orgProjects(organization).filter((project) => project.status !== "archived");
    if (!campaigns.length) {
      showMediaMessage("Aucune campagne disponible pour ce client.", "warning");
      return;
    }
    const dialog = document.createElement("dialog");
    dialog.className = "admin-dialog admin-media-association-dialog";
    const defaultTitle = String(documentItem.title || documentItem.filename || "").replace(/\.pdf$/i, "");
    dialog.innerHTML = '<form method="dialog"><button class="admin-dialog-close" value="cancel" aria-label="Fermer">×</button><p class="eyebrow">Médiathèque client</p><h2>Associer ce PDF à une campagne</h2><p><strong>' + esc(documentItem.title || documentItem.filename) + '</strong></p><label class="field"><span>Campagne</span><select id="media-association-project">' + campaigns.map((project) => '<option value="' + esc(project.id) + '">' + esc(campaignMediaLabel(project)) + '</option>').join("") + '</select></label><label class="field"><span>Texte affiché aux répondants</span><input id="media-association-title" maxlength="160" required value="' + esc(defaultTitle) + '"></label><p class="hint">Ce texte apparaîtra dans « Approfondissez vos connaissances » à la fin de l’autodiagnostic.</p><div class="top-actions"><button class="button button-ghost" value="cancel">Annuler</button><button class="button button-primary" type="button" id="media-association-confirm">Associer à la campagne</button></div></form>';
    document.body.appendChild(dialog);
    dialog.addEventListener("close", () => dialog.remove(), { once: true });
    dialog.querySelector("#media-association-confirm").onclick = async () => {
      const projectId = dialog.querySelector("#media-association-project").value;
      const title = dialog.querySelector("#media-association-title").value.trim();
      if (!projectId || !title) return;
      const button = dialog.querySelector("#media-association-confirm");
      button.disabled = true;
      try {
        await StudioAPI.request("/api/admin/projects/" + encodeURIComponent(projectId) + "/result-resources/document", {
          method: "POST",
          body: JSON.stringify({ title, documentId: documentItem.id }),
        });
        dialog.close();
        await loadMediaLibrary();
        renderMediaLibrary();
        showMediaMessage("PDF associé à la campagne. Il apparaîtra dans les ressources proposées après les résultats.");
      } catch (error) {
        button.disabled = false;
        showMediaMessage(error.message || "Association impossible.", "danger");
      }
    };
    dialog.showModal();
  }
  async function updateMediaAssociationTitles(documentItem, inputs) {
    const grouped = new Map();
    inputs.forEach((input) => {
      const projectId = String(input.dataset.mediaEditProject || "");
      const title = input.value.trim();
      if (!projectId || !title) return;
      if (!grouped.has(projectId)) grouped.set(projectId, []);
      grouped.get(projectId).push({ index: Number(input.dataset.mediaEditResourceIndex), title });
    });
    for (const [projectId, changes] of grouped.entries()) {
      const data = await StudioAPI.request("/api/admin/projects/" + encodeURIComponent(projectId) + "/result-resources");
      const resources = Array.isArray(data?.resources) ? data.resources : [];
      let changed = false;
      resources.forEach((item, index) => {
        if (String(item?.documentId ?? item?.document_id ?? "") !== String(documentItem.id)) return;
        const match = changes.find((change) => change.index === index) || changes.shift();
        if (match && match.title && match.title !== item.title) {
          item.title = match.title;
          changed = true;
        }
      });
      if (changed) {
        await StudioAPI.request("/api/admin/projects/" + encodeURIComponent(projectId) + "/result-resources", {
          method: "PATCH",
          body: JSON.stringify({ resultButtons: resources }),
        });
      }
    }
  }
  function openMediaEdit(documentItem) {
    const dialog = document.createElement("dialog");
    dialog.className = "admin-dialog admin-media-association-dialog";
    const associations = Array.isArray(documentItem.associations) ? documentItem.associations : [];
    const associationFields = associations.length
      ? '<div class="admin-media-edit-associations"><h3>Texte affiché dans les campagnes</h3><p class="hint">Vous pouvez corriger ici le texte visible par les répondants pour chaque campagne utilisant ce PDF.</p>' + associations.map((association) => { const legacySuffix = association.legacySurveyId ? ' — Survey #' + association.legacySurveyId + (association.legacySlug ? ' · ' + association.legacySlug : '') : ''; return '<label class="field"><span>' + esc((association.campaignName || ("Campagne " + association.projectId)) + legacySuffix) + '</span><input maxlength="160" required data-media-edit-project="' + esc(association.projectId) + '" data-media-edit-resource-index="' + esc(association.resourceIndex) + '" value="' + esc(association.title || "") + '"></label>'; }).join("") + '</div>'
      : '<p class="hint">Ce PDF n’est associé à aucune campagne pour le moment.</p>';
    dialog.innerHTML = '<form method="dialog"><button class="admin-dialog-close" value="cancel" aria-label="Fermer">×</button><p class="eyebrow">Médiathèque client</p><h2>Modifier le document</h2><label class="field"><span>Nom du document</span><input id="media-edit-title" maxlength="160" value="' + esc(documentItem.title || "") + '" placeholder="Nom interne du document"></label><div class="field"><span>Fichier actuel</span><strong>' + esc(documentItem.filename || "document.pdf") + '</strong></div><label class="field"><span>Remplacer le PDF <small>(facultatif)</small></span><input id="media-edit-file" type="file" accept="application/pdf,.pdf"><small>Laissez vide pour conserver le fichier actuel.</small></label>' + associationFields + '<p class="composer-alert" id="media-edit-error" data-tone="danger" hidden></p><div class="top-actions"><button class="button button-ghost" value="cancel">Annuler</button><button class="button button-primary" type="button" id="media-edit-confirm">Enregistrer les modifications</button></div></form>';
    document.body.appendChild(dialog);
    dialog.addEventListener("close", () => dialog.remove(), { once: true });
    dialog.querySelector("#media-edit-confirm").onclick = async () => {
      const button = dialog.querySelector("#media-edit-confirm");
      const error = dialog.querySelector("#media-edit-error");
      const file = dialog.querySelector("#media-edit-file")?.files?.[0];
      if (file && (!/\.pdf$/i.test(file.name) || (file.type && file.type !== "application/pdf"))) {
        error.textContent = "Le fichier doit être un PDF.";
        error.hidden = false;
        return;
      }
      if (file && file.size > 6 * 1024 * 1024) {
        error.textContent = "Le PDF ne doit pas dépasser 6 Mo.";
        error.hidden = false;
        return;
      }
      const associationInputs = [...dialog.querySelectorAll("[data-media-edit-project]")];
      if (associationInputs.some((input) => !input.value.trim())) {
        error.textContent = "Le texte affiché aux répondants ne peut pas être vide.";
        error.hidden = false;
        return;
      }
      button.disabled = true;
      try {
        const payload = { title: dialog.querySelector("#media-edit-title").value.trim() };
        if (file) {
          payload.filename = file.name;
          payload.mimeType = "application/pdf";
          payload.contentBase64 = await fileToBase64(file);
        }
        await StudioAPI.request("/api/admin/organizations/" + encodeURIComponent(organization.id) + "/resource-library/" + encodeURIComponent(documentItem.id), {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        await updateMediaAssociationTitles(documentItem, associationInputs);
        dialog.close();
        await loadMediaLibrary();
        renderMediaLibrary();
        showMediaMessage("Document et textes associés mis à jour.");
      } catch (err) {
        button.disabled = false;
        error.textContent = err.message || "Modification impossible.";
        error.hidden = false;
      }
    };
    dialog.showModal();
  }
  function renderMediaLibrary() {
    const root = $("#client-media-list");
    if (!root) return;
    const documentCards = resourceDocuments.map((doc) => {
      const associations = Array.isArray(doc.associations) ? doc.associations : [];
      const usage = associations.length ? ' · ' + associations.length + ' campagne' + (associations.length > 1 ? 's' : '') : '';
      const pendingLegacy = doc.legacy_reference === true && doc.has_content === false;
      const state = pendingLegacy ? '<small style="color:#9a6700;font-weight:700">⚠ PDF historique à fournir</small>' : '<small>Ajouté le ' + date(doc.created_at) + '</small>';
      const download = pendingLegacy ? '' : '<button class="button button-secondary button-small" type="button" data-media-download="' + esc(doc.id) + '">Télécharger</button>';
      const editLabel = pendingLegacy ? 'Ajouter le PDF' : 'Modifier';
      return '<article class="admin-client-media-card' + (pendingLegacy ? ' is-legacy-pending' : '') + '"><div class="admin-client-media-icon">PDF</div><div class="admin-client-media-copy"><strong>' + esc(doc.title || doc.filename) + '</strong><span>' + esc(doc.filename) + ' · ' + formatBytes(doc.size_bytes) + usage + '</span>' + state + '</div><div class="admin-client-media-actions">' + download + '<button class="button button-secondary button-small" type="button" data-media-edit="' + esc(doc.id) + '">' + editLabel + '</button><button class="button button-primary button-small" type="button" data-media-associate="' + esc(doc.id) + '">Associer à une campagne</button><button class="button button-ghost button-small" type="button" data-media-delete="' + esc(doc.id) + '">Supprimer</button></div></article>';
    });
    const linkCards = resourceLinks.map((link) => {
      const associations = Array.isArray(link.associations) ? link.associations : [];
      const campaignNames = [...new Set(associations.map((item) => item.campaignName).filter(Boolean))];
      const usage = campaignNames.length ? campaignNames.join(' · ') : 'Ressource rattachée à une campagne';
      return '<article class="admin-client-media-card is-link-resource"><div class="admin-client-media-icon">LIEN</div><div class="admin-client-media-copy"><strong>' + esc(link.title) + '</strong><span>' + esc(usage) + '</span><small class="admin-client-media-url">' + esc(link.url) + '</small></div><div class="admin-client-media-actions"><a class="button button-primary button-small" href="' + esc(link.url) + '" target="_blank" rel="noopener noreferrer">Ouvrir le lien</a></div></article>';
    });
    if (!documentCards.length && !linkCards.length) {
      root.innerHTML = '<div class="admin-client-media-empty"><strong>Aucune ressource dans la médiathèque de ce client.</strong><span>Les PDF ajoutés ici et les liens rattachés aux campagnes apparaîtront dans cette médiathèque.</span></div>';
    } else {
      const linksTitle = linkCards.length ? '<div class="admin-client-media-group-title"><strong>Liens et ressources web</strong><span>' + linkCards.length + ' ressource' + (linkCards.length > 1 ? 's' : '') + '</span></div>' : '';
      const docsTitle = documentCards.length ? '<div class="admin-client-media-group-title"><strong>Documents PDF</strong><span>' + documentCards.length + ' document' + (documentCards.length > 1 ? 's' : '') + '</span></div>' : '';
      root.innerHTML = linksTitle + linkCards.join("") + docsTitle + documentCards.join("");
    }
    root.querySelectorAll("[data-media-download]").forEach((button) => button.onclick = async () => {
      const doc = resourceDocuments.find((item) => String(item.id) === String(button.dataset.mediaDownload));
      if (!doc) return;
      try { await downloadMediaDocument(doc.id, doc.filename); } catch (error) { showMediaMessage(error.message, "danger"); }
    });
    root.querySelectorAll("[data-media-edit]").forEach((button) => button.onclick = () => {
      const doc = resourceDocuments.find((item) => String(item.id) === String(button.dataset.mediaEdit));
      if (doc) openMediaEdit(doc);
    });
    root.querySelectorAll("[data-media-associate]").forEach((button) => button.onclick = () => {
      const doc = resourceDocuments.find((item) => String(item.id) === String(button.dataset.mediaAssociate));
      if (doc) openMediaAssociation(doc);
    });
    root.querySelectorAll("[data-media-delete]").forEach((button) => button.onclick = async () => {
      const doc = resourceDocuments.find((item) => String(item.id) === String(button.dataset.mediaDelete));
      if (!doc || !window.confirm('Supprimer « ' + (doc.title || doc.filename) + ' » de la médiathèque de ce client ?')) return;
      try {
        await StudioAPI.request("/api/admin/organizations/" + encodeURIComponent(organization.id) + "/resource-library/" + encodeURIComponent(doc.id), { method: "DELETE" });
        await loadMediaLibrary();
        renderMediaLibrary();
        showMediaMessage("Document supprimé de la médiathèque.");
      } catch (error) { showMediaMessage(error.message, "danger"); }
    });
  }
  function bindMediaUpload() {
    const upload = $("#client-media-upload");
    if (!upload) return;
    upload.onclick = async () => {
      const file = $("#client-media-file")?.files?.[0];
      const title = $("#client-media-title")?.value.trim() || "";
      if (!file) { showMediaMessage("Choisissez un fichier PDF.", "danger"); return; }
      if (!/\.pdf$/i.test(file.name) || file.type && file.type !== "application/pdf") { showMediaMessage("Le fichier doit être un PDF.", "danger"); return; }
      if (file.size > 6 * 1024 * 1024) { showMediaMessage("Le PDF ne doit pas dépasser 6 Mo.", "danger"); return; }
      upload.disabled = true;
      try {
        const contentBase64 = await fileToBase64(file);
        await StudioAPI.request("/api/admin/organizations/" + encodeURIComponent(organization.id) + "/resource-library", {
          method: "POST",
          body: JSON.stringify({ title, filename: file.name, mimeType: "application/pdf", contentBase64 }),
        });
        $("#client-media-file").value = "";
        $("#client-media-title").value = "";
        await loadMediaLibrary();
        renderMediaLibrary();
        showMediaMessage("PDF ajouté à la médiathèque du client.");
      } catch (error) { showMediaMessage(error.message || "Ajout impossible.", "danger"); }
      finally { upload.disabled = false; }
    };
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
        completed: "Terminée",
        closed: "Terminée",
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
    const kit = '<a class="button button-secondary" href="kit-communication.html' + q + '">📣 Kit de com</a>',
      openCampaign = String(p.communication_share_url || "").trim()
        ? '<a class="button button-secondary" href="' + esc(p.communication_share_url) + '" target="_blank" rel="noopener">↗ Ouvrir la campagne</a>'
        : "",
      openStats = String(p.communication_results_url || "").trim()
        ? '<a class="button button-secondary" href="' + esc(p.communication_results_url) + '" target="_blank" rel="noopener">📊 Ouvrir les stats</a>'
        : "",
      manage = '<button class="button button-secondary" type="button" data-manage-campaign="' + id + '">⚙️ Infos campagne</button>';
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
    if (p.legacy_history === true && st !== "draft")
      more.push(
        '<button type="button" data-mark-draft="' +
          id +
          '">📝 Remettre en brouillon</button>',
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
    return primary + openCampaign + openStats + kit + manage + '<details class="campaign-more"><summary>Autres actions</summary><div class="campaign-more-menu">' + more.join("") + '</div></details>';
  }
  function card(p) {
    const st = normalizedStatus(p),
      theme = p.theme_title || p.legacy_theme_title || "Thématique",
      catalogBase = p.theme_id ? (p.theme_title || "Base catalogue reliée") : "Non reliée",
      title = p.campaign_name || p.title || "Sans nom",
      respondent = p.respondent_title || title,
      contact = orgUsers(organization).find((u) => u.access_level === "owner") || orgUsers(organization)[0],
      explicitCommanditaire = [p.commanditaire_name, p.commanditaire_job_title, p.commanditaire_email].filter(Boolean),
      commanditaire = explicitCommanditaire.length
        ? explicitCommanditaire.map(esc).join(" — ")
        : contact
          ? [((contact.first_name || "") + " " + (contact.last_name || "")).trim(), contact.job_title, contact.email].filter(Boolean).map(esc).join(" — ")
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
      esc(catalogBase) +
      '</strong></div>' + (p.legacy_history && p.legacy_theme_title ? '<div class="admin-ad-meta">Thématique historique : <strong>' + esc(p.legacy_theme_title) + '</strong></div>' : '') + '<div class="admin-ad-meta">Titre répondants : <strong>' +
      esc(respondent) +
      '</strong></div>' +
      campaignLocalesHtml(p) +
      (p.legacy_history && p.legacy_slug ? '<div class="admin-ad-meta">Slug historique : <strong>' + esc(p.legacy_slug) + '</strong></div>' : '') +
      '<div class="admin-ad-tags"><span class="admin-ad-theme">' +
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
      '">Modifier</button><button data-toggle-client="' +
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
  function contactDisplayName(u) {
    return [u?.first_name, u?.last_name].filter(Boolean).join(" ").trim() || u?.email || "Contact";
  }
  function renderContacts() {
    const list = orgUsers(organization);
    const principal = list.find((u) => u.access_level === "owner" && u.active !== false) ||
      list.find((u) => u.access_level === "owner") ||
      list.find((u) => u.active !== false) ||
      list[0] || null;
    const others = principal ? list.filter((u) => String(u.id) !== String(principal.id)) : list;
    const principalHtml = principal
      ? '<article class="admin-contact-card principal"><span class="admin-contact-kicker">Contact principal</span><strong>' +
        esc(contactDisplayName(principal)) +
        '</strong><span>' + esc(principal.job_title || "Fonction non renseignée") +
        '</span><a href="mailto:' + esc(principal.email || "") + '">' + esc(principal.email || "—") +
        '</a>' + (principal.phone ? '<span>📞 ' + esc(principal.phone) + '</span>' : '') + '</article>'
      : '<article class="admin-contact-card principal"><span class="admin-contact-kicker">Contact principal</span><strong>Non renseigné</strong><span>Ajoutez un accès responsable du compte.</span></article>';
    const associatedHtml = others.length
      ? others.map((u) => '<article class="admin-contact-card"><span class="admin-contact-kicker">Contact associé</span><strong>' +
          esc(contactDisplayName(u)) + '</strong><span>' + esc(u.job_title || "Fonction non renseignée") +
          '</span><a href="mailto:' + esc(u.email || "") + '">' + esc(u.email || "—") +
          '</a><small>' + esc(accessLabels[u.access_level] || accessLabels.manager) + (u.active === false ? ' · désactivé' : '') + '</small></article>').join("")
      : '<article class="admin-contact-card"><span class="admin-contact-kicker">Contacts associés</span><strong>Aucun autre contact</strong><span>Le contact principal est le seul compte rattaché.</span></article>';
    $("#client-contacts").innerHTML = principalHtml + associatedHtml;
  }
  function renderCockpitManagement() {
    const hasProjects = orgProjects(organization).length > 0;
    const deleteBtn = $("#delete-client-cockpit");
    const archiveBtn = $("#archive-client-cockpit");
    archiveBtn.textContent = organization.active === false ? "Réactiver le cockpit" : "Archiver le cockpit";
    archiveBtn.dataset.nextActive = organization.active === false ? "true" : "false";
    $("#client-delete-note").textContent = hasProjects
      ? "Suppression protégée : ce cockpit contient des campagnes. Archivez-le si vous souhaitez le retirer de la vue active sans perdre les données."
      : "La suppression sera également refusée par l’API si un historique de commandes ou de packs existe.";
    deleteBtn.disabled = false;
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
      "</strong><small>Début : " +
      date(organization.pack_started_at) +
      " · Fin : " +
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
    renderMediaLibrary();
    bindMediaUpload();
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
    renderContacts();
    $("#client-users").innerHTML =
      orgUsers(organization).map(userRow).join("") ||
      '<div class="admin-empty admin-empty-with-action"><strong>Aucun compte utilisateur</strong><span>Ajoutez le premier accès pour ce client directement depuis son dossier.</span><button class="button button-primary" type="button" data-add-client-user-empty>+ Ajouter un accès</button></div>';
    $("#client-credits").innerHTML =
      '<div class="admin-pack-heading"><div><span class="eyebrow">Gestion du pack</span><h2>Crédits et validité</h2><p>Renseignez manuellement les crédits et les dates tant que la synchronisation automatique du moteur n’est pas connectée.</p></div><span id="client-pack-status" class="admin-pack-status ' + (organization.pack_unlimited ? 'is-unlimited' : '') + '">' + (organization.pack_unlimited ? 'Pack illimité' : fmt(rem) + ' restants') + '</span></div>' +
      '<label>Crédits attribués<input id="client-quota" type="number" min="0" value="' +
      (organization.passations_quota || 0) +
      '"></label><label>Crédits utilisés<input id="client-used" type="number" min="0" value="' +
      (organization.passations_used || 0) +
      '"></label><label>Crédits restants<input id="client-remaining" type="text" readonly value="' +
      (organization.pack_unlimited ? 'Illimité' : fmt(rem)) +
      '"></label><label>Date de début du pack<input id="client-pack-start" type="date" value="' +
      (organization.pack_started_at
        ? String(organization.pack_started_at).slice(0, 10)
        : "") +
      '"></label><label>Date de fin de validité<input id="client-expiry" type="date" value="' +
      (organization.pack_expires_at
        ? String(organization.pack_expires_at).slice(0, 10)
        : "") +
      '"></label><label class="admin-pack-unlimited"><input id="client-unlimited" type="checkbox" ' + (organization.pack_unlimited ? 'checked' : '') + '> Pack illimité</label><button class="button button-primary" id="save-client-credits">Enregistrer les ajustements</button>';
    renderCockpitManagement();
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
  function catalogThemeOptions(selectedId) {
    const selected = String(selectedId || "");
    return ['<option value="">Non reliée</option>'].concat(
      catalogThemes
        .filter((theme) => theme && theme.id)
        .map((theme) => '<option value="' + esc(theme.id) + '" ' + (String(theme.id) === selected ? 'selected' : '') + '>' + esc(theme.title || theme.slug || ('Thématique #' + theme.id)) + '</option>')
    ).join("");
  }

  async function openCampaignManagement(p) {
    document.getElementById("admin-campaign-management-dialog")?.remove();
    const dialog = document.createElement("dialog");
    dialog.id = "admin-campaign-management-dialog";
    dialog.className = "admin-dialog admin-dialog-wide campaign-management-dialog";
    dialog.innerHTML =
      '<form method="dialog"><button class="admin-dialog-close" value="cancel" aria-label="Fermer">×</button>' +
      '<p class="eyebrow">Administration de la campagne</p>' +
      '<h2>' + esc(p.campaign_name || p.title || "Campagne") + '</h2>' +
      '<p>Pour une campagne historique, les dates sont initialisées à partir du pack de passations du client. Vous pouvez les modifier ici si la campagne suit un calendrier différent.</p>' +
      '<div class="admin-form-grid">' +
      '<label class="field" style="grid-column:1/-1"><span>Base catalogue de référence</span><select id="admin-management-theme">' + catalogThemeOptions(p.theme_id) + '</select><small class="hint">Pour un import historique non relié, vous pouvez choisir ici la base catalogue correspondante. Cela ne remplace ni ne modifie le contenu historique importé.</small></label>' +
      '<label class="field"><span>Date de début</span><input id="admin-management-launch" type="date" value="' + esc(isoDay(p.launch_date || organization?.pack_started_at)) + '"></label>' +
      '<label class="field"><span>Date de fin</span><input id="admin-management-close" type="date" value="' + esc(isoDay(p.close_date || organization?.pack_expires_at)) + '"></label>' +
      '<label class="field"><span>Nom du commanditaire</span><input id="admin-management-commanditaire-name" maxlength="160" value="' + esc(p.commanditaire_name || "") + '" placeholder="Prénom Nom"></label>' +
      '<label class="field"><span>Fonction du commanditaire</span><input id="admin-management-commanditaire-job" maxlength="160" value="' + esc(p.commanditaire_job_title || "") + '" placeholder="DRH, Responsable DEI…"></label>' +
      '<label class="field"><span>Email du commanditaire</span><input id="admin-management-commanditaire-email" type="email" maxlength="200" value="' + esc(p.commanditaire_email || "") + '" placeholder="prenom.nom@entreprise.com"></label>' +
      '<label class="field"><span>URL de la campagne</span><input id="admin-management-share-url" type="url" value="' + esc(p.communication_share_url || "") + '" placeholder="https://…"></label>' +
      '<label class="field"><span>URL analytics / statistiques</span><input id="admin-management-results-url" type="url" value="' + esc(p.communication_results_url || "") + '" placeholder="https://stats.meandyoutoo.app/…"></label>' +
      '</div>' +
      '<div class="top-actions"><button class="button button-ghost" value="cancel">Annuler</button><button class="button button-primary" id="admin-management-save" type="button">Enregistrer</button></div></form>';
    document.body.append(dialog);
    dialog.querySelector("#admin-management-save").onclick = async () => {
      const launchDate = dialog.querySelector("#admin-management-launch").value,
        closeDate = dialog.querySelector("#admin-management-close").value;
      if (launchDate && closeDate && closeDate <= launchDate) {
        showError("La date de fin doit être postérieure à la date de début");
        return;
      }
      const emailInput = dialog.querySelector("#admin-management-commanditaire-email");
      if (emailInput.value && !emailInput.checkValidity()) {
        emailInput.reportValidity();
        return;
      }
      try {
        await StudioAPI.request("/api/admin/projects/" + p.id + "/management", {
          method: "PATCH",
          body: JSON.stringify({
            themeId: dialog.querySelector("#admin-management-theme").value || null,
            launchDate: launchDate || null,
            closeDate: closeDate || null,
            commanditaireName: dialog.querySelector("#admin-management-commanditaire-name").value.trim(),
            commanditaireJobTitle: dialog.querySelector("#admin-management-commanditaire-job").value.trim(),
            commanditaireEmail: emailInput.value.trim(),
            shareUrl: dialog.querySelector("#admin-management-share-url").value.trim(),
            resultsUrl: dialog.querySelector("#admin-management-results-url").value.trim(),
          }),
        });
        dialog.close();
        dialog.remove();
        await load();
        await StudioModal.alert({
          eyebrow: "Campagne mise à jour",
          title: "Les informations ont été enregistrées",
          message: "Base catalogue, dates, commanditaire et liens sont maintenant disponibles dans le dossier client.",
          type: "success",
          confirmLabel: "Fermer",
        });
      } catch (e) {
        showError(e.message);
      }
    };
    dialog.addEventListener("close", () => dialog.remove(), { once: true });
    dialog.showModal();
  }

  function bindProjectActions() {
    $$('[data-manage-campaign]').forEach(
      (b) =>
        (b.onclick = () => {
          const p = projects.get(String(b.dataset.manageCampaign));
          if (p) openCampaignManagement(p);
        }),
    );
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
    $$("[data-mark-draft]").forEach(
      (b) =>
        (b.onclick = async () => {
          const p = projects.get(String(b.dataset.markDraft));
          if (!p) return;
          const ok = await StudioModal.confirm({
            eyebrow: "Campagne historique importée",
            type: "warning",
            title:
              "Remettre « " +
              (p.campaign_name || p.title || "cette campagne") +
              " » en brouillon ?",
            message:
              "Le contenu, les langues, les dates et les données historiques seront conservés. Seul le statut passera en brouillon.",
            cancelLabel: "Annuler",
            confirmLabel: "Remettre en brouillon",
          });
          if (!ok) return;
          try {
            await StudioAPI.request(
              "/api/admin/projects/" + p.id + "/mark-draft",
              { method: "PATCH", body: "{}" },
            );
            await load();
          } catch (e) {
            showError(e.message);
          }
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
  function refreshCreditBalance() {
    const quotaInput = $("#client-quota"),
      usedInput = $("#client-used"),
      remainingInput = $("#client-remaining"),
      unlimitedInput = $("#client-unlimited"),
      status = $("#client-pack-status");
    if (!quotaInput || !usedInput || !remainingInput || !unlimitedInput) return;
    const unlimited = unlimitedInput.checked,
      quota = Math.max(0, Number(quotaInput.value) || 0),
      used = Math.max(0, Number(usedInput.value) || 0),
      rem = Math.max(0, quota - used);
    quotaInput.disabled = unlimited;
    usedInput.disabled = unlimited;
    remainingInput.value = unlimited ? "Illimité" : fmt(rem);
    if (status) {
      status.textContent = unlimited ? "Pack illimité" : fmt(rem) + " restants";
      status.classList.toggle("is-unlimited", unlimited);
    }
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
    $("#client-quota")?.addEventListener("input", refreshCreditBalance);
    $("#client-used")?.addEventListener("input", refreshCreditBalance);
    $("#client-unlimited")?.addEventListener("change", refreshCreditBalance);
    refreshCreditBalance();
    $("#archive-client-cockpit").onclick = toggleCockpitArchive;
    $("#delete-client-cockpit").onclick = deleteCockpit;
    bindUserActions();
    bindProjectActions();
  }
  function setUserAccessMode(mode) {
    const editing = Boolean($("#user-form")?.dataset.editId);
    const normalized = editing ? "edit" : mode === "existing" ? "existing" : "new";
    const modeRoot = $("#user-access-mode"),
      existingPanel = $("#user-existing-panel"),
      newFields = $("#user-new-fields"),
      saveButton = $("#save-user");
    if (modeRoot) modeRoot.hidden = editing;
    if (existingPanel) existingPanel.hidden = normalized !== "existing";
    if (newFields) newFields.hidden = normalized === "existing";
    ["#user-first", "#user-last", "#user-job-title", "#user-email"].forEach((selector) => {
      const input = $(selector);
      if (input) input.required = normalized !== "existing";
    });
    $$("[name='user-access-mode']").forEach((input) => {
      input.checked = input.value === normalized;
      input.closest(".user-access-mode-choice")?.classList.toggle("is-selected", input.checked);
    });
    if (!editing && normalized === "existing") {
      if (saveButton) {
        saveButton.textContent = selectedExistingUser?.active === false
          ? "Rattacher et réactiver"
          : selectedExistingUser
            ? "Rattacher à " + (organization.name || "ce client")
            : "Rattacher ce compte";
        saveButton.disabled = !selectedExistingUser;
      }
    } else if (saveButton) {
      saveButton.disabled = false;
      saveButton.textContent = editing ? "Enregistrer les droits" : "Créer et envoyer l’invitation";
    }
  }
  function selectExistingUser(user) {
    selectedExistingUser = user || null;
    $("#user-existing-selected-id").value = user?.id || "";
    const selected = $("#user-existing-selected"), results = $("#user-existing-results");
    if (!user) {
      selected.hidden = true;
      selected.innerHTML = "";
      setUserAccessMode("existing");
      return;
    }
    if (results) results.innerHTML = "";
    const currentOrganization = user.currentOrganization || null;
    const movesFromAnotherClient = Boolean(
      currentOrganization && String(currentOrganization.id || "") !== String(organization.id || ""),
    );
    selected.innerHTML =
      '<div class="user-existing-selected-card"><span class="user-existing-avatar">' +
      esc((user.first_name || user.email || "U").charAt(0).toUpperCase()) +
      '</span><div><strong>' + esc(((user.first_name || "") + " " + (user.last_name || "")).trim() || user.email) +
      '</strong><span>' + esc(user.email || "") + '</span><small>' +
      (currentOrganization ? "Client actuel : " + esc(currentOrganization.name || currentOrganization.id) : "Aucun client actuellement rattaché") +
      (user.active === false ? " · compte désactivé" : "") +
      '</small>' +
      (movesFromAnotherClient
        ? '<em class="user-existing-reassignment">Le rattachement actuel sera remplacé par ' + esc(organization.name || "ce client") + '.</em>'
        : '') +
      '</div><button type="button" class="button button-ghost" data-change-existing-user>Changer</button></div>';
    selected.hidden = false;
    selected.querySelector("[data-change-existing-user]")?.addEventListener("click", () => {
      selectedExistingUser = null;
      $("#user-existing-selected-id").value = "";
      selected.hidden = true;
      $("#user-existing-search").value = "";
      $("#user-existing-search").focus();
      setUserAccessMode("existing");
    });
    setUserAccessMode("existing");
  }
  function renderExistingUserResults(list, queryText) {
    const root = $("#user-existing-results");
    if (!root) return;
    if (!queryText || queryText.length < 2) {
      root.innerHTML = '<p class="hint">Commencez à saisir un nom, un prénom ou un email.</p>';
      return;
    }
    if (!list.length) {
      root.innerHTML = '<div class="user-existing-empty">Aucun compte Studio trouvé.</div>';
      return;
    }
    root.innerHTML = list.map((user) => {
      const currentOrganization = user.currentOrganization || null;
      const attached = user.attachedToTarget === true;
      const currentLabel = currentOrganization ? (currentOrganization.name || currentOrganization.id) : "";
      return '<article class="user-existing-result ' + (attached ? 'is-attached' : '') + '">' +
        '<div><strong>' + esc(((user.first_name || "") + " " + (user.last_name || "")).trim() || user.email) + '</strong>' +
        '<span>' + esc(user.email || "") + '</span>' +
        '<small>' + esc(currentLabel ? "Client actuel : " + currentLabel : "Aucun client rattaché") + (user.active === false ? " · Compte désactivé" : "") + '</small></div>' +
        (attached
          ? '<span class="badge badge-muted">Déjà sur ce client</span>'
          : '<button class="button button-secondary" type="button" data-select-existing-user="' + esc(user.id) + '">Sélectionner</button>') +
        '</article>';
    }).join("");
    root.querySelectorAll("[data-select-existing-user]").forEach((button) => {
      button.addEventListener("click", () => {
        const user = list.find((item) => String(item.id) === String(button.dataset.selectExistingUser));
        if (user) selectExistingUser(user);
      });
    });
  }
  async function searchExistingUsers(value) {
    const q = String(value || "").trim();
    if (q.length < 2) return renderExistingUserResults([], q);
    const root = $("#user-existing-results");
    if (root) root.innerHTML = '<p class="hint">Recherche…</p>';
    try {
      const data = await StudioAPI.request(
        "/api/admin/users/search-existing?q=" + encodeURIComponent(q) +
        "&organizationId=" + encodeURIComponent(organization.id),
      );
      if ($("#user-existing-search").value.trim() !== q) return;
      renderExistingUserResults(data.users || [], q);
    } catch (error) {
      if (root) root.innerHTML = '<div class="user-existing-empty is-error">' + esc(error.message) + '</div>';
    }
  }
  function openUser(u = null) {
    const f = $("#user-form");
    f.reset();
    f.dataset.editId = u?.id || "";
    $("#user-org-id").value = organization.id;
    $("#user-existing-selected-id").value = "";
    selectedExistingUser = null;
    $("#user-dialog h2").textContent = u ? "Modifier le compte et ses droits" : "Ajouter un accès";
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
      setUserAccessMode("edit");
    } else {
      $("#user-existing-results").innerHTML = '<p class="hint">Commencez à saisir un nom, un prénom ou un email.</p>';
      $("#user-existing-selected").hidden = true;
      $("#user-existing-selected").innerHTML = "";
      setUserAccessMode("new");
    }
    $("#user-access-level").onchange = () =>
      renderPermissionFields(
        permissionPresets[$("#user-access-level").value] || permissionPresets.manager,
      );
    $$("[name='user-access-mode']").forEach((input) => {
      input.onchange = () => {
        if (input.checked) {
          if (input.value !== "existing") selectExistingUser(null);
          setUserAccessMode(input.value);
        }
      };
    });
    const search = $("#user-existing-search");
    search.oninput = () => {
      clearTimeout(existingSearchTimer);
      selectedExistingUser = null;
      $("#user-existing-selected-id").value = "";
      $("#user-existing-selected").hidden = true;
      setUserAccessMode("existing");
      existingSearchTimer = setTimeout(() => searchExistingUsers(search.value), 280);
    };
    $("#user-dialog").showModal();
  }
  function bindUserActions() {
    const inlineAdd = $("#add-client-user-accounts");
    if (inlineAdd) inlineAdd.onclick = () => openUser();
    $$('[data-add-client-user-empty]').forEach((button) => {
      button.onclick = () => openUser();
    });
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
                " sera définitivement supprimé du Studio.",
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
    const unlimited = $("#client-unlimited").checked,
      quota = Math.max(0, Number($("#client-quota").value) || 0),
      used = Math.max(0, Number($("#client-used").value) || 0),
      packStartedAt = $("#client-pack-start").value || null,
      packExpiresAt = $("#client-expiry").value || null;
    if (!unlimited && used > quota) {
      showError("Les crédits utilisés ne peuvent pas dépasser les crédits attribués.");
      return;
    }
    if (packStartedAt && packExpiresAt && packExpiresAt <= packStartedAt) {
      showError("La date de fin du pack doit être postérieure à la date de début.");
      return;
    }
    try {
      await StudioAPI.request("/api/admin/organizations/" + organization.id, {
        method: "PATCH",
        body: JSON.stringify({
          passationsQuota: quota,
          passationsUsed: used,
          packStartedAt,
          packExpiresAt,
          packUnlimited: unlimited,
        }),
      });
      await load();
    } catch (e) {
      showError(e.message);
    }
  }
  async function toggleCockpitArchive() {
    const nextActive = $("#archive-client-cockpit").dataset.nextActive === "true";
    const verb = nextActive ? "réactiver" : "archiver";
    if (!window.confirm((nextActive ? "Réactiver" : "Archiver") + " le cockpit de " + (organization.name || "ce client") + " ?\n\n" + (nextActive ? "Les accès pourront de nouveau être utilisés." : "Aucune campagne ni donnée ne sera supprimée."))) return;
    try {
      await StudioAPI.request("/api/admin/organizations/" + organization.id, {
        method: "PATCH",
        body: JSON.stringify({ active: nextActive }),
      });
      await load();
    } catch (e) {
      showError("Impossible de " + verb + " le cockpit : " + e.message);
    }
  }
  async function deleteCockpit() {
    const name = organization.name || "ce client";
    const typed = window.prompt(
      "Suppression définitive du cockpit « " + name + " ».\n\nCette action n’est possible que s’il ne contient aucune campagne, commande ou historique de pack. Les données métier ne seront jamais supprimées en cascade.\n\nTapez SUPPRIMER pour confirmer.",
      "",
    );
    if (typed !== "SUPPRIMER") return;
    try {
      await StudioAPI.request("/api/admin/organizations/" + organization.id, { method: "DELETE" });
      window.location.href = "admin.html";
    } catch (e) {
      showError(e.message);
    }
  }

  async function saveUser() {
    const f = $("#user-form"), id = f.dataset.editId;
    const selectedMode = !id && $("[name='user-access-mode']:checked")?.value === "existing"
      ? "existing"
      : "new";
    if (selectedMode === "existing") {
      if (!selectedExistingUser) {
        await StudioModal.alert({
          title: "Choisissez un compte Studio",
          message: "Recherchez puis sélectionnez la personne à rattacher à ce client.",
          confirmLabel: "Fermer",
        });
        return;
      }
      const currentOrganization = selectedExistingUser.currentOrganization || null;
      const replacesAnotherClient = Boolean(
        currentOrganization && String(currentOrganization.id || "") !== String(organization.id || ""),
      );
      if (replacesAnotherClient) {
        const confirmed = await StudioModal.confirm({
          type: "warning",
          title: "Rattacher ce compte à " + (organization.name || "ce client") + " ?",
          message:
            "Ce compte est actuellement rattaché à " +
            (currentOrganization.name || currentOrganization.id) +
            ". Son rattachement actuel sera remplacé. À sa prochaine connexion, la personne accédera directement à " +
            (organization.name || "ce client") + ".",
          confirmLabel: "Rattacher à " + (organization.name || "ce client"),
        });
        if (!confirmed) return;
      }
      const payload = {
        userId: selectedExistingUser.id,
        accessLevel: $("#user-access-level").value,
        permissions: selectedPermissions(),
        reactivate: selectedExistingUser.active === false,
        replaceExistingOrganization: replacesAnotherClient,
      };
      try {
        await StudioAPI.request(
          "/api/admin/organizations/" + encodeURIComponent(organization.id) + "/attach-existing-user",
          { method: "POST", body: JSON.stringify(payload) },
        );
        $("#user-dialog").close();
        await load();
      } catch (e) {
        showError(e.message);
      }
      return;
    }
    if (!f.reportValidity()) return;
    const payload = {
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
      const [folderData, catalogData] = await Promise.all([
        StudioAPI.request('/api/campaign-folders?organizationId=' + encodeURIComponent(organization.id)),
        StudioAPI.request('/api/admin/catalog/themes')
      ]);
      catalogThemes = Array.isArray(catalogData?.themes) ? catalogData.themes : [];
      folders = Array.isArray(folderData.folders) ? folderData.folders : [];
      orgProjects(organization).forEach((project) => { project.folder_id = null; });
      (folderData.assignments || []).forEach((assignment) => {
        const project = orgProjects(organization).find((item) => String(item.id) === String(assignment.project_id));
        if (project) project.folder_id = assignment.folder_id;
      });
      users = new Map(orgUsers(organization).map((u) => [String(u.id), u]));
      await loadMediaLibrary();
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
