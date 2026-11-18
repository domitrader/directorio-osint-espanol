/**
 * OSINT HUB ESPAÑOL - MOTOR DE APLICACIÓN Y CONTROLADOR PRINCIPAL
 * Búsqueda reactiva instantánea, facetas múltiples, vistas intercambiables y lanzador dorks.
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
      viewMode: localStorage.getItem("osint_view_mode") || "grid",
      favorites: new Set(JSON.parse(localStorage.getItem("osint_favs_v2") || "[]")),
      activeWorkflow: WORKFLOWS[0].id
    };

    this.dom = {};
    this.init();
  }

  init() {
    this.cacheDom();
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
      searchInput: document.getElementById("main-search"),
      clearSearchBtn: document.getElementById("clear-search-btn"),
      categoryContainer: document.getElementById("category-scroll-container"),
      toolsGrid: document.getElementById("tools-grid-container"),
      toolsTable: document.getElementById("tools-table-container"),
      resultsCount: document.getElementById("results-counter-val"),
      resetFiltersBtn: document.getElementById("btn-reset-all-filters"),
      favToggleBtn: document.getElementById("btn-toggle-favs-view"),
      favBadgeCount: document.getElementById("favs-count-badge"),
      viewGridBtn: document.getElementById("btn-view-grid"),
      viewTableBtn: document.getElementById("btn-view-table"),
      // Modales
      detailModal: document.getElementById("tool-detail-modal"),
      detailModalBody: document.getElementById("detail-modal-body"),
      detailModalTitle: document.getElementById("detail-modal-title"),
      detailModalLink: document.getElementById("detail-modal-direct-link"),
      dorkModal: document.getElementById("dork-launcher-modal"),
      dorkTargetInput: document.getElementById("dork-target-input"),
      dorkResultsList: document.getElementById("dork-generated-list"),
      caseExportModal: document.getElementById("case-export-modal"),
      caseExportContent: document.getElementById("case-export-textarea"),
      // Workflow
      workflowSelect: document.getElementById("hero-workflow-select"),
      workflowStepsList: document.getElementById("hero-workflow-steps"),
      toastContainer: document.getElementById("toast-container")
    };
  }

  bindEvents() {
    // Búsqueda en vivo
    this.dom.searchInput.addEventListener("input", (e) => {
      this.state.search = e.target.value.trim().toLowerCase();
      this.dom.clearSearchBtn.style.display = this.state.search ? "flex" : "none";
      this.syncUrlHash();
      this.renderTools();
    });

    this.dom.clearSearchBtn.addEventListener("click", () => {
      this.dom.searchInput.value = "";
      this.state.search = "";
      this.dom.clearSearchBtn.style.display = "none";
      this.dom.searchInput.focus();
      this.syncUrlHash();
      this.renderTools();
    });

    // Filtros de coste
    document.querySelectorAll("[data-filter-cost]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        document.querySelectorAll("[data-filter-cost]").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        this.state.cost = btn.dataset.filterCost;
        this.renderTools();
      });
    });

    // Selectores de nivel y opsec
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

    // Toggle de favoritos
    this.dom.favToggleBtn.addEventListener("click", () => {
      this.state.onlyFavorites = !this.state.onlyFavorites;
      this.dom.favToggleBtn.classList.toggle("primary", this.state.onlyFavorites);
      this.renderCategoryNav();
      this.renderTools();
    });

    // Reset de filtros
    this.dom.resetFiltersBtn.addEventListener("click", () => {
      this.resetAllFilters();
    });

    // Alternar vistas Grid / Table
    this.dom.viewGridBtn.addEventListener("click", () => this.switchView("grid"));
    this.dom.viewTableBtn.addEventListener("click", () => this.switchView("table"));

    // Workflow Select
    if (this.dom.workflowSelect) {
      this.dom.workflowSelect.addEventListener("change", (e) => {
        this.state.activeWorkflow = e.target.value;
        this.renderWorkflowWidget();
      });
    }

    // Toggle de Workflows en móvil
    const heroToggleBtn = document.getElementById("btn-toggle-hero-workflows");
    const heroContent = document.getElementById("hero-collapsible-content");
    const heroArrow = document.getElementById("hero-toggle-arrow");

    if (heroToggleBtn && heroContent) {
      heroToggleBtn.addEventListener("click", () => {
        const isExpanded = heroContent.classList.toggle("is-expanded");
        heroToggleBtn.setAttribute("aria-expanded", isExpanded);
        if (heroArrow) {
          heroArrow.textContent = isExpanded ? "▴" : "▾";
        }
      });
    }

    // Modal Dorks Target Input
    if (this.dom.dorkTargetInput) {
      this.dom.dorkTargetInput.addEventListener("input", () => {
        this.renderDorksList();
      });
    }
  }

  setupKeyboardShortcuts() {
    window.addEventListener("keydown", (e) => {
      // '/' o 'Cmd/Ctrl + K' para buscar
      if ((e.key === "/" || ((e.metaKey || e.ctrlKey) && e.key === "k")) && 
          document.activeElement.tagName !== "INPUT" && 
          document.activeElement.tagName !== "TEXTAREA") {
        e.preventDefault();
        this.dom.searchInput.focus();
        this.dom.searchInput.select();
      }

      // Escape para cerrar cualquier modal abierto
      if (e.key === "Escape") {
        this.closeAllModals();
      }
    });
  }

  // ==================== NAVEGACIÓN Y RENDER ====================

  renderCategoryNav() {
    this.dom.categoryContainer.innerHTML = "";

    CATEGORIES.forEach(cat => {
      let count = 0;
      if (cat.id === "todas") {
        count = OSINT_TOOLS.length;
      } else {
        count = OSINT_TOOLS.filter(t => t.category === cat.id).length;
      }

      const isActive = (this.state.category === cat.id) && !this.state.onlyFavorites;
      const btn = document.createElement("button");
      btn.className = `cat-pill-btn ${isActive ? "active" : ""}`;
      btn.innerHTML = `
        <span class="cat-icon">${cat.icon}</span>
        <span>${cat.name}</span>
        <span class="cat-count-badge">${count}</span>
      `;

      btn.addEventListener("click", () => {
        this.state.category = cat.id;
        this.state.onlyFavorites = false;
        this.dom.favToggleBtn.classList.remove("primary");
        this.syncUrlHash();
        this.renderCategoryNav();
        this.renderTools();
      });

      this.dom.categoryContainer.appendChild(btn);
    });
  }

  getFilteredTools() {
    return OSINT_TOOLS.filter(tool => {
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

      // Búsqueda por texto (full-text indexado)
      if (this.state.search) {
        const query = this.state.search;
        const searchCorpus = `
          ${tool.name} 
          ${tool.summary} 
          ${tool.practicalTip} 
          ${tool.categoryLabel} 
          ${tool.tags.join(" ")} 
          ${tool.keyFeatures.join(" ")}
        `.toLowerCase();

        return searchCorpus.includes(query);
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
                        this.state.onlyFavorites);

    this.dom.resetFiltersBtn.style.display = isFiltered ? "inline-block" : "none";

    if (tools.length === 0) {
      this.renderEmptyState();
      return;
    }

    if (this.state.viewMode === "grid") {
      this.renderGridView(tools);
    } else {
      this.renderTableView(tools);
    }
  }

  renderGridView(tools) {
    this.dom.toolsGrid.style.display = "grid";
    this.dom.toolsTable.style.display = "none";
    this.dom.toolsGrid.innerHTML = "";

    tools.forEach(tool => {
      const isFav = this.state.favorites.has(tool.id);
      const card = document.createElement("article");
      card.className = "tool-card";

      // Clase CSS de Coste
      const costClass = `cost-${tool.cost.toLowerCase().replace(/\s+/g, "-")}`;

      // Badge de OPSEC
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
            <span>Abrir Herramienta</span>
            <span>→</span>
          </a>
          <button class="btn-icon-action" data-detail-id="${tool.id}" title="Ver expediente y análisis completo">
            📋
          </button>
          <button class="btn-icon-action" data-copy-url="${tool.url}" title="Copiar enlace verificado">
            🔗
          </button>
        </div>
      `;

      // Eventos internos de tarjeta
      card.querySelector("[data-fav-id]").addEventListener("click", (e) => {
        e.stopPropagation();
        this.toggleFavorite(tool.id);
      });

      card.querySelector("[data-copy-url]").addEventListener("click", (e) => {
        e.stopPropagation();
        this.copyToClipboard(tool.url, "Enlace directo copiado al portapapeles");
      });

      card.querySelector("[data-detail-id]").addEventListener("click", (e) => {
        e.stopPropagation();
        this.openDetailModal(tool);
      });

      this.dom.toolsGrid.appendChild(card);
    });
  }

  renderTableView(tools) {
    this.dom.toolsGrid.style.display = "none";
    this.dom.toolsTable.style.display = "block";

    const tbody = document.getElementById("tools-table-tbody");
    tbody.innerHTML = "";

    tools.forEach(tool => {
      const isFav = this.state.favorites.has(tool.id);
      const costClass = `cost-${tool.cost.toLowerCase().replace(/\s+/g, "-")}`;
      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td>
          <button class="btn-star-fav ${isFav ? 'is-fav' : ''}" data-fav-id="${tool.id}">
            ${isFav ? '★' : '☆'}
          </button>
        </td>
        <td class="table-tool-name">
          <a href="${tool.url}" target="_blank" rel="noopener noreferrer">
            ${tool.name} ↗
          </a>
        </td>
        <td><span class="meta-pill">${tool.categoryLabel}</span></td>
        <td><span class="cost-badge ${costClass}">${tool.cost}</span></td>
        <td><span class="meta-pill">${tool.level}</span></td>
        <td><span class="meta-pill ${tool.opsec.includes('Seguro') ? 'opsec-safe' : 'opsec-warn'}">${tool.opsec}</span></td>
        <td class="table-summary-cell">${tool.summary}</td>
        <td>
          <div style="display:flex; gap:0.4rem;">
            <button class="btn-icon-action" data-detail-id="${tool.id}" title="Detalles">📋</button>
            <button class="btn-icon-action" data-copy-url="${tool.url}" title="Copiar URL">🔗</button>
          </div>
        </td>
      `;

      tr.querySelector("[data-fav-id]").addEventListener("click", () => this.toggleFavorite(tool.id));
      tr.querySelector("[data-copy-url]").addEventListener("click", () => this.copyToClipboard(tool.url, "Enlace copiado"));
      tr.querySelector("[data-detail-id]").addEventListener("click", () => this.openDetailModal(tool));

      tbody.appendChild(tr);
    });
  }

  renderEmptyState() {
    this.dom.toolsGrid.style.display = "grid";
    this.dom.toolsTable.style.display = "none";
    this.dom.toolsGrid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔍</div>
        <h3>No se encontraron herramientas</h3>
        <p>No hay coincidencias para los filtros activos o el término "${this.state.search}". Intenta con sinónimos o restablece los criterios.</p>
        <button class="btn-header primary" id="btn-empty-reset">
          Restablecer todos los filtros
        </button>
      </div>
    `;

    document.getElementById("btn-empty-reset").addEventListener("click", () => this.resetAllFilters());
  }

  escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  highlightMatch(text) {
    if (!text) return "";
    const safeText = this.escapeHtml(text);
    if (!this.state.search) return safeText;
    const regex = new RegExp(`(${this.escapeRegex(this.escapeHtml(this.state.search))})`, "gi");
    return safeText.replace(regex, `<mark style="background:#fef08a; padding:0 2px; border-radius:2px;">$1</mark>`);
  }

  escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // ==================== WORKFLOWS HERO ====================

  renderWorkflowWidget() {
    if (!this.dom.workflowSelect || !this.dom.workflowStepsList) return;

    // Poblar select si está vacío
    if (this.dom.workflowSelect.children.length === 0) {
      WORKFLOWS.forEach(wf => {
        const opt = document.createElement("option");
        opt.value = wf.id;
        opt.textContent = `${wf.icon} ${wf.title}`;
        this.dom.workflowSelect.appendChild(opt);
      });
    }

    const currentWf = WORKFLOWS.find(w => w.id === this.state.activeWorkflow) || WORKFLOWS[0];
    this.dom.workflowSelect.value = currentWf.id;

    this.dom.workflowStepsList.innerHTML = currentWf.steps.map(step => {
      const tool = OSINT_TOOLS.find(t => t.id === step.toolId);
      const toolUrl = tool ? tool.url : "#";

      return `
        <div class="workflow-step-row" data-step-tool-id="${step.toolId}">
          <div class="step-main">
            <span class="step-num-badge">${step.step}</span>
            <div class="step-content">
              <a href="${toolUrl}" target="_blank" rel="noopener noreferrer" class="workflow-tool-link" title="Abrir sitio oficial de ${step.name}">
                <strong>${step.name}</strong>
                <span class="step-ext-arrow">↗</span>
              </a>
              <span class="step-action-desc">${step.action}</span>
            </div>
          </div>
          <div class="step-actions">
            <a href="${toolUrl}" target="_blank" rel="noopener noreferrer" class="btn-step-open" title="Abrir sitio oficial de ${step.name}">
              <span>Abrir</span>
              <span>↗</span>
            </a>
            ${tool ? `<button class="btn-step-info" data-step-info-id="${step.toolId}" title="Ver expediente de ${step.name}">ℹ</button>` : ""}
          </div>
        </div>
      `;
    }).join("");

    // Conectar eventos de modal de detalle para los botones de información en los pasos
    this.dom.workflowStepsList.querySelectorAll("[data-step-info-id]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const toolId = btn.dataset.stepInfoId;
        const tool = OSINT_TOOLS.find(t => t.id === toolId);
        if (tool) {
          this.openDetailModal(tool);
        }
      });
    });
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
        <strong>🎯 Caso de Uso Táctico Recomendado:</strong>
        ${tool.practicalTip}
      </div>

      <div>
        <h4 class="modal-section-title">Capacidades Operativas Clave</h4>
        <ul class="modal-features-list">
          ${tool.keyFeatures.map(f => `<li>${f}</li>`).join("")}
        </ul>
      </div>

      <div>
        <h4 class="modal-section-title">Etiquetas de Búsqueda</h4>
        <div style="display:flex; flex-wrap:wrap; gap:0.4rem;">
          ${tool.tags.map(t => `<span class="meta-pill">#${t}</span>`).join("")}
        </div>
      </div>

      ${tool.directQueryUrl ? `
        <div style="background:var(--bg-subtle); padding:1rem; border-radius:var(--radius-md); border:1px solid var(--border-subtle);">
          <h4 class="modal-section-title" style="margin-bottom:0.4rem;">⚡ Ejecución Directa con Objetivo</h4>
          <div style="display:flex; gap:0.5rem;">
            <input type="text" id="modal-direct-target-input" placeholder="Introduce target (ej: objetivo.com, usuario, IP)..." class="main-search-input" style="padding:0.5rem 0.8rem; font-size:0.8rem;">
            <button id="modal-direct-launch-btn" class="btn-header primary" style="white-space:nowrap;">Lanzar ↗</button>
          </div>
        </div>
      ` : ''}
    `;

    // Listener para lanzamiento directo si existe
    if (tool.directQueryUrl) {
      const launchBtn = document.getElementById("modal-direct-launch-btn");
      const targetIn = document.getElementById("modal-direct-target-input");
      launchBtn.addEventListener("click", () => {
        const val = encodeURIComponent(targetIn.value.trim() || "");
        if (!val) {
          this.showToast("Introduce un objetivo para la consulta", "info");
          return;
        }
        const finalUrl = tool.directQueryUrl.replace("%QUERY%", val);
        window.open(finalUrl, "_blank", "noopener,noreferrer");
      });
    }

    this.dom.detailModal.classList.add("is-open");
  }

  openDorkModal() {
    this.dom.dorkModal.classList.add("is-open");
    if (this.dom.dorkTargetInput) {
      this.dom.dorkTargetInput.focus();
      this.renderDorksList();
    }
  }

  renderDorksList() {
    if (!this.dom.dorkResultsList) return;
    const target = this.dom.dorkTargetInput.value.trim() || "OBJETIVO";

    this.dom.dorkResultsList.innerHTML = OSINT_DORKS.map((dork, idx) => {
      const compiledSyntax = dork.syntax.replace("%QUERY%", target);
      const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(compiledSyntax)}`;

      return `
        <div class="dork-card-row">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:0.82rem; font-weight:800; color:var(--text-main);">${dork.title}</span>
            <span class="meta-pill" style="font-size:0.65rem;">Google Dork</span>
          </div>
          <p style="font-size:0.75rem; color:var(--text-muted);">${dork.tip}</p>
          <div class="dork-syntax-box">
            <code style="word-break:break-all;">${compiledSyntax}</code>
            <div style="display:flex; gap:0.4rem; flex-shrink:0;">
              <button class="btn-header" style="padding:0.25rem 0.5rem; font-size:0.7rem;" data-copy-dork="${encodeURIComponent(compiledSyntax)}">
                Copiar
              </button>
              <a href="${googleSearchUrl}" target="_blank" rel="noopener noreferrer" class="btn-header primary" style="padding:0.25rem 0.5rem; font-size:0.7rem;">
                Abrir en Google ↗
              </a>
            </div>
          </div>
        </div>
      `;
    }).join("");

    // Listeners para copiar dorks
    this.dom.dorkResultsList.querySelectorAll("[data-copy-dork]").forEach(btn => {
      btn.addEventListener("click", () => {
        const text = decodeURIComponent(btn.dataset.copyDork);
        this.copyToClipboard(text, "Sintaxis de Google Dork copiada");
      });
    });
  }

  openCaseExportModal() {
    const favsList = OSINT_TOOLS.filter(t => this.state.favorites.has(t.id));

    if (favsList.length === 0) {
      this.showToast("Marca primero herramientas con ★ para exportar tu kit de investigación", "info");
      return;
    }

    const markdownReport = `
# EXPEDIENTE OSINT - KIT DE HERRAMIENTAS SELECCIONADAS
Generado el: ${new Date().toLocaleDateString('es-ES')}
Total de herramientas activas: ${favsList.length}

${favsList.map((t, idx) => `
### ${idx + 1}. [${t.name}](${t.url})
- **Categoría:** ${t.categoryLabel}
- **Coste:** ${t.cost} | **Nivel:** ${t.level} | **OPSEC:** ${t.opsec}
- **Función Principal:** ${t.summary}
- **Tip Operativo:** ${t.practicalTip}
`).join("\n---\n")}
    `.trim();

    this.dom.caseExportContent.value = markdownReport;
    this.dom.caseExportModal.classList.add("is-open");
  }

  closeAllModals() {
    document.querySelectorAll(".modal-backdrop").forEach(m => m.classList.remove("is-open"));
  }

  // ==================== FAVORITOS & ESTADO ====================

  toggleFavorite(toolId) {
    if (this.state.favorites.has(toolId)) {
      this.state.favorites.delete(toolId);
      this.showToast("Eliminado de tu kit de investigación", "info");
    } else {
      this.state.favorites.add(toolId);
      this.showToast("Añadido a tus favoritos ★", "success");
    }

    localStorage.setItem("osint_favs_v2", JSON.stringify(Array.from(this.state.favorites)));
    this.updateCounters();
    this.renderTools();
  }

  updateCounters() {
    this.dom.favBadgeCount.textContent = this.state.favorites.size;
    const tickerLeft = document.querySelector(".top-ticker-left span:last-child");
    if (tickerLeft) {
      tickerLeft.textContent = `OSINT Hub Español • ${OSINT_TOOLS.length} Herramientas verificadas y categorizadas para analistas tácticos`;
    }
    const heroMetricVal = document.querySelector(".hero-metrics .metric-val");
    if (heroMetricVal) {
      heroMetricVal.textContent = `${OSINT_TOOLS.length}+`;
    }
  }

  switchView(mode) {
    this.state.viewMode = mode;
    localStorage.setItem("osint_view_mode", mode);
    this.dom.viewGridBtn.classList.toggle("active", mode === "grid");
    this.dom.viewTableBtn.classList.toggle("active", mode === "table");
    this.renderTools();
  }

  resetAllFilters() {
    this.state.category = "todas";
    this.state.cost = "todos";
    this.state.level = "todos";
    this.state.opsec = "todos";
    this.state.search = "";
    this.state.onlyFavorites = false;

    this.dom.searchInput.value = "";
    this.dom.clearSearchBtn.style.display = "none";
    this.dom.favToggleBtn.classList.remove("primary");

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
  }

  // ==================== UTILIDADES ====================

  copyToClipboard(text, msg = "Copiado al portapapeles") {
    navigator.clipboard.writeText(text).then(() => {
      this.showToast(msg, "success");
    }).catch(() => {
      this.showToast("No se pudo copiar automáticamente", "info");
    });
  }

  showToast(message, type = "success") {
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.innerHTML = `
      <span class="toast-icon">${type === 'success' ? '✓' : '★'}</span>
      <span>${message}</span>
    `;

    this.dom.toastContainer.appendChild(toast);
    setTimeout(() => toast.classList.add("show"), 10);

    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 250);
    }, 2800);
  }

  syncUrlHash() {
    const params = new URLSearchParams();
    if (this.state.category !== "todas") params.set("cat", this.state.category);
    if (this.state.search) params.set("q", this.state.search);

    const hashString = params.toString();
    window.location.hash = hashString ? `#${hashString}` : "";
  }

  parseUrlHash() {
    if (!window.location.hash) return;
    const cleanHash = window.location.hash.replace(/^#/, "");
    const params = new URLSearchParams(cleanHash);

    if (params.has("cat")) {
      this.state.category = params.get("cat");
    }
    if (params.has("q")) {
      this.state.search = params.get("q").toLowerCase();
      this.dom.searchInput.value = params.get("q");
      this.dom.clearSearchBtn.style.display = "flex";
    }
  }
}

// Inicializar la aplicación al cargar el DOM
document.addEventListener("DOMContentLoaded", () => {
  window.app = new OsintHubApp();

  // Listeners globales para modales
  document.getElementById("btn-open-dork-builder")?.addEventListener("click", () => {
    window.app.openDorkModal();
  });

  document.getElementById("btn-export-dossier")?.addEventListener("click", () => {
    window.app.openCaseExportModal();
  });

  document.querySelectorAll("[data-close-modal]").forEach(btn => {
    btn.addEventListener("click", () => window.app.closeAllModals());
  });

  document.querySelectorAll(".modal-backdrop").forEach(backdrop => {
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) window.app.closeAllModals();
    });
  });

  document.getElementById("btn-copy-case-markdown")?.addEventListener("click", () => {
    const text = document.getElementById("case-export-textarea").value;
    window.app.copyToClipboard(text, "Expediente copiado en formato Markdown");
  });
});
