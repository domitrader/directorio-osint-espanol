/**
 * OSINT HUB ESPAÑOL v3.0 - MOTOR DE APLICACIÓN CYBERCOMMAND
 * Alto rendimiento, delegación de eventos, búsqueda multi-token debounced,
 * tema Dark/Light nativo, workflows con checklist pericial y exportador multi-formato.
 */

import { CATEGORIES, OSINT_TOOLS, WORKFLOWS, OSINT_DORKS } from "./data.js";

class OsintHubApp {
  constructor() {
    this.state = {
      category: "todas",
      cost: "todos",
      level: "todos",
      opsec: "todos",
      search: "",
      onlyFavorites: false,
      workflowFilter: null,
      favorites: new Set(JSON.parse(localStorage.getItem("osint_favs_v3") || "[]")),
      workflowProgress: JSON.parse(localStorage.getItem("osint_wf_progress_v3") || "{}"),
      activeWorkflow: WORKFLOWS[0].id,
      theme: localStorage.getItem("osint_theme_v3") || "dark"
    };

    this.debounceTimer = null;
    this.dom = {};
    this.init();
  }

  init() {
    this.cacheDom();
    this.applyTheme();
    this.bindEvents();
    this.parseUrlHash();
    this.renderCategoryNav();
    this.renderWorkflowWidget();
    this.renderTools();
    this.updateCounters();
    this.setupKeyboardShortcuts();
  }

  cacheDom() {
    this.dom = {
      // Búsqueda y Filtros
      searchInput: document.getElementById("main-search"),
      clearSearchBtn: document.getElementById("clear-search-btn"),
      categoryContainer: document.getElementById("category-scroll-container"),
      toolsGrid: document.getElementById("tools-grid-container"),
      resultsCount: document.getElementById("results-counter-val"),
      resetFiltersBtn: document.getElementById("btn-reset-all-filters"),
      
      // Acciones de Cabecera
      favToggleBtn: document.getElementById("btn-toggle-favs-view"),
      favBadgeCount: document.getElementById("favs-count-badge"),
      themeToggleBtn: document.getElementById("btn-toggle-theme"),
      themeIcon: document.getElementById("theme-toggle-icon"),
      openWorkflowsBtn: document.getElementById("btn-open-workflows"),
      openDorkBuilderBtn: document.getElementById("btn-open-dork-builder"),
      exportDossierBtn: document.getElementById("btn-export-dossier"),
      
      // Hero
      heroToggleBtn: document.getElementById("btn-toggle-hero-workflows"),
      heroContent: document.getElementById("hero-collapsible-content"),
      heroToggleArrow: document.getElementById("hero-toggle-arrow"),
      heroWorkflowSelect: document.getElementById("hero-workflow-select"),
      heroWorkflowSteps: document.getElementById("hero-workflow-steps"),

      // Modales
      detailModal: document.getElementById("tool-detail-modal"),
      detailModalBody: document.getElementById("detail-modal-body"),
      detailModalTitle: document.getElementById("detail-modal-title"),
      detailModalLink: document.getElementById("detail-modal-direct-link"),
      
      dorkModal: document.getElementById("dork-launcher-modal"),
      dorkTargetInput: document.getElementById("dork-target-input"),
      dorkResultsList: document.getElementById("dork-generated-list"),
      
      caseExportModal: document.getElementById("case-export-modal"),
      caseExportTextarea: document.getElementById("case-export-textarea"),
      downloadMdBtn: document.getElementById("btn-download-md"),
      downloadJsonBtn: document.getElementById("btn-download-json"),
      downloadCsvBtn: document.getElementById("btn-download-csv"),
      copyCaseMarkdownBtn: document.getElementById("btn-copy-case-markdown"),

      workflowsModal: document.getElementById("workflows-modal"),
      modalWorkflowSelect: document.getElementById("modal-workflow-select"),
      modalWorkflowSteps: document.getElementById("modal-workflow-steps"),
      btnFilterByWorkflow: document.getElementById("btn-filter-by-workflow"),

      toastContainer: document.getElementById("toast-container")
    };
  }

  // ==================== TEMA OSCURO / CLARO ====================

  applyTheme() {
    if (this.state.theme === "light") {
      document.documentElement.classList.add("theme-light");
      if (this.dom.themeIcon) this.dom.themeIcon.textContent = "☀️";
    } else {
      document.documentElement.classList.remove("theme-light");
      if (this.dom.themeIcon) this.dom.themeIcon.textContent = "🌙";
    }
  }

  toggleTheme() {
    this.state.theme = this.state.theme === "dark" ? "light" : "dark";
    localStorage.setItem("osint_theme_v3", this.state.theme);
    this.applyTheme();
    this.showToast(`Modo ${this.state.theme === 'dark' ? 'oscuro' : 'claro'} activado`, "info");
  }

  // ==================== EVENTOS Y BINDINGS ====================

  bindEvents() {
    // 1. Búsqueda con debounce (120ms) y tokenización multi-término
    this.dom.searchInput.addEventListener("input", (e) => {
      clearTimeout(this.debounceTimer);
      const val = e.target.value.trim().toLowerCase();
      this.dom.clearSearchBtn.style.display = val ? "flex" : "none";

      this.debounceTimer = setTimeout(() => {
        this.state.search = val;
        this.syncUrlHash();
        this.renderTools();
      }, 120);
    });

    this.dom.clearSearchBtn.addEventListener("click", () => {
      this.dom.searchInput.value = "";
      this.state.search = "";
      this.dom.clearSearchBtn.style.display = "none";
      this.dom.searchInput.focus();
      this.syncUrlHash();
      this.renderTools();
    });

    // 2. Filtros de Coste
    document.querySelectorAll("[data-filter-cost]").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll("[data-filter-cost]").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        this.state.cost = btn.dataset.filterCost;
        this.renderTools();
      });
    });

    // 3. Selectores de Nivel y OPSEC
    const levelSelect = document.getElementById("select-filter-level");
    if (levelSelect) {
      levelSelect.addEventListener("change", (e) => {
        this.state.level = e.target.value;
        this.renderTools();
      });
    }

    const opsecSelect = document.getElementById("select-filter-opsec");
    if (opsecSelect) {
      opsecSelect.addEventListener("change", (e) => {
        this.state.opsec = e.target.value;
        this.renderTools();
      });
    }

    // 4. Toggle de Favoritos
    this.dom.favToggleBtn.addEventListener("click", () => {
      this.state.onlyFavorites = !this.state.onlyFavorites;
      this.dom.favToggleBtn.classList.toggle("active", this.state.onlyFavorites);
      this.renderCategoryNav();
      this.renderTools();
    });

    // 5. Reset General de Filtros
    this.dom.resetFiltersBtn.addEventListener("click", () => {
      this.resetAllFilters();
    });

    // 6. Botones de Cabecera
    this.dom.themeToggleBtn.addEventListener("click", () => this.toggleTheme());
    this.dom.openDorkBuilderBtn.addEventListener("click", () => this.openDorkModal());
    this.dom.exportDossierBtn.addEventListener("click", () => this.openCaseExportModal());
    this.dom.openWorkflowsBtn.addEventListener("click", () => this.openWorkflowsModal());

    // 7. Toggle Hero Móvil
    if (this.dom.heroToggleBtn && this.dom.heroContent) {
      this.dom.heroToggleBtn.addEventListener("click", () => {
        const isExpanded = this.dom.heroContent.classList.toggle("is-expanded");
        this.dom.heroToggleBtn.setAttribute("aria-expanded", isExpanded);
        if (this.dom.heroToggleArrow) {
          this.dom.heroToggleArrow.textContent = isExpanded ? "▴" : "▾";
        }
      });
    }

    // 8. Selects de Workflow
    if (this.dom.heroWorkflowSelect) {
      this.dom.heroWorkflowSelect.addEventListener("change", (e) => {
        this.state.activeWorkflow = e.target.value;
        this.renderWorkflowWidget();
      });
    }

    if (this.dom.modalWorkflowSelect) {
      this.dom.modalWorkflowSelect.addEventListener("change", (e) => {
        this.state.activeWorkflow = e.target.value;
        if (this.dom.heroWorkflowSelect) this.dom.heroWorkflowSelect.value = e.target.value;
        this.renderWorkflowWidget();
      });
    }

    if (this.dom.btnFilterByWorkflow) {
      this.dom.btnFilterByWorkflow.addEventListener("click", () => {
        this.filterByActiveWorkflow();
        this.closeAllModals();
      });
    }

    // 9. Dork Target Input
    if (this.dom.dorkTargetInput) {
      this.dom.dorkTargetInput.addEventListener("input", () => {
        this.renderDorksList();
      });
    }

    // 10. Export Actions (Descargas y Copiado)
    if (this.dom.copyCaseMarkdownBtn) {
      this.dom.copyCaseMarkdownBtn.addEventListener("click", () => {
        const text = this.dom.caseExportTextarea.value;
        this.copyToClipboard(text, "Expediente Markdown copiado al portapapeles");
      });
    }

    if (this.dom.downloadMdBtn) {
      this.dom.downloadMdBtn.addEventListener("click", () => this.downloadFile("informe-osint.md", this.dom.caseExportTextarea.value, "text/markdown"));
    }

    if (this.dom.downloadJsonBtn) {
      this.dom.downloadJsonBtn.addEventListener("click", () => {
        const favs = OSINT_TOOLS.filter(t => this.state.favorites.has(t.id));
        this.downloadFile("kit-osint.json", JSON.stringify(favs, null, 2), "application/json");
      });
    }

    if (this.dom.downloadCsvBtn) {
      this.dom.downloadCsvBtn.addEventListener("click", () => this.downloadCsvFile());
    }

    // 11. Cierre universal de modales (Backdrop y botones [data-close-modal])
    document.querySelectorAll(".modal-backdrop").forEach(backdrop => {
      backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop) this.closeAllModals();
      });
    });

    document.querySelectorAll("[data-close-modal]").forEach(btn => {
      btn.addEventListener("click", () => this.closeAllModals());
    });

    // 12. Delegación de eventos en el contenedor de tarjetas (Evita DOM Thrashing y acumulación de listeners)
    this.dom.toolsGrid.addEventListener("click", (e) => {
      // Favorito
      const favBtn = e.target.closest("[data-fav-id]");
      if (favBtn) {
        e.preventDefault();
        e.stopPropagation();
        this.toggleFavorite(favBtn.dataset.favId);
        return;
      }

      // Copiar enlace directo
      const copyBtn = e.target.closest("[data-copy-url]");
      if (copyBtn) {
        e.preventDefault();
        e.stopPropagation();
        this.copyUrlWithInlineFeedback(copyBtn, copyBtn.dataset.copyUrl);
        return;
      }

      // Abrir modal de detalle
      const detailBtn = e.target.closest("[data-detail-id]");
      if (detailBtn) {
        e.preventDefault();
        e.stopPropagation();
        const tool = OSINT_TOOLS.find(t => t.id === detailBtn.dataset.detailId);
        if (tool) this.openDetailModal(tool);
        return;
      }
    });
  }

  setupKeyboardShortcuts() {
    window.addEventListener("keydown", (e) => {
      if ((e.key === "/" || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k")) && 
          document.activeElement.tagName !== "INPUT" && 
          document.activeElement.tagName !== "TEXTAREA") {
        e.preventDefault();
        this.dom.searchInput.focus();
        this.dom.searchInput.select();
      }

      if (e.key === "Escape") {
        this.closeAllModals();
      }
    });
  }

  // ==================== FILTRADO REACTIVO ====================

  getFilteredTools() {
    return OSINT_TOOLS.filter(tool => {
      // Filtro por workflow específico
      if (this.state.workflowFilter) {
        if (!this.state.workflowFilter.includes(tool.id)) return false;
      }

      // Categoría
      if (this.state.category !== "todas" && tool.category !== this.state.category) {
        return false;
      }

      // Coste
      if (this.state.cost !== "todos" && tool.cost !== this.state.cost) {
        return false;
      }

      // Nivel
      if (this.state.level !== "todos" && tool.level !== this.state.level) {
        return false;
      }

      // OPSEC
      if (this.state.opsec !== "todos" && !tool.opsec.toLowerCase().includes(this.state.opsec.toLowerCase())) {
        return false;
      }

      // Solo Favoritos
      if (this.state.onlyFavorites && !this.state.favorites.has(tool.id)) {
        return false;
      }

      // Búsqueda multi-token (cada palabra debe coincidir)
      if (this.state.search) {
        const tokens = this.state.search.split(/\s+/).filter(Boolean);
        const corpus = `
          ${tool.name} 
          ${tool.summary} 
          ${tool.practicalTip} 
          ${tool.categoryLabel} 
          ${tool.tags.join(" ")} 
          ${tool.keyFeatures.join(" ")}
        `.toLowerCase();

        return tokens.every(token => corpus.includes(token));
      }

      return true;
    });
  }

  renderTools() {
    const tools = this.getFilteredTools();
    this.dom.resultsCount.innerHTML = `Mostrando <strong>${tools.length}</strong> de ${OSINT_TOOLS.length} recursos`;

    const isFiltered = (this.state.category !== "todas" || 
                        this.state.cost !== "todos" || 
                        this.state.level !== "todos" || 
                        this.state.opsec !== "todos" || 
                        this.state.search !== "" || 
                        this.state.onlyFavorites ||
                        this.state.workflowFilter !== null);

    this.dom.resetFiltersBtn.style.display = isFiltered ? "inline-block" : "none";

    if (tools.length === 0) {
      this.renderEmptyState();
      return;
    }

    // Render eficiente con DocumentFragment
    const fragment = document.createDocumentFragment();

    tools.forEach(tool => {
      const isFav = this.state.favorites.has(tool.id);
      const card = document.createElement("article");
      card.className = "tool-card";

      const costClass = `cost-${tool.cost.toLowerCase().replace(/\s+/g, "-")}`;
      const isSafe = tool.opsec.includes("Seguro");
      const opsecClass = isSafe ? "opsec-safe" : "opsec-warn";

      card.innerHTML = `
        <div>
          <div class="tool-card-head">
            <div class="tool-card-head-left">
              <span class="tool-cat-badge">${tool.categoryLabel}</span>
              <h3 class="tool-title">
                <a href="${tool.url}" target="_blank" rel="noopener noreferrer">
                  ${this.highlightMatch(tool.name)}
                  <span class="external-arrow">↗</span>
                </a>
              </h3>
            </div>
            <div class="tool-card-badges">
              <button class="btn-star-fav ${isFav ? 'is-fav' : ''}" data-fav-id="${tool.id}" title="${isFav ? 'Quitar de favoritos' : 'Guardar en favoritos'}">
                ${isFav ? '★' : '☆'}
              </button>
              <span class="cost-badge ${costClass}">${tool.cost}</span>
            </div>
          </div>

          <p class="tool-summary">${this.highlightMatch(tool.summary)}</p>

          <div class="tool-tip-box">
            <strong>💡 Tip OSINT:</strong>
            ${tool.practicalTip}
          </div>

          <div class="tool-meta-tags">
            <span class="meta-pill ${opsecClass}">OPSEC: ${tool.opsec}</span>
            <span class="meta-pill">Nivel: ${tool.level}</span>
            ${tool.requiresAuth ? '<span class="meta-pill">Requiere Registro</span>' : '<span class="meta-pill">Sin Cuenta</span>'}
          </div>
        </div>

        <div class="tool-card-actions">
          <a href="${tool.url}" target="_blank" rel="noopener noreferrer" class="btn-open-tool">
            <span>Abrir Sitio Oficial</span>
            <span>↗</span>
          </a>
          <button class="btn-icon-action" data-detail-id="${tool.id}" title="Ver expediente y análisis completo">
            ℹ
          </button>
          <button class="btn-icon-action" data-copy-url="${tool.url}" title="Copiar enlace verificado">
            📋
          </button>
        </div>
      `;

      fragment.appendChild(card);
    });

    this.dom.toolsGrid.innerHTML = "";
    this.dom.toolsGrid.appendChild(fragment);
  }

  renderEmptyState() {
    this.dom.toolsGrid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔍</div>
        <h3>No se encontraron herramientas</h3>
        <p>No hay recursos que coincidan con los filtros actuales o el término "${this.state.search}". Intenta ajustar la búsqueda o restablecer los filtros.</p>
        <button id="btn-empty-reset" class="btn-tactical primary">Restablecer todos los filtros</button>
      </div>
    `;

    document.getElementById("btn-empty-reset").addEventListener("click", () => {
      this.resetAllFilters();
    });
  }

  // ==================== CATEGORÍAS Y NAVEGACIÓN ====================

  renderCategoryNav() {
    this.dom.categoryContainer.innerHTML = "";

    CATEGORIES.forEach(cat => {
      const count = cat.id === "todas" 
        ? OSINT_TOOLS.length 
        : OSINT_TOOLS.filter(t => t.category === cat.id).length;

      const isActive = (this.state.category === cat.id) && !this.state.onlyFavorites;
      const btn = document.createElement("button");
      btn.className = `cat-pill-btn ${isActive ? "active" : ""}`;
      btn.innerHTML = `
        <span>${cat.name}</span>
        <span class="cat-count-badge">${count}</span>
      `;

      btn.addEventListener("click", () => {
        this.state.category = cat.id;
        this.state.onlyFavorites = false;
        this.state.workflowFilter = null;
        this.dom.favToggleBtn.classList.remove("active");
        this.renderCategoryNav();
        this.renderTools();
      });

      this.dom.categoryContainer.appendChild(btn);
    });
  }

  // ==================== WORKFLOWS HERO Y DRAWER ====================

  renderWorkflowWidget() {
    const selects = [this.dom.heroWorkflowSelect, this.dom.modalWorkflowSelect].filter(Boolean);

    selects.forEach(select => {
      if (select.children.length === 0) {
        WORKFLOWS.forEach(wf => {
          const opt = document.createElement("option");
          opt.value = wf.id;
          opt.textContent = `${wf.title}`;
          select.appendChild(opt);
        });
      }
      select.value = this.state.activeWorkflow;
    });

    const currentWf = WORKFLOWS.find(w => w.id === this.state.activeWorkflow) || WORKFLOWS[0];
    const targets = [this.dom.heroWorkflowSteps, this.dom.modalWorkflowSteps].filter(Boolean);

    targets.forEach(container => {
      container.innerHTML = currentWf.steps.map(step => {
        const tool = OSINT_TOOLS.find(t => t.id === step.toolId);
        const toolUrl = tool ? tool.url : "#";
        const progressKey = `${currentWf.id}_step_${step.step}`;
        const isChecked = Boolean(this.state.workflowProgress[progressKey]);

        return `
          <div class="workflow-step-row" data-step-tool-id="${step.toolId}">
            <div class="step-main">
              <input type="checkbox" class="step-checkbox" data-wf-step="${progressKey}" ${isChecked ? 'checked' : ''} title="Marcar como completado">
              <div class="step-content">
                <a href="${toolUrl}" target="_blank" rel="noopener noreferrer" class="workflow-tool-link" title="Abrir sitio oficial">
                  <strong>${step.name}</strong>
                  <span class="step-ext-arrow">↗</span>
                </a>
                <span class="step-action-desc">${step.action}</span>
              </div>
            </div>
            <div class="step-actions">
              <a href="${toolUrl}" target="_blank" rel="noopener noreferrer" class="btn-step-open" title="Abrir ${step.name}">
                <span>Abrir</span>
                <span>↗</span>
              </a>
              ${tool ? `<button class="btn-step-info" data-step-info-id="${step.toolId}" title="Ver expediente">ℹ</button>` : ''}
            </div>
          </div>
        `;
      }).join("");

      // Listener de Checkboxes persistentes
      container.querySelectorAll("[data-wf-step]").forEach(chk => {
        chk.addEventListener("change", (e) => {
          this.state.workflowProgress[e.target.dataset.wfStep] = e.target.checked;
          localStorage.setItem("osint_wf_progress_v3", JSON.stringify(this.state.workflowProgress));
        });
      });

      // Listener de Info
      container.querySelectorAll("[data-step-info-id]").forEach(btn => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const tool = OSINT_TOOLS.find(t => t.id === btn.dataset.stepInfoId);
          if (tool) this.openDetailModal(tool);
        });
      });
    });
  }

  filterByActiveWorkflow() {
    const currentWf = WORKFLOWS.find(w => w.id === this.state.activeWorkflow) || WORKFLOWS[0];
    const toolIds = currentWf.steps.map(s => s.toolId);
    this.state.workflowFilter = toolIds;
    this.state.category = "todas";
    this.renderCategoryNav();
    this.renderTools();
    this.showToast(`Mostrando las ${toolIds.length} herramientas de: ${currentWf.title}`, "info");
  }

  // ==================== MODALES ====================

  openDetailModal(tool) {
    this.dom.detailModalTitle.textContent = tool.name;
    this.dom.detailModalLink.href = tool.url;

    this.dom.detailModalBody.innerHTML = `
      <div>
        <div style="display:flex; gap:0.5rem; margin-bottom:0.75rem; flex-wrap:wrap;">
          <span class="cost-badge cost-${tool.cost.toLowerCase().replace(/\s+/g, "-")}">${tool.cost}</span>
          <span class="meta-pill">${tool.categoryLabel}</span>
          <span class="meta-pill ${tool.opsec.includes('Seguro') ? 'opsec-safe' : 'opsec-warn'}">OPSEC: ${tool.opsec}</span>
          <span class="meta-pill">Nivel: ${tool.level}</span>
        </div>
        <p style="font-size:0.92rem; color:var(--text-secondary); line-height:1.6; margin-bottom:1rem;">
          ${tool.summary}
        </p>
      </div>

      <div class="tool-tip-box" style="margin-bottom:0;">
        <strong>💡 Consejo Operativo de Campo:</strong>
        <p style="margin-top:0.25rem;">${tool.practicalTip}</p>
      </div>

      <div style="background:var(--bg-elevated); padding:0.85rem; border-radius:var(--radius-md); border:1px solid var(--border-subtle);">
        <h4 style="font-size:0.75rem; font-weight:800; text-transform:uppercase; color:var(--text-primary); margin-bottom:0.4rem;">Características Clave:</h4>
        <ul style="padding-left:1.2rem; font-size:0.78rem; color:var(--text-secondary); display:flex; flex-direction:column; gap:0.25rem;">
          ${tool.keyFeatures.map(f => `<li>${f}</li>`).join("")}
        </ul>
      </div>

      <div style="display:flex; flex-wrap:wrap; gap:0.35rem;">
        ${tool.tags.map(t => `<span class="meta-pill">#${t}</span>`).join("")}
      </div>
    `;

    this.openModal(this.dom.detailModal);
  }

  openDorkModal() {
    this.renderDorksList();
    this.openModal(this.dom.dorkModal);
    setTimeout(() => this.dom.dorkTargetInput.focus(), 100);
  }

  renderDorksList() {
    const rawTarget = this.dom.dorkTargetInput.value.trim();
    const hasTarget = rawTarget.length > 0;
    const target = encodeURIComponent(rawTarget || "target.com");

    this.dom.dorkResultsList.innerHTML = OSINT_DORKS.map(dork => {
      let finalSyntax = "";

      if (dork.targetType === "domain") {
        finalSyntax = hasTarget ? `site:${rawTarget} ${dork.syntax}` : dork.syntax;
      } else {
        finalSyntax = dork.syntax.replace(/%QUERY%/g, rawTarget || "target");
      }

      const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(finalSyntax)}`;

      return `
        <div style="background:var(--bg-elevated); border:1px solid var(--border-subtle); border-radius:var(--radius-md); padding:0.75rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem; margin-bottom:0.35rem;">
            <strong style="font-size:0.8rem; color:var(--text-primary);">${dork.title}</strong>
            <div style="display:flex; gap:0.4rem;">
              <button class="btn-tactical" data-copy-dork="${this.escapeHtml(finalSyntax)}" style="padding:0.2rem 0.5rem; font-size:0.68rem;">Copiar</button>
              <a href="${googleUrl}" target="_blank" rel="noopener noreferrer" class="btn-tactical primary" style="padding:0.2rem 0.5rem; font-size:0.68rem;">Abrir en Google ↗</a>
            </div>
          </div>
          <code class="font-mono" style="display:block; font-size:0.72rem; color:var(--accent-cyan); background:var(--bg-surface); padding:0.45rem 0.65rem; border-radius:var(--radius-sm); border:1px solid var(--border-subtle); word-break:break-all;">
            ${this.escapeHtml(finalSyntax)}
          </code>
          <p style="font-size:0.7rem; color:var(--text-muted); margin-top:0.35rem;">💡 ${dork.tip}</p>
        </div>
      `;
    }).join("");

    this.dom.dorkResultsList.querySelectorAll("[data-copy-dork]").forEach(btn => {
      btn.addEventListener("click", () => {
        this.copyToClipboard(btn.dataset.copyDork, "Dork copiado al portapapeles");
      });
    });
  }

  openCaseExportModal() {
    const favs = OSINT_TOOLS.filter(t => this.state.favorites.has(t.id));
    const now = new Date().toISOString().slice(0, 10);

    let md = `# Expediente de Ciberinteligencia OSINT\n`;
    md += `Fecha de Generación: ${now}\n`;
    md += `Recursos Seleccionados: ${favs.length}\n`;
    md += `Estándar Metodológico: Gauntlet Loop v3.0\n\n`;
    md += `| Recurso | Categoría | Coste | OPSEC | URL |\n`;
    md += `| :--- | :--- | :--- | :--- | :--- |\n`;

    favs.forEach(t => {
      md += `| ${t.name} | ${t.categoryLabel} | ${t.cost} | ${t.opsec} | ${t.url} |\n`;
    });

    md += `\n## Fichas de Recursos con Consejos de Campo\n\n`;
    favs.forEach(t => {
      md += `### ${t.name}\n`;
      md += `- **URL:** ${t.url}\n`;
      md += `- **Resumen:** ${t.summary}\n`;
      md += `- **Tip Operativo:** ${t.practicalTip}\n\n`;
    });

    this.dom.caseExportTextarea.value = md;
    this.openModal(this.dom.caseExportModal);
  }

  openWorkflowsModal() {
    this.renderWorkflowWidget();
    this.openModal(this.dom.workflowsModal);
  }

  openModal(modal) {
    if (!modal) return;
    this.closeAllModals();
    modal.classList.add("is-active");
    document.body.classList.add("modal-open");
  }

  closeAllModals() {
    document.querySelectorAll(".modal-backdrop").forEach(m => m.classList.remove("is-active"));
    document.body.classList.remove("modal-open");
  }

  // ==================== FAVORITOS Y DESCARGAS ====================

  toggleFavorite(toolId) {
    if (this.state.favorites.has(toolId)) {
      this.state.favorites.delete(toolId);
      this.showToast("Recurso eliminado de favoritos", "info");
    } else {
      this.state.favorites.add(toolId);
      this.showToast("Recurso guardado en favoritos ★", "success");
    }

    localStorage.setItem("osint_favs_v3", JSON.stringify([...this.state.favorites]));
    this.updateCounters();
    this.renderTools();
  }

  updateCounters() {
    this.dom.favBadgeCount.textContent = this.state.favorites.size;
  }

  resetAllFilters() {
    this.state.category = "todas";
    this.state.cost = "todos";
    this.state.level = "todos";
    this.state.opsec = "todos";
    this.state.search = "";
    this.state.onlyFavorites = false;
    this.state.workflowFilter = null;

    this.dom.searchInput.value = "";
    this.dom.clearSearchBtn.style.display = "none";
    this.dom.favToggleBtn.classList.remove("active");

    document.querySelectorAll("[data-filter-cost]").forEach(b => {
      b.classList.toggle("active", b.dataset.filterCost === "todos");
    });

    const levelSelect = document.getElementById("select-filter-level");
    if (levelSelect) levelSelect.value = "todos";

    const opsecSelect = document.getElementById("select-filter-opsec");
    if (opsecSelect) opsecSelect.value = "todos";

    this.syncUrlHash();
    this.renderCategoryNav();
    this.renderTools();
    this.showToast("Filtros restablecidos", "info");
  }

  // Feedback en línea con tooltip "¡Copiado!" sobre el botón
  copyUrlWithInlineFeedback(button, url) {
    navigator.clipboard.writeText(url).then(() => {
      const tooltip = document.createElement("span");
      tooltip.className = "copied-tooltip";
      tooltip.textContent = "¡Copiado!";
      button.appendChild(tooltip);

      setTimeout(() => tooltip.remove(), 1200);
      this.showToast("Enlace copiado al portapapeles", "success");
    }).catch(() => {
      this.showToast("No se pudo copiar el enlace", "error");
    });
  }

  copyToClipboard(text, msg) {
    navigator.clipboard.writeText(text).then(() => {
      this.showToast(msg, "success");
    }).catch(() => {
      this.showToast("Error al copiar al portapapeles", "error");
    });
  }

  downloadFile(filename, text, mimeType) {
    const blob = new Blob([text], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 150);
    this.showToast(`Descargado: ${filename}`, "success");
  }

  downloadCsvFile() {
    const favs = OSINT_TOOLS.filter(t => this.state.favorites.has(t.id));
    let csv = "ID,Nombre,Categoria,Coste,Nivel,OPSEC,URL,Tip\n";

    favs.forEach(t => {
      const escape = s => `"${(s || '').replace(/"/g, '""')}"`;
      csv += `${escape(t.id)},${escape(t.name)},${escape(t.categoryLabel)},${escape(t.cost)},${escape(t.level)},${escape(t.opsec)},${escape(t.url)},${escape(t.practicalTip)}\n`;
    });

    this.downloadFile("kit-osint.csv", csv, "text/csv;charset=utf-8;");
  }

  showToast(message, type = "success") {
    const toast = document.createElement("div");
    toast.className = "toast";
    const icon = type === "success" ? "✓" : (type === "info" ? "ℹ" : "✕");
    toast.innerHTML = `<span style="color:${type === 'success' ? 'var(--accent-emerald)' : 'var(--accent-cyan)'}; font-weight:800;">${icon}</span> <span>${message}</span>`;
    
    this.dom.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(8px)";
      toast.style.transition = "all 0.2s ease";
      setTimeout(() => toast.remove(), 200);
    }, 2400);
  }

  // ==================== URL HASH & HISTORIAL SIN SPAM ====================

  syncUrlHash() {
    const params = new URLSearchParams();
    if (this.state.search) params.set("q", this.state.search);
    if (this.state.category !== "todas") params.set("cat", this.state.category);

    const hashStr = params.toString();
    const newUrl = hashStr ? `#${hashStr}` : window.location.pathname;
    // Usa replaceState para NO ensuciar el historial de navegación
    history.replaceState(null, "", newUrl);
  }

  parseUrlHash() {
    if (!window.location.hash) return;
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);

    if (params.has("q")) {
      this.state.search = params.get("q").toLowerCase();
      this.dom.searchInput.value = this.state.search;
      this.dom.clearSearchBtn.style.display = "flex";
    }

    if (params.has("cat")) {
      this.state.category = params.get("cat");
    }
  }

  highlightMatch(text) {
    if (!this.state.search) return text;
    const tokens = this.state.search.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return text;

    let pattern = tokens.map(t => this.escapeRegex(t)).join("|");
    const regex = new RegExp(`(${pattern})`, "gi");
    return text.replace(regex, `<mark style="background:rgba(56, 189, 248, 0.25); color:inherit; border-radius:2px; padding:0 2px;">$1</mark>`);
  }

  escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }
}

// Inicializar la aplicación al cargar el DOM
document.addEventListener("DOMContentLoaded", () => {
  new OsintHubApp();
});
