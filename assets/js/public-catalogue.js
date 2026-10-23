(() => {
  'use strict';
  const grid = document.getElementById('public-catalogue');
  const detail = document.getElementById('public-diagnostic');
  if (!grid && !detail) return;
  const root = grid || detail;
  const note = document.getElementById('public-catalogue-note');
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function apiBase() {
    const host = location.hostname.toLowerCase(), path = location.pathname.toLowerCase();
    const staging = host === 'localhost' || host === '127.0.0.1' || host.includes('staging') || path.includes('/studio-meandyoutoo-staging/');
    return staging ? 'https://studio-meandyoutoo-api-staging.osc-fr1.scalingo.io' : 'https://studio-meandyoutoo-api.osc-fr1.scalingo.io';
  }
  // Seul cet intitulé est normalisé sur demande ; tags et descriptions viennent du catalogue.
  const title = theme => theme.slug === 'religion' ? 'Diversité religieuse et laïcité' : String(theme.title || 'Diagnostic comportemental');
  const tags = theme => [...new Set((Array.isArray(theme.tags) ? theme.tags : []).map(t => String(t).trim()).filter(Boolean))];
  const tagMarkup = (theme, className) => tags(theme).length ? `<div class="${className}">${tags(theme).map(t => `<span>${esc(t)}</span>`).join('')}</div>` : '';
  const previewUrl = theme => 'apercu-repondant-public.html?theme=' + encodeURIComponent(theme.slug);
  const detailUrl = theme => 'diagnostic.html?theme=' + encodeURIComponent(theme.slug);
  const testPages = {
    sexisme:'tester-sexisme.html',handicap:'tester-handicap.html',origines:'tester-origines.html',
    religion:'tester-religion.html',lgbt:'tester-lgbt.html',intergenerationnel:'tester-intergenerationnel.html',
    'collegue-inclusif':'tester-collegue-inclusif.html',mixite:'tester-allie-mixite.html',
    'harcelement-moral':'tester-harcelement-moral.html'
  };
  const testUrl = theme => testPages[theme.slug] || 'contact.html?diagnostic=' + encodeURIComponent(title(theme));
  function card(theme) {
    const featured = theme.slug === 'sexisme';
    const content = `<div class="theme-head"><span aria-hidden="true" class="theme-symbol">${featured ? '✦' : '→'}</span><span class="theme-test-badge">ACCÈS TEST SUR DEMANDE</span></div><h3>${esc(title(theme))}</h3>${theme.description ? `<p>${esc(theme.description)}</p>` : ''}${tagMarkup(theme, 'theme-topics')}<div class="theme-card-actions"><a href="${esc(detailUrl(theme))}">Découvrir le diagnostic →</a><a class="theme-preview-cta" href="${esc(previewUrl(theme))}" target="_blank" rel="noopener">Voir l’aperçu répondant →</a><a class="theme-access-cta" href="${esc(testUrl(theme))}">Demander un accès test complet →</a></div>`;
    return `<article class="theme theme-card${featured ? ' featured theme-sexisme' : ''}">${featured ? `<div class="theme-visual"><img alt="" src="assets/img/illustrations/theme-sexisme.png"/></div><div class="theme-content">${content}</div>` : content}</article>`;
  }
  const experienceMarkup = "<section class=\"public-wrap section\"><p class=\"kicker\">Une expérience comportementale</p><h2>Pas un quiz de connaissances</h2><div class=\"demo\"><div class=\"question\"><span>PRINCIPE DU DIAGNOSTIC</span><h3>Le répondant se positionne face à des situations proches du quotidien professionnel.</h3><p>Les réponses permettent de faire émerger des pratiques, des réflexes et des marges de progression, puis d’accéder à une restitution et à des ressources.</p></div><div class=\"why\"><h3>Un aperçu public, puis un accès complet sur demande</h3><p>L’aperçu répondant permet de découvrir immédiatement le principe. Pour explorer une version plus complète, vous pouvez demander un accès de démonstration. La demande est étudiée par l’équipe Me&YouToo avant transmission.</p></div></div></section>\n<section class=\"band\"><div class=\"public-wrap profile-demo\"><div><p class=\"kicker\">Personnalisation</p><h2>Un diagnostic adapté à votre contexte</h2><p>Dans le Studio, vous partez des situations conçues par Me&YouToo, vous les sélectionnez selon vos objectifs et pouvez adapter leur contexte ou les remplacer par d’autres situations de la bibliothèque propriétaire.</p></div><article class=\"profile-card\"><span>EXPERTISE + AUTONOMIE</span><h3>Vous personnalisez le contexte, Me&YouToo garantit la méthodologie</h3><p>Les réponses, les profils et les logiques de scoring restent encadrés afin de préserver la cohérence du diagnostic.</p></article></div></section>\n";
  function renderDetail(theme) {
    document.title = title(theme) + ' | Studio Me&YouToo';
    const chapters = Array.isArray(theme.chapters) ? theme.chapters : [];
    const chapterMarkup = chapters.length ? `<section class="band"><div class="public-wrap"><p class="kicker">Les enjeux abordés</p><h2>Les parties du diagnostic</h2><div class="chapter-grid">${chapters.map((chapter, index) => `<article><i>${index + 1}</i><h3>${esc(chapter.title)}</h3>${chapter.description ? `<p>${esc(chapter.description)}</p>` : ''}</article>`).join('')}</div></div></section>` : '';
    detail.innerHTML = `<section class="public-wrap theme-hero"><div><p class="kicker">Diagnostic comportemental</p><h1>${esc(title(theme))}</h1>${theme.description ? `<p class="hero-lead">${esc(theme.description)}</p>` : ''}${tagMarkup(theme, 'chips')}<div class="actions"><a class="btn secondary" target="_blank" rel="noopener" href="${esc(previewUrl(theme))}">Voir l’aperçu répondant</a><a class="btn primary" href="${esc(testUrl(theme))}">Demander un accès test complet</a></div><p><a href="index.html#diagnostics">← Tous les diagnostics</a></p></div></section>${chapterMarkup}${experienceMarkup}<section class="public-wrap cta"><h2>Vous souhaitez en parler ?</h2><p>Échangez avec l’équipe Me&amp;YouToo pour choisir le diagnostic adapté à votre organisation.</p><div class="actions"><a class="btn primary" href="${esc(testUrl(theme))}">Demander un accès test complet</a><a class="btn secondary" href="contact.html">Parler de mon projet</a></div></section>`;
  }
  function showError(message) {
    root.innerHTML = `<div class="public-wrap section"><p>${esc(message)}</p><div class="actions"><button class="btn secondary" type="button" data-catalogue-retry>Réessayer</button><a class="btn primary" href="contact.html">Nous contacter</a><a href="index.html#diagnostics">Tous les diagnostics</a></div></div>`;
    root.querySelector('[data-catalogue-retry]').addEventListener('click', load);
    if (note) note.textContent = 'Notre équipe peut vous présenter les diagnostics adaptés à votre projet.';
  }
  async function load() {
    root.setAttribute('aria-busy', 'true');
    try {
      const response = await fetch(apiBase() + '/api/public/catalog/themes', {headers:{Accept:'application/json'},credentials:'omit',cache:'no-store'});
      if (!response.ok) throw new Error('Catalogue indisponible');
      const data = await response.json();
      if (!Array.isArray(data.themes)) throw new Error('Catalogue invalide');
      const themes = data.themes.filter(theme => theme && typeof theme.slug === 'string' && theme.slug.trim());
      if (grid) {
        if (!themes.length) { showError('Les diagnostics seront prochainement disponibles.'); return; }
        grid.innerHTML = themes.map(card).join('');
        if (note) note.textContent = `${themes.length} diagnostic${themes.length > 1 ? 's' : ''} disponible${themes.length > 1 ? 's' : ''}. Les demandes d’accès test sont étudiées par notre équipe avant l’envoi d’un accès.`;
      } else {
        const slug = detail.dataset.theme || new URLSearchParams(location.search).get('theme');
        const theme = themes.find(t => t.slug === slug);
        if (!theme) { showError('Ce diagnostic n’est plus proposé dans le catalogue. Découvrez nos diagnostics disponibles.'); return; }
        renderDetail(theme);
      }
    } catch (_) {
      showError('Le catalogue est momentanément indisponible. Réessayez dans un instant ou contactez notre équipe.');
    } finally {
      root.setAttribute('aria-busy', 'false');
    }
  }
  load();
})();
