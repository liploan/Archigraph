/* ==========================================================================
   Archigraph JS Client - Temporal Diff Engine, Org Tree & Relationship Mesh
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  // Page Elements
  const extractForm = document.getElementById("extract-form");
  const urlInput = document.getElementById("url-input");
  const limitSelect = document.getElementById("limit-select");
  const submitBtn = document.getElementById("submit-btn");
  const btnLoader = document.getElementById("btn-loader");

  const displayDomain = document.getElementById("display-domain");
  const displayDate = document.getElementById("display-date");
  const diffKpiBar = document.getElementById("diff-kpi-bar");
  const nodeSearchInput = document.getElementById("node-search");
  const searchMatchCount = document.getElementById("search-match-count");

  const modeTreeBtn = document.getElementById("mode-tree-btn");
  const modeMeshBtn = document.getElementById("mode-mesh-btn");
  const toggleDepartedBtn = document.getElementById("toggle-departed-btn");
  const toggleRadarBtn = document.getElementById("toggle-radar-btn");
  const toggleJobsBtn = document.getElementById("toggle-jobs-btn");
  const openPortfolioBtn = document.getElementById("open-portfolio-btn");
  const openNetworkBtn = document.getElementById("open-network-btn");
  const networkMatchPill = document.getElementById("network-match-pill");
  const expandAllBtn = document.getElementById("expand-all-btn");
  const canvasLegend = document.getElementById("canvas-legend");

  const exportMenuBtn = document.getElementById("export-menu-btn");
  const exportPopover = document.getElementById("export-popover");
  const exportBriefBtn = document.getElementById("export-brief-btn");
  const exportJsonBtn = document.getElementById("export-json-btn");
  const exportCsvBtn = document.getElementById("export-csv-btn");
  const exportSvgBtn = document.getElementById("export-svg-btn");

  const intelHubSection = document.getElementById("intel-hub-section");
  const intelEraSubtitle = document.getElementById("intel-era-subtitle");
  const intelTabs = document.getElementById("intel-tabs");
  const tabVcBtn = document.getElementById("tab-vc-btn");
  const tabRecruitingBtn = document.getElementById("tab-recruiting-btn");
  const tabHiringBtn = document.getElementById("tab-hiring-btn");
  const tabNetworkBtn = document.getElementById("tab-network-btn");
  const panelVc = document.getElementById("panel-vc");
  const panelRecruiting = document.getElementById("panel-recruiting");
  const panelHiring = document.getElementById("panel-hiring");
  const panelNetwork = document.getElementById("panel-network");
  const vcIntelContent = document.getElementById("vc-intel-content");
  const recruitingIntelContent = document.getElementById("recruiting-intel-content");
  const hiringIntelContent = document.getElementById("hiring-intel-content");
  const networkIntelContent = document.getElementById("network-intel-content");

  const canvasContainer = document.getElementById("canvas-container");
  const placeholderView = document.getElementById("placeholder-view");
  const loadingView = document.getElementById("loading-view");
  const loadingStatus = document.getElementById("loading-status");

  const profileEmpty = document.getElementById("profile-empty");
  const profileCard = document.getElementById("profile-card");
  const profAvatar = document.getElementById("prof-avatar");
  const profName = document.getElementById("prof-name");
  const profDiffBadge = document.getElementById("prof-diff-badge");
  const profDiffSummary = document.getElementById("prof-diff-summary");
  const profTitle = document.getElementById("prof-title");
  const profDept = document.getElementById("prof-dept");
  const profManager = document.getElementById("prof-manager");
  const profConfidence = document.getElementById("prof-confidence");
  const profCrossOrgBlock = document.getElementById("prof-cross-org-block");
  const profCrossOrgList = document.getElementById("prof-cross-org-list");
  const profRecruitingBlock = document.getElementById("prof-recruiting-block");
  const profPoachPill = document.getElementById("prof-poach-pill");
  const profPoachTriggers = document.getElementById("prof-poach-triggers");
  const profNetworkBlock = document.getElementById("prof-network-block");
  const profNetworkList = document.getElementById("prof-network-list");
  const profEvidence = document.getElementById("prof-evidence");
  const profSourceLink = document.getElementById("prof-source-link");
  const profBio = document.getElementById("prof-bio");
  const profSkills = document.getElementById("prof-skills");
  const profCareerBlock = document.getElementById("prof-career-block");
  const profCareerTimeline = document.getElementById("prof-career-timeline");
  const traceFromRootBtn = document.getElementById("trace-from-root-btn");
  const simulateDepartureBtn = document.getElementById("simulate-departure-btn");
  const profSimulationBlock = document.getElementById("prof-simulation-block");
  const profSimPill = document.getElementById("prof-sim-pill");
  const profSimSummary = document.getElementById("prof-sim-summary");
  const profSimDetails = document.getElementById("prof-sim-details");

  const diffSection = document.getElementById("diff-section");
  const diffSubtitle = document.getElementById("diff-subtitle");
  const diffAccordions = document.getElementById("diff-accordions");

  const warmPathSection = document.getElementById("warm-path-section");
  const warmSourceSelect = document.getElementById("warm-source-select");
  const warmTargetSelect = document.getElementById("warm-target-select");
  const findPathBtn = document.getElementById("find-path-btn");
  const clearPathBtn = document.getElementById("clear-path-btn");
  const warmPathResult = document.getElementById("warm-path-result");

  const playBtn = document.getElementById("play-btn");
  const playIcon = playBtn.querySelector(".play-icon");
  const pauseIcon = playBtn.querySelector(".pause-icon");
  const timelineSlider = document.getElementById("timeline-slider");
  const timelineTicks = document.getElementById("timeline-ticks");
  const sampleBanner = document.getElementById("sample-banner");

  const networkDialog = document.getElementById("network-dialog");
  const loadSampleNetworkBtn = document.getElementById("load-sample-network-btn");
  const clearNetworkBtn = document.getElementById("clear-network-btn");
  const networkForm = document.getElementById("network-form");
  const networkCsvFile = document.getElementById("network-csv-file");
  const networkPasteInput = document.getElementById("network-paste-input");
  const networkFormStatus = document.getElementById("network-form-status");

  const portfolioDialog = document.getElementById("portfolio-dialog");
  const portfolioKpiStrip = document.getElementById("portfolio-kpi-strip");
  const portfolioSortStatus = document.getElementById("portfolio-sort-status");
  const portfolioTable = document.getElementById("portfolio-table");
  const portfolioTbody = document.getElementById("portfolio-tbody");
  const portfolioFlowsList = document.getElementById("portfolio-flows-list");

  const openAlertsBtn = document.getElementById("open-alerts-btn");
  const alertsCountPill = document.getElementById("alerts-count-pill");
  const alertsDialog = document.getElementById("alerts-dialog");
  const alertSwitchesRow = document.getElementById("alert-switches-row");
  const alertsFeedList = document.getElementById("alerts-feed-list");
  const alertsFeedHeading = document.getElementById("alerts-feed-heading");
  const webhookFmtSlackBtn = document.getElementById("webhook-fmt-slack");
  const webhookFmtCrmBtn = document.getElementById("webhook-fmt-crm");
  const webhookPayloadCode = document.getElementById("webhook-payload-code");

  // Global State
  let historicalSnapshots = [];
  let currentSnapshotIndex = 0;
  let selectedNodeId = null;
  let currentManagerTargetId = null;
  let viewMode = "tree"; // "tree" | "mesh"
  let showDeparted = false;
  let showPoachabilityRadar = false;
  let showOpenRoles = false;
  let collapsedNodeIds = new Set();
  let searchMatchIds = [];
  let searchMatchCursor = 0;
  let isPlaying = false;
  let playInterval = null;
  let activeSimulation = null;
  let userContacts = [];
  let networkMatchReport = null;

  // D3 Canvas references
  let svg = null;
  let g = null;
  let zoomBehavior = null;

  // Deployment capabilities (live extraction may be disabled on hosted instances)
  let liveEnabled = true;

  fetch("/api/config")
    .then(r => r.json())
    .then(cfg => {
      liveEnabled = !!cfg.live_extraction;
      if (!liveEnabled) {
        urlInput.value = "";
        urlInput.disabled = true;
        limitSelect.disabled = true;
        submitBtn.disabled = true;
        urlInput.placeholder = "Live extraction disabled. Select a demo above.";
      }
    })
    .catch(() => {});

  async function apiJson(url, options) {
    const response = await fetch(url, options);
    let body = {};
    try { body = await response.json(); } catch (_) { /* non-JSON error body */ }
    if (!response.ok) {
      const err = new Error(body.error || `Request failed (${response.status})`);
      err.status = response.status;
      throw err;
    }
    return body;
  }

  async function extractLive(targetUrl, limit, retried = false) {
    const headers = { "Content-Type": "application/json" };
    const token = sessionStorage.getItem("archigraph_token");
    if (token) headers["X-Access-Token"] = token;
    try {
      return await apiJson("/api/extract", {
        method: "POST",
        headers,
        body: JSON.stringify({ url: targetUrl, limit: parseInt(limit, 10) })
      });
    } catch (err) {
      if (err.status === 401 && !retried) {
        const entered = window.prompt("Enter the access token for live extraction:");
        if (entered) {
          sessionStorage.setItem("archigraph_token", entered.trim());
          return extractLive(targetUrl, limit, true);
        }
      }
      throw err;
    }
  }

  function showBanner(result) {
    let text = result.note || "";
    let info = false;
    if (!result.sample_data) {
      text = (text ? text + " " : "") +
        "Extracted automatically by an LLM; dashed lines indicate inferred reporting relationships.";
      info = true;
    } else if (result.sample_data === "extracted") {
      info = true;
    }
    sampleBanner.innerText = text;
    sampleBanner.classList.toggle("info", info);
    sampleBanner.classList.toggle("hidden", !text);
  }

  // Shared loader for live extraction and demos
  async function loadResult(fetcher, focusOpts = null) {
    sampleBanner.classList.add("hidden");
    setLoadingState(true);
    resetState();

    try {
      const result = await fetcher();

      historicalSnapshots = result.data || [];
      if (result.hiring_signals && historicalSnapshots.length > 0) {
        const lastSnap = historicalSnapshots[historicalSnapshots.length - 1];
        if (!lastSnap.hiring_signals) {
          lastSnap.hiring_signals = result.hiring_signals;
        }
      }
      displayDomain.innerText = result.domain || "Unknown";
      showBanner(result);

      setupTimeline();
      if (intelHubSection) intelHubSection.classList.remove("hidden");
      if (toggleRadarBtn) toggleRadarBtn.disabled = false;
      if (userContacts.length > 0) {
        await refreshNetworkMatches();
      }
      if (focusOpts?.forceShowDeparted) {
        showDeparted = true;
        toggleDepartedBtn.setAttribute("aria-pressed", "true");
      }
      selectSnapshot(historicalSnapshots.length > 1 ? historicalSnapshots.length - 1 : 0);

      nodeSearchInput.disabled = false;
      if (exportMenuBtn) exportMenuBtn.disabled = false;
      canvasLegend.classList.remove("hidden");
      warmPathSection.classList.remove("hidden");
      setLoadingState(false);

      if (focusOpts?.entityId) {
        selectNodeById(focusOpts.entityId);
        zoomToNodeById(focusOpts.entityId);
      }
    } catch (err) {
      alert(`Pipeline Failed: ${err.message}`);
      setLoadingState(false);
      resetToPlaceholder();
    }
  }

  function loadOrganizationByKey(loadKind, orgKey, focusEntityId = null, forceShowDeparted = false) {
    document.querySelectorAll(".demo-pill").forEach(p => {
      p.classList.toggle("active", loadKind === "demo" && p.getAttribute("data-demo") === orgKey);
    });
    const endpoint = loadKind === "demo"
      ? `/api/demo/${encodeURIComponent(orgKey)}`
      : `/api/extracted/${encodeURIComponent(orgKey)}`;
    loadingStatus.innerText = "Loading organizational snapshots & cross-org intelligence...";
    loadResult(() => apiJson(endpoint), {
      entityId: focusEntityId,
      forceShowDeparted: !!forceShowDeparted,
    });
  }

  // Handle Form Submission (live extraction)
  extractForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!liveEnabled) return;
    const targetUrl = urlInput.value.trim();
    if (!targetUrl) return;
    document.querySelectorAll(".demo-pill").forEach(p => p.classList.remove("active"));
    loadingStatus.innerText = "Querying CDX index and extracting historical pages...";
    loadResult(() => extractLive(targetUrl, limitSelect.value));
  });

  // View Mode Toggle Handlers
  modeTreeBtn.addEventListener("click", () => {
    if (viewMode === "tree") return;
    viewMode = "tree";
    modeTreeBtn.setAttribute("aria-pressed", "true");
    modeMeshBtn.setAttribute("aria-pressed", "false");
    renderCurrentSnapshotCanvas();
  });

  modeMeshBtn.addEventListener("click", () => {
    if (viewMode === "mesh") return;
    viewMode = "mesh";
    modeMeshBtn.setAttribute("aria-pressed", "true");
    modeTreeBtn.setAttribute("aria-pressed", "false");
    renderCurrentSnapshotCanvas();
  });

  toggleDepartedBtn.addEventListener("click", () => {
    showDeparted = !showDeparted;
    toggleDepartedBtn.setAttribute("aria-pressed", showDeparted ? "true" : "false");
    renderCurrentSnapshotCanvas();
  });

  if (toggleRadarBtn) {
    toggleRadarBtn.addEventListener("click", () => {
      showPoachabilityRadar = !showPoachabilityRadar;
      toggleRadarBtn.setAttribute("aria-pressed", showPoachabilityRadar ? "true" : "false");
      renderCurrentSnapshotCanvas();
    });
  }

  if (toggleJobsBtn) {
    toggleJobsBtn.addEventListener("click", () => {
      showOpenRoles = !showOpenRoles;
      toggleJobsBtn.setAttribute("aria-pressed", showOpenRoles ? "true" : "false");
      renderCurrentSnapshotCanvas();
    });
  }

  if (expandAllBtn) {
    expandAllBtn.addEventListener("click", () => {
      collapsedNodeIds.clear();
      updateExpandAllButton();
      renderCurrentSnapshotCanvas();
    });
  }

  function updateExpandAllButton() {
    if (!expandAllBtn) return;
    const shouldShow = viewMode === "tree" && collapsedNodeIds.size > 0;
    expandAllBtn.classList.toggle("hidden", !shouldShow);
    if (shouldShow) {
      expandAllBtn.innerText = `Expand All (${collapsedNodeIds.size})`;
    }
  }

  // Manager click handler (bound once using addEventListener)
  profManager.addEventListener("click", () => {
    if (!currentManagerTargetId) return;
    selectNodeById(currentManagerTargetId);
  });

  // Trace Warm Path from Root Executive button inside Profile Card
  traceFromRootBtn.addEventListener("click", () => {
    const snap = historicalSnapshots[currentSnapshotIndex];
    if (!snap || !selectedNodeId) return;
    const rootEntity = findRootEntity(snap.entities);
    if (!rootEntity) return;
    warmSourceSelect.value = rootEntity.id;
    warmTargetSelect.value = selectedNodeId;
    runWarmPathFinder();
  });

  findPathBtn.addEventListener("click", () => {
    runWarmPathFinder();
  });

  clearPathBtn.addEventListener("click", () => {
    clearWarmPathHighlight();
  });

  function setLoadingState(isLoading) {
    if (isLoading) {
      submitBtn.disabled = true;
      btnLoader.classList.remove("hidden");
      loadingView.classList.remove("hidden");
      placeholderView.classList.add("hidden");
      clearCanvas();
    } else {
      submitBtn.disabled = !liveEnabled;
      btnLoader.classList.add("hidden");
      loadingView.classList.add("hidden");
    }
  }

  function clearCanvas() {
    if (activeSimulation) {
      activeSimulation.stop();
      activeSimulation = null;
    }
    canvasContainer.querySelectorAll("svg").forEach(s => s.remove());
  }

  function resetState() {
    historicalSnapshots = [];
    currentSnapshotIndex = 0;
    selectedNodeId = null;
    currentManagerTargetId = null;
    showDeparted = false;
    collapsedNodeIds.clear();
    searchMatchIds = [];
    searchMatchCursor = 0;
    updateExpandAllButton();
    toggleDepartedBtn.setAttribute("aria-pressed", "false");
    toggleDepartedBtn.disabled = true;
    if (toggleRadarBtn) {
      showPoachabilityRadar = false;
      toggleRadarBtn.setAttribute("aria-pressed", "false");
      toggleRadarBtn.disabled = true;
    }
    if (toggleJobsBtn) {
      showOpenRoles = false;
      toggleJobsBtn.setAttribute("aria-pressed", "false");
      toggleJobsBtn.innerText = "Open Roles";
      toggleJobsBtn.disabled = true;
    }
    if (intelHubSection) intelHubSection.classList.add("hidden");
    networkMatchReport = null;
    updateNetworkPill();
    if (exportMenuBtn) exportMenuBtn.disabled = true;
    stopPlayback();
    playBtn.disabled = true;
    timelineSlider.disabled = true;
    timelineTicks.innerHTML = "";
    diffKpiBar.innerHTML = "";
    diffKpiBar.classList.add("hidden");
    diffSection.classList.add("hidden");
    warmPathSection.classList.add("hidden");
    warmPathResult.classList.add("hidden");
    canvasLegend.classList.add("hidden");
    nodeSearchInput.value = "";
    nodeSearchInput.disabled = true;
    if (searchMatchCount) {
      searchMatchCount.innerText = "";
      searchMatchCount.classList.add("hidden");
    }
    showProfileDetails(null);
  }

  function resetToPlaceholder() {
    placeholderView.classList.remove("hidden");
    displayDomain.innerText = "No active target";
    displayDate.classList.add("hidden");
  }

  // ==========================================================================
  // Timeline Slider Setup & Snapshot Selection
  // ==========================================================================
  function setupTimeline() {
    if (historicalSnapshots.length <= 1) {
      timelineSlider.disabled = true;
      playBtn.disabled = true;
      timelineSlider.max = 0;
      timelineSlider.value = 0;

      if (historicalSnapshots.length === 1) {
        renderTickMarks([formatTimestamp(historicalSnapshots[0].snapshot_timestamp)]);
      }
      return;
    }

    timelineSlider.disabled = false;
    playBtn.disabled = false;
    timelineSlider.max = historicalSnapshots.length - 1;

    const formattedDates = historicalSnapshots.map(snap => formatTimestamp(snap.snapshot_timestamp));
    renderTickMarks(formattedDates);
  }

  function renderTickMarks(labels) {
    timelineTicks.innerHTML = "";
    labels.forEach((label, idx) => {
      const mark = document.createElement("button");
      mark.type = "button";
      mark.className = `tick-mark ${idx === currentSnapshotIndex ? "active" : ""}`;
      mark.innerText = label;
      mark.addEventListener("click", () => {
        timelineSlider.value = idx;
        selectSnapshot(idx);
      });
      timelineTicks.appendChild(mark);
    });
  }

  timelineSlider.addEventListener("input", (e) => {
    selectSnapshot(parseInt(e.target.value, 10));
  });

  function getEffectiveEntities(snap) {
    if (!snap) return [];
    const base = (snap.entities || []).map(e => ({ ...e, _isDeparted: false }));
    const existingIds = new Set(base.map(e => e.id));
    if (showDeparted && snap.diff_summary && Array.isArray(snap.diff_summary.departed)) {
      snap.diff_summary.departed.forEach(dep => {
        if (!existingIds.has(dep.id)) {
          existingIds.add(dep.id);
          base.push({ ...dep, _isDeparted: true });
        }
      });
    }
    if (showOpenRoles && snap.hiring_signals && Array.isArray(snap.hiring_signals.graph_open_nodes)) {
      snap.hiring_signals.graph_open_nodes.forEach(jobNode => {
        if (!existingIds.has(jobNode.id)) {
          existingIds.add(jobNode.id);
          base.push({ ...jobNode, _isOpenRole: true });
        }
      });
    }
    return base;
  }

  function selectSnapshot(index) {
    currentSnapshotIndex = index;
    timelineSlider.value = index;

    const ticks = timelineTicks.querySelectorAll(".tick-mark");
    ticks.forEach((tick, i) => {
      tick.classList.toggle("active", i === index);
    });

    const snap = historicalSnapshots[index];
    if (!snap) return;

    const dateStr = formatTimestamp(snap.snapshot_timestamp);
    displayDate.innerText = dateStr;
    displayDate.classList.remove("hidden");

    const departedCount = snap.diff_summary?.counts?.departed || 0;
    toggleDepartedBtn.disabled = departedCount === 0;
    toggleDepartedBtn.innerText = departedCount > 0 ? `Show Departed (${departedCount})` : "Show Departed";

    if (toggleJobsBtn) {
      const openCount = snap.hiring_signals?.graph_open_nodes?.length || 0;
      toggleJobsBtn.disabled = openCount === 0;
      toggleJobsBtn.innerText = openCount > 0 ? `Open Roles (${openCount})` : "Open Roles";
    }

    renderDiffKpis(snap, index);
    renderDiffAccordions(snap, index);
    renderIntelligenceHub(snap);
    populateWarmPathSelects(snap);
    renderCurrentSnapshotCanvas();

    // Maintain profile selection if person exists in this snapshot (or departed list)
    if (selectedNodeId) {
      const effective = getEffectiveEntities(snap);
      const match = effective.find(e => e.id === selectedNodeId) ||
        (snap.diff_summary?.departed || []).find(e => e.id === selectedNodeId);
      showProfileDetails(match || null);
    }
  }

  function renderCurrentSnapshotCanvas() {
    const snap = historicalSnapshots[currentSnapshotIndex];
    if (!snap) return;
    const entities = getEffectiveEntities(snap);
    warmPathResult.classList.add("hidden");
    updateExpandAllButton();

    if (viewMode === "mesh") {
      renderMesh(entities);
    } else {
      const treeData = buildHierarchy(entities, snap.organization_name || displayDomain.innerText);
      renderTree(treeData);
    }

    if (selectedNodeId) {
      d3.select(`#node-${CSS.escape(selectedNodeId)}`).classed("selected", true);
    }
    if (nodeSearchInput && nodeSearchInput.value.trim()) {
      applySearchFilter(nodeSearchInput.value, false);
    }
  }

  function renderDiffKpis(snap, index) {
    diffKpiBar.innerHTML = "";
    const counts = snap.diff_summary?.counts;
    if (!counts) {
      diffKpiBar.classList.add("hidden");
      return;
    }

    diffKpiBar.classList.remove("hidden");
    if (index === 0) {
      const pill = document.createElement("span");
      pill.className = "kpi-pill baseline";
      pill.innerText = `${snap.entities.length} Baseline Nodes`;
      diffKpiBar.appendChild(pill);
      return;
    }

    const items = [
      { key: "joined", label: `+${counts.joined} Joined`, val: counts.joined },
      { key: "promoted", label: `↑${counts.promoted} Promoted`, val: counts.promoted },
      { key: "moved", label: `⇄${counts.moved} Moved`, val: counts.moved },
      { key: "departed", label: `−${counts.departed} Departed`, val: counts.departed },
    ];

    items.forEach(item => {
      if (item.val > 0) {
        const pill = document.createElement("span");
        pill.className = `kpi-pill ${item.key}`;
        pill.innerText = item.label;
        diffKpiBar.appendChild(pill);
      }
    });

    if (diffKpiBar.children.length === 0) {
      const pill = document.createElement("span");
      pill.className = "kpi-pill baseline";
      pill.innerText = "No Structural Changes";
      diffKpiBar.appendChild(pill);
    }
  }

  function renderDiffAccordions(snap, index) {
    diffAccordions.innerHTML = "";
    if (index === 0 || !snap.diff_summary) {
      diffSection.classList.add("hidden");
      return;
    }

    const prevSnap = historicalSnapshots[index - 1];
    const prevDate = prevSnap ? formatTimestamp(prevSnap.snapshot_timestamp) : "previous snapshot";
    diffSubtitle.innerText = `Compared to ${prevDate}`;
    diffSection.classList.remove("hidden");

    const groups = [
      { key: "promoted", title: "Promotions & Role Expansions", items: snap.diff_summary.promoted || [] },
      { key: "moved", title: "Re-orgs & Reporting Shifts", items: snap.diff_summary.moved || [] },
      { key: "joined", title: "New Additions", items: snap.diff_summary.joined || [] },
      { key: "departed", title: "Departures", items: snap.diff_summary.departed || [] },
    ];

    let anyRendered = false;
    groups.forEach(group => {
      if (group.items.length === 0) return;
      anyRendered = true;

      const details = document.createElement("details");
      details.className = "diff-group";
      details.open = true;

      const summary = document.createElement("summary");
      const titleSpan = document.createElement("span");
      titleSpan.innerText = group.title;
      const countSpan = document.createElement("span");
      countSpan.className = `diff-badge ${group.key}`;
      countSpan.innerText = String(group.items.length);
      summary.appendChild(titleSpan);
      summary.appendChild(countSpan);
      details.appendChild(summary);

      const list = document.createElement("div");
      list.className = "diff-group-list";

      group.items.forEach(person => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "diff-item-btn";

        const nameEl = document.createElement("span");
        nameEl.className = "diff-item-name";
        nameEl.innerText = person.full_name;

        const metaEl = document.createElement("span");
        metaEl.className = "diff-item-meta";
        metaEl.innerText = person.summary || person.diff?.summary || person.job_title || "";

        btn.appendChild(nameEl);
        btn.appendChild(metaEl);

        btn.addEventListener("click", () => {
          if (group.key === "departed" && !showDeparted) {
            showDeparted = true;
            toggleDepartedBtn.setAttribute("aria-pressed", "true");
            renderCurrentSnapshotCanvas();
          }
          selectNodeById(person.id, person);
        });

        list.appendChild(btn);
      });

      details.appendChild(list);
      diffAccordions.appendChild(details);
    });

    if (!anyRendered) {
      const emptyMsg = document.createElement("p");
      emptyMsg.className = "sidebar-subtitle";
      emptyMsg.innerText = "No leadership changes detected between these snapshots.";
      diffAccordions.appendChild(emptyMsg);
    }
  }

  function formatTimestamp(ts) {
    if (ts === "current" || !ts) return "Current";
    if (ts.length >= 8) {
      const year = ts.substring(0, 4);
      const month = ts.substring(4, 6);
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const mIdx = parseInt(month, 10) - 1;
      if (mIdx >= 0 && mIdx < 12) {
        return `${monthNames[mIdx]} ${year}`;
      }
    }
    return ts;
  }

  // Playback Animation (Time Machine autoplay)
  playBtn.addEventListener("click", () => {
    if (isPlaying) {
      stopPlayback();
    } else {
      startPlayback();
    }
  });

  function startPlayback() {
    isPlaying = true;
    playIcon.classList.add("hidden");
    pauseIcon.classList.remove("hidden");

    playInterval = setInterval(() => {
      let nextIdx = currentSnapshotIndex + 1;
      if (nextIdx >= historicalSnapshots.length) {
        nextIdx = 0;
      }
      selectSnapshot(nextIdx);
    }, 3000);
  }

  function stopPlayback() {
    isPlaying = false;
    playIcon.classList.remove("hidden");
    pauseIcon.classList.add("hidden");
    if (playInterval) {
      clearInterval(playInterval);
      playInterval = null;
    }
  }

  // ==========================================================================
  // Hierarchy Parser Logic
  // ==========================================================================
  function findRootEntity(entities) {
    if (!entities || entities.length === 0) return null;
    const byId = new Set(entities.map(e => e.id));
    const top = entities.find(e => !e.manager_name_or_id || !byId.has(e.manager_name_or_id));
    return top || entities[0];
  }

  function buildHierarchy(entities, orgName = "") {
    if (!entities || entities.length === 0) return null;

    const map = {};
    const parentOf = {};
    entities.forEach(e => {
      map[e.id] = { ...e, children: [] };
    });

    function wouldCreateCycle(candidateParentId, childId) {
      let cur = candidateParentId;
      const seen = new Set();
      while (cur) {
        if (cur === childId) return true;
        if (seen.has(cur)) break;
        seen.add(cur);
        cur = parentOf[cur];
      }
      return false;
    }

    const topRoots = [];
    const unlinkedRoots = [];

    entities.forEach(e => {
      const node = map[e.id];
      const managerId = e.manager_name_or_id;

      let parent = null;
      if (managerId) {
        if (map[managerId]) {
          parent = map[managerId];
        } else {
          const matched = Object.values(map).find(
            x => x.full_name.toLowerCase() === managerId.toLowerCase()
          );
          if (matched) {
            parent = matched;
          }
        }
      }

      if (parent && parent.id !== node.id && !wouldCreateCycle(parent.id, node.id)) {
        parent.children.push(node);
        parentOf[node.id] = parent.id;
      } else if (!node._isDeparted && !managerId) {
        topRoots.push(node);
      } else {
        node._isUnlinkedSubtree = true;
        unlinkedRoots.push(node);
      }
    });

    let root = null;
    if (topRoots.length === 1) {
      root = topRoots[0];
    } else if (topRoots.length > 1) {
      // Multi-root org (e.g. Co-Founders, Co-CEOs, or peer top executives):
      // use a virtual Organization root so peer leaders aren't falsely nested under each other.
      root = {
        id: "__org_root__",
        full_name: orgName || displayDomain.innerText || "Organization",
        job_title: `${topRoots.length} Top-Level Leaders`,
        department: "Executive",
        reporting_confidence: "none",
        _isVirtualRoot: true,
        children: [...topRoots],
      };
    } else {
      root = unlinkedRoots.find(n => !n._isDeparted) || Object.values(map)[0];
    }

    const visited = new Set();
    function visit(n) {
      if (!n || visited.has(n.id)) return;
      visited.add(n.id);
      n.children.forEach(visit);
    }
    visit(root);

    Object.values(map).forEach(n => {
      if (!visited.has(n.id)) {
        n._isUnlinkedSubtree = true;
        root.children.push(n);
        visit(n);
      }
    });

    return root;
  }

  // ==========================================================================
  // D3 Org Chart Tree Rendering Engine
  // ==========================================================================
  function getNodeDiffStatus(data) {
    if (data._isOpenRole) return "hiring";
    if (data._isDeparted) return "departed";
    return data.diff?.status || "baseline";
  }

  function getDiffTagText(status) {
    if (status === "hiring") return "+ HIRING";
    if (status === "joined") return "+ NEW";
    if (status === "promoted") return "↑ PROMOTED";
    if (status === "moved") return "⇄ MOVED";
    if (status === "departed") return "DEPARTED";
    return "";
  }

  function getDiffTagColor(status) {
    if (status === "hiring") return "#34d399";
    if (status === "joined") return "#6ee7b7";
    if (status === "promoted") return "#fcd34d";
    if (status === "moved") return "#7dd3fc";
    if (status === "departed") return "#fda4af";
    return "#94a3b8";
  }

  function decorateNodeIntelligenceOverlays(nodeEl, entityData, baseRadius) {
    if (!entityData || entityData._isVirtualRoot) return;
    const eid = entityData.id;

    // 1. Network / Backchannel Match Ring
    const netConns = networkMatchReport?.entity_connections?.[eid];
    if (netConns && netConns.length > 0) {
      nodeEl.append("circle")
        .attr("class", "node-network-ring")
        .attr("r", baseRadius + 4.5);
    }

    // 2. Poachability Radar Halo & Score Pill
    if (showPoachabilityRadar && entityData.recruiting && !entityData._isDeparted) {
      const rec = entityData.recruiting;
      if (rec.tier === "high" || rec.tier === "watch") {
        nodeEl.append("circle")
          .attr("class", `node-radar-halo tier-${rec.tier}`)
          .attr("r", baseRadius + (netConns?.length ? 8.5 : 5));

        nodeEl.append("text")
          .attr("class", "node-radar-score-tag")
          .attr("dy", "30px")
          .attr("x", 0)
          .attr("text-anchor", "middle")
          .style("fill", rec.tier === "high" ? "#fda4af" : "#fcd34d")
          .text(`🎯 ${rec.score} · ${rec.tier_label}`);
      }
    }
  }

  function toggleSubtreeCollapse(nodeId) {
    if (!nodeId || nodeId === "__org_root__") return;
    if (collapsedNodeIds.has(nodeId)) {
      collapsedNodeIds.delete(nodeId);
    } else {
      collapsedNodeIds.add(nodeId);
    }
    updateExpandAllButton();
    renderCurrentSnapshotCanvas();
  }

  function renderTree(treeData) {
    clearCanvas();
    if (!treeData) return;

    const width = canvasContainer.clientWidth || 800;
    const height = canvasContainer.clientHeight || 550;

    svg = d3.select("#canvas-container")
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("aria-label", "Organizational Chart Tree");

    g = svg.append("g");

    zoomBehavior = d3.zoom()
      .scaleExtent([0.25, 3])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });
    svg.call(zoomBehavior);

    const root = d3.hierarchy(treeData);

    // Record total descendant counts and apply collapsed state before layout
    root.each(d => {
      d._totalDescendants = d.descendants().length - 1;
      d._hasChildren = !!(d.children && d.children.length > 0);
    });
    root.each(d => {
      if (!d.data._isVirtualRoot && collapsedNodeIds.has(d.data.id) && d.children) {
        d._collapsedChildren = d.children;
        d.children = null;
      }
    });

    const nodeCount = root.descendants().length;
    const treeHeight = Math.max(height - 100, nodeCount * 46);
    const treeWidth = Math.max(width - 260, 520);

    const treeLayout = d3.tree().size([treeHeight, treeWidth]);
    treeLayout(root);

    svg.call(zoomBehavior.transform, d3.zoomIdentity.translate(90, 40).scale(0.88));

    // 1. Draw connecting link paths
    g.selectAll(".link")
      .data(root.links())
      .enter()
      .append("path")
      .attr("class", d => {
        const classes = ["link"];
        if (d.source.data._isVirtualRoot) {
          classes.push("org-root-link");
        } else if (d.target.data._isOpenRole) {
          classes.push("hiring-link");
        } else if (d.target.data._isDeparted) {
          classes.push("departed-link");
        } else if (d.target.data._isUnlinkedSubtree) {
          classes.push("confidence-inferred", "unlinked-link");
        } else if (d.target.data.reporting_confidence !== "explicit") {
          classes.push("confidence-inferred");
        }
        return classes.join(" ");
      })
      .attr("id", d => `link-${d.source.data.id}-${d.target.data.id}`)
      .attr("data-source", d => d.source.data.id)
      .attr("data-target", d => d.target.data.id)
      .attr("d", d3.linkHorizontal()
        .x(d => d.y)
        .y(d => d.x)
      );

    // 2. Draw employee nodes
    const nodes = g.selectAll(".node")
      .data(root.descendants())
      .enter()
      .append("g")
      .attr("class", d => {
        if (d.data._isVirtualRoot) {
          return "node node-org-root";
        }
        const deptClean = d.data.department ? d.data.department.split(" ")[0] : "Other";
        const diffStatus = getNodeDiffStatus(d.data);
        const collapsedCls = collapsedNodeIds.has(d.data.id) ? " is-collapsed" : "";
        return `node dept-${deptClean} diff-${diffStatus}${collapsedCls}`;
      })
      .attr("id", d => `node-${d.data.id}`)
      .attr("transform", d => `translate(${d.y},${d.x})`)
      .on("click", (event, d) => {
        if (d.data._isVirtualRoot) return;
        selectNodeById(d.data.id, d.data);
      })
      .on("dblclick", (event, d) => {
        if (d.data._isVirtualRoot || !d._hasChildren) return;
        event.stopPropagation();
        toggleSubtreeCollapse(d.data.id);
      });

    nodes.append("circle")
      .attr("r", d => d.data._isVirtualRoot ? 10 : 8);

    nodes.each(function (d) {
      decorateNodeIntelligenceOverlays(d3.select(this), d.data, 8);
    });

    // Interactive Collapse/Expand badge on nodes with children
    nodes.each(function (d) {
      if (!d._hasChildren || d.data._isVirtualRoot) return;
      const isCollapsed = collapsedNodeIds.has(d.data.id);
      const badgeLabel = isCollapsed ? `+${d._totalDescendants}` : "−";
      const badgeWidth = isCollapsed ? Math.max(20, String(badgeLabel).length * 6 + 8) : 16;

      const badge = d3.select(this)
        .append("g")
        .attr("class", "node-collapse-badge")
        .attr("transform", "translate(18, 0)")
        .on("click", (event) => {
          event.stopPropagation();
          toggleSubtreeCollapse(d.data.id);
        });

      badge.append("title")
        .text(isCollapsed
          ? `Expand ${d._totalDescendants} hidden report(s)`
          : `Collapse ${d._totalDescendants} report(s)`);

      badge.append("rect")
        .attr("class", "node-collapse-bg")
        .attr("x", -badgeWidth / 2)
        .attr("y", -7)
        .attr("width", badgeWidth)
        .attr("height", 14);

      badge.append("text")
        .attr("class", "node-collapse-text")
        .attr("dy", "3px")
        .attr("x", 0)
        .attr("text-anchor", "middle")
        .text(badgeLabel);
    });

    // Diff status badge above node if changed
    nodes.each(function (d) {
      if (d.data._isVirtualRoot) return;
      const status = getNodeDiffStatus(d.data);
      const tagText = getDiffTagText(status);
      if (tagText) {
        d3.select(this)
          .append("text")
          .attr("class", "node-diff-tag")
          .attr("dy", "-23px")
          .attr("x", 0)
          .attr("text-anchor", "middle")
          .style("fill", getDiffTagColor(status))
          .text(tagText);
      }
    });

    // Name label
    nodes.append("text")
      .attr("dy", "-11px")
      .attr("x", 0)
      .attr("text-anchor", "middle")
      .text(d => d.data.full_name);

    // Title label
    nodes.append("text")
      .attr("dy", "17px")
      .attr("x", 0)
      .attr("text-anchor", "middle")
      .style("font-size", "9.5px")
      .style("fill", "var(--text-color-muted)")
      .text(d => {
        const title = d.data.job_title || "";
        return title.length > 24 ? title.substring(0, 22) + "..." : title;
      });
  }

  // ==========================================================================
  // D3 Relationship Mesh Rendering Engine (Reporting + Shared Expertise)
  // ==========================================================================
  function renderMesh(entities) {
    clearCanvas();
    if (!entities || entities.length === 0) return;

    const width = canvasContainer.clientWidth || 800;
    const height = canvasContainer.clientHeight || 550;

    svg = d3.select("#canvas-container")
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("aria-label", "Relationship Mesh Network");

    g = svg.append("g");

    zoomBehavior = d3.zoom()
      .scaleExtent([0.25, 3])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });
    svg.call(zoomBehavior);

    const nodesData = entities.map(e => ({ ...e }));
    const nodeById = new Map(nodesData.map(n => [n.id, n]));
    const linksData = [];
    const seenPairs = new Set();

    // 1. Formal reporting links
    nodesData.forEach(n => {
      if (n.manager_name_or_id && nodeById.has(n.manager_name_or_id) && n.manager_name_or_id !== n.id) {
        const pairKey = [n.manager_name_or_id, n.id].sort().join("::");
        seenPairs.add(pairKey);
        linksData.push({
          source: n.manager_name_or_id,
          target: n.id,
          type: "reporting",
          confidence: n.reporting_confidence || "inferred",
          isDeparted: !!n._isDeparted,
          isOpenRole: !!n._isOpenRole
        });
      }
    });

    // 2. Shared expertise links
    const skillBuckets = new Map();
    nodesData.forEach(n => {
      (n.expertise_keywords || []).forEach(rawSkill => {
        const key = rawSkill.trim().toLowerCase();
        if (!key) return;
        if (!skillBuckets.has(key)) skillBuckets.set(key, []);
        skillBuckets.get(key).push(n.id);
      });
    });

    skillBuckets.forEach((memberIds, skillName) => {
      for (let i = 0; i < memberIds.length; i++) {
        for (let j = i + 1; j < memberIds.length; j++) {
          const a = memberIds[i];
          const b = memberIds[j];
          const pairKey = [a, b].sort().join("::");
          if (!seenPairs.has(pairKey)) {
            seenPairs.add(pairKey);
            linksData.push({
              source: a,
              target: b,
              type: "expertise",
              skill: skillName
            });
          }
        }
      }
    });

    const linkElements = g.selectAll(".link")
      .data(linksData)
      .enter()
      .append("line")
      .attr("class", d => {
        if (d.type === "expertise") return "link mesh-skill-link";
        if (d.isOpenRole) return "link hiring-link";
        if (d.isDeparted) return "link departed-link";
        if (d.confidence !== "explicit") return "link confidence-inferred";
        return "link";
      })
      .attr("data-source", d => typeof d.source === "object" ? d.source.id : d.source)
      .attr("data-target", d => typeof d.target === "object" ? d.target.id : d.target);

    const nodeElements = g.selectAll(".node")
      .data(nodesData)
      .enter()
      .append("g")
      .attr("class", d => {
        const deptClean = d.department ? d.department.split(" ")[0] : "Other";
        const diffStatus = getNodeDiffStatus(d);
        return `node dept-${deptClean} diff-${diffStatus}`;
      })
      .attr("id", d => `node-${d.id}`)
      .on("click", (event, d) => {
        selectNodeById(d.id, d);
      })
      .call(
        d3.drag()
          .on("start", (event, d) => {
            if (!event.active && activeSimulation) activeSimulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active && activeSimulation) activeSimulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      );

    nodeElements.append("circle")
      .attr("r", 9);

    nodeElements.each(function (d) {
      decorateNodeIntelligenceOverlays(d3.select(this), d, 9);
    });

    nodeElements.each(function (d) {
      const status = getNodeDiffStatus(d);
      const tagText = getDiffTagText(status);
      if (tagText) {
        d3.select(this)
          .append("text")
          .attr("class", "node-diff-tag")
          .attr("dy", "-23px")
          .attr("x", 0)
          .attr("text-anchor", "middle")
          .style("fill", getDiffTagColor(status))
          .text(tagText);
      }
    });

    nodeElements.append("text")
      .attr("dy", "-12px")
      .attr("x", 0)
      .attr("text-anchor", "middle")
      .text(d => d.full_name);

    nodeElements.append("text")
      .attr("dy", "18px")
      .attr("x", 0)
      .attr("text-anchor", "middle")
      .style("font-size", "9.5px")
      .style("fill", "var(--text-color-muted)")
      .text(d => {
        const title = d.job_title || "";
        return title.length > 22 ? title.substring(0, 20) + "..." : title;
      });

    activeSimulation = d3.forceSimulation(nodesData)
      .force("link", d3.forceLink(linksData).id(d => d.id).distance(d => d.type === "reporting" ? 95 : 140))
      .force("charge", d3.forceManyBody().strength(-340))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide().radius(42))
      .on("tick", () => {
        linkElements
          .attr("x1", d => d.source.x)
          .attr("y1", d => d.source.y)
          .attr("x2", d => d.target.x)
          .attr("y2", d => d.target.y);

        nodeElements
          .attr("transform", d => `translate(${d.x},${d.y})`);
      });
  }

  // ==========================================================================
  // Node Selection & Reporting Path Highlight
  // ==========================================================================
  function selectNodeById(personId, fallbackEntity = null) {
    if (!personId) return;
    selectedNodeId = personId;

    if (g) {
      g.selectAll(".node").classed("selected", false);
      const nodeSel = g.select(`#node-${CSS.escape(personId)}`);
      if (!nodeSel.empty()) {
        nodeSel.classed("selected", true);
        const datum = nodeSel.datum();
        const entityData = datum.data || datum;
        showProfileDetails(entityData);
        if (viewMode === "tree" && datum.parent !== undefined) {
          highlightReportingPath(datum);
        }
        return;
      }
    }

    const snap = historicalSnapshots[currentSnapshotIndex];
    if (snap) {
      const found = getEffectiveEntities(snap).find(e => e.id === personId) || fallbackEntity;
      showProfileDetails(found || null);
    }
  }

  function highlightReportingPath(currentNode) {
    if (!g) return;
    g.selectAll(".link").classed("warm-path-link", false);
    g.selectAll(".node").classed("warm-path-node", false);

    let n = currentNode;
    while (n && n.parent) {
      const linkSel = g.select(`#link-${CSS.escape(n.parent.data.id)}-${CSS.escape(n.data.id)}`);
      linkSel.classed("warm-path-link", true);
      n = n.parent;
    }
  }

  // ==========================================================================
  // Context Card Profile Details (Right Sidebar)
  // ==========================================================================
  function showProfileDetails(entity) {
    if (!entity) {
      profileEmpty.classList.remove("hidden");
      profileCard.classList.add("hidden");
      return;
    }

    profileEmpty.classList.add("hidden");
    profileCard.classList.remove("hidden");

    const names = (entity.full_name || "?").split(" ");
    const initials = entity._isOpenRole
      ? "+"
      : names.map(n => n[0]).join("").substring(0, 2).toUpperCase();
    profAvatar.innerText = initials;

    profName.innerText = entity.full_name;
    profTitle.innerText = entity.job_title || "Role Not Listed";
    profDept.innerText = entity.department || "Unassigned";

    // Diff status badge & summary
    const status = getNodeDiffStatus(entity);
    const statusLabels = {
      baseline: "Baseline",
      unchanged: "Unchanged",
      joined: "Joined",
      promoted: "Promoted",
      moved: "Moved",
      departed: "Departed",
      hiring: "Open Seat"
    };
    profDiffBadge.className = `diff-badge ${status}`;
    profDiffBadge.innerText = statusLabels[status] || status;
    profDiffBadge.classList.remove("hidden");

    const summaryText = entity.diff?.summary || entity.summary;
    if (summaryText && status !== "baseline" && status !== "unchanged") {
      profDiffSummary.innerText = summaryText;
      profDiffSummary.classList.remove("hidden");
    } else {
      profDiffSummary.classList.add("hidden");
    }

    // Reporting Line & Manager lookup
    const snap = historicalSnapshots[currentSnapshotIndex];
    const allEntities = snap ? getEffectiveEntities(snap) : [];
    const managerId = entity.manager_name_or_id;
    if (managerId) {
      const managerObj = allEntities.find(
        e => e.id === managerId || e.full_name.toLowerCase() === managerId.toLowerCase()
      );
      profManager.innerText = managerObj ? managerObj.full_name : managerId;
      currentManagerTargetId = managerObj ? managerObj.id : managerId;
      profManager.classList.add("highlight-link");
      profManager.disabled = false;
    } else {
      profManager.innerText = "None (Top Executive / Founder)";
      currentManagerTargetId = null;
      profManager.classList.remove("highlight-link");
      profManager.disabled = true;
    }

    // Reporting Line Confidence & Evidence
    const confidence = entity.reporting_confidence || (managerId ? "inferred" : "none");
    const confidenceLabels = {
      explicit: "Explicitly Stated",
      inferred: "Inferred (Heuristic/LLM)",
      none: "Root Node"
    };
    profConfidence.className = `confidence-pill ${confidence}`;
    profConfidence.innerText = confidenceLabels[confidence] || confidence;

    // Cross-Company Spinout / Alumni Trajectory Block
    if (profCrossOrgBlock && profCrossOrgList) {
      profCrossOrgList.innerHTML = "";
      const crossLinks = entity.cross_org_links || [];
      if (crossLinks.length > 0) {
        crossLinks.forEach(cl => {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "cross-org-jump-btn";

          const descSpan = document.createElement("span");
          const stateLabel = cl.other_status === "departed" ? "Ex-" : "";
          descSpan.innerText = `${cl.flow_badge}: ${stateLabel}${cl.other_role} at ${cl.other_domain}`;

          const arrowSpan = document.createElement("span");
          arrowSpan.className = "poach-pill alumni";
          arrowSpan.innerText = "Open Org →";

          btn.appendChild(descSpan);
          btn.appendChild(arrowSpan);
          btn.addEventListener("click", () => {
            loadOrganizationByKey(
              cl.other_load_kind,
              cl.other_org_key,
              cl.other_entity_id,
              cl.other_status === "departed"
            );
          });
          profCrossOrgList.appendChild(btn);
        });
        profCrossOrgBlock.classList.remove("hidden");
      } else {
        profCrossOrgBlock.classList.add("hidden");
      }
    }

    // Recruiting & Retention Signal block
    if (profRecruitingBlock && profPoachPill && profPoachTriggers) {
      profPoachTriggers.innerHTML = "";
      if (entity._isOpenRole) {
        profPoachPill.className = "poach-pill anchored";
        profPoachPill.innerText = entity._isLeadershipSearch
          ? `Executive Search (${entity._atsSource || "ATS"})`
          : `Active Requisition (${entity._atsSource || "ATS"})`;
        const li = document.createElement("li");
        li.className = "signal-trigger-item";
        li.innerText = entity._isLeadershipSearch
          ? "Retained-search opportunity & forward-looking org layer expansion."
          : "Forward-looking functional headcount investment signal.";
        profPoachTriggers.appendChild(li);
        profRecruitingBlock.classList.remove("hidden");
      } else if (entity._isDeparted) {
        const snapIntel = snap?.intelligence;
        const alum = (snapIntel?.alumni_spinout_radar || []).find(a => a.id === entity.id);
        profPoachPill.className = "poach-pill alumni";
        profPoachPill.innerText = alum ? alum.vc_angle : "Departed Leader";
        const li1 = document.createElement("li");
        li1.className = "signal-trigger-item";
        li1.innerText = alum
          ? `Search Angle: ${alum.recruiting_angle} (exited ${alum.departed_era}).`
          : "Exited organization; candidate for advisory, spinout tracking, or backchannel diligence.";
        profPoachTriggers.appendChild(li1);
        profRecruitingBlock.classList.remove("hidden");
      } else if (entity.recruiting) {
        const rec = entity.recruiting;
        profPoachPill.className = `poach-pill ${rec.tier}`;
        profPoachPill.innerText = `${rec.tier_label} · ${rec.score}/100`;
        (rec.triggers || []).forEach(tr => {
          const li = document.createElement("li");
          li.className = "signal-trigger-item";
          const sign = tr.impact > 0 ? `+${tr.impact}` : String(tr.impact);
          li.innerText = tr.impact !== 0
            ? `${tr.label} (${sign}): ${tr.detail}`
            : `${tr.label}: ${tr.detail}`;
          profPoachTriggers.appendChild(li);
        });
        profRecruitingBlock.classList.remove("hidden");
      } else {
        profRecruitingBlock.classList.add("hidden");
      }
    }

    // Network & Backchannel Access block for this person
    if (profNetworkBlock && profNetworkList) {
      profNetworkList.innerHTML = "";
      const netConns = networkMatchReport?.entity_connections?.[entity.id] || [];
      if (netConns.length > 0) {
        netConns.forEach(conn => {
          const li = document.createElement("li");
          li.className = "network-node-item";
          const badge = document.createElement("span");
          badge.className = "network-badge-inline";
          badge.innerText = conn.badge || "Network";
          const text = document.createElement("span");
          text.innerText = conn.detail;
          li.appendChild(badge);
          li.appendChild(text);
          profNetworkList.appendChild(li);
        });
        profNetworkBlock.classList.remove("hidden");
      } else {
        profNetworkBlock.classList.add("hidden");
      }
    }

    profEvidence.innerText = entity.reporting_evidence ||
      (confidence === "explicit"
        ? "Explicitly stated in bio or page layout."
        : "Inferred from organizational tier and department hierarchy.");

    if (profSourceLink) {
      const srcUrl = entity._isOpenRole
        ? (entity._jobUrl || snap?.source_url || "")
        : (snap?.source_url || "");
      if (srcUrl && /^https?:\/\//i.test(srcUrl)) {
        profSourceLink.href = srcUrl;
        profSourceLink.innerText = entity._isOpenRole ? "View ATS Source ↗" : "Verify Snapshot Source ↗";
        profSourceLink.classList.remove("hidden");
      } else {
        profSourceLink.classList.add("hidden");
      }
    }

    clearBlastSimulation();
    if (simulateDepartureBtn) {
      const canSimulate = !entity._isDeparted && !entity._isOpenRole;
      simulateDepartureBtn.disabled = !canSimulate;
    }

    profBio.innerText = entity.bio_summary || "No professional biography extracted for this snapshot.";

    profSkills.innerHTML = "";
    if (entity.expertise_keywords && entity.expertise_keywords.length > 0) {
      entity.expertise_keywords.forEach(skill => {
        const tag = document.createElement("span");
        tag.className = "skill-tag";
        tag.innerText = skill;
        profSkills.appendChild(tag);
      });
    } else {
      const tag = document.createElement("span");
      tag.className = "skill-tag";
      tag.style.opacity = "0.5";
      tag.innerText = "None extracted";
      profSkills.appendChild(tag);
    }

    renderCareerTimeline(entity.id);
  }

  function renderCareerTimeline(personId) {
    if (!profCareerTimeline || !profCareerBlock) return;
    profCareerTimeline.innerHTML = "";
    if (!personId || historicalSnapshots.length === 0) {
      profCareerBlock.classList.add("hidden");
      return;
    }

    const entries = [];
    historicalSnapshots.forEach((snap, idx) => {
      const activeMatch = (snap.entities || []).find(e => e.id === personId);
      const departedMatch = (snap.diff_summary?.departed || []).find(e => e.id === personId);
      const person = activeMatch || (departedMatch ? { ...departedMatch, _isDeparted: true } : null);
      if (!person) return;

      const status = person._isDeparted ? "departed" : (person.diff?.status || (idx === 0 ? "baseline" : "unchanged"));
      let managerLabel = "Top Level";
      if (person.manager_name_or_id) {
        const mgrObj = (snap.entities || []).find(
          x => x.id === person.manager_name_or_id || x.full_name.toLowerCase() === person.manager_name_or_id.toLowerCase()
        );
        managerLabel = mgrObj ? mgrObj.full_name : person.manager_name_or_id;
      }

      entries.push({
        snapIdx: idx,
        dateLabel: formatTimestamp(snap.snapshot_timestamp),
        status,
        jobTitle: person.job_title || "Team Member",
        department: person.department || "Unassigned",
        managerLabel,
        isDeparted: !!person._isDeparted,
        summary: person.diff?.summary || person.summary || "",
      });
    });

    if (entries.length === 0) {
      profCareerBlock.classList.add("hidden");
      return;
    }

    profCareerBlock.classList.remove("hidden");
    const statusLabels = {
      baseline: "Baseline",
      unchanged: "Unchanged",
      joined: "Joined",
      promoted: "Promoted",
      moved: "Moved",
      departed: "Departed",
    };

    entries.forEach(item => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      const isCurrentEra = item.snapIdx === currentSnapshotIndex;
      btn.className = `career-step-btn${isCurrentEra ? " active" : ""}`;
      if (isCurrentEra) {
        btn.setAttribute("aria-current", "step");
      }

      const header = document.createElement("div");
      header.className = "career-step-header";

      const dateSpan = document.createElement("span");
      dateSpan.className = "career-step-date";
      dateSpan.innerText = item.dateLabel;

      const badgeSpan = document.createElement("span");
      badgeSpan.className = `diff-badge ${item.status}`;
      badgeSpan.innerText = statusLabels[item.status] || item.status;

      header.appendChild(dateSpan);
      header.appendChild(badgeSpan);

      const roleSpan = document.createElement("span");
      roleSpan.className = "career-step-role";
      roleSpan.innerText = item.isDeparted ? `Departed (was ${item.jobTitle})` : item.jobTitle;

      const metaSpan = document.createElement("span");
      metaSpan.className = "career-step-meta";
      metaSpan.innerText = `${item.department} · Reports to: ${item.managerLabel}`;

      btn.appendChild(header);
      btn.appendChild(roleSpan);
      btn.appendChild(metaSpan);

      btn.addEventListener("click", () => {
        if (item.isDeparted && !showDeparted) {
          showDeparted = true;
          toggleDepartedBtn.setAttribute("aria-pressed", "true");
        }
        selectSnapshot(item.snapIdx);
        selectNodeById(personId);
      });

      li.appendChild(btn);
      profCareerTimeline.appendChild(li);
    });
  }

  // ==========================================================================
  // Warm Path Finder Logic
  // ==========================================================================
  function populateWarmPathSelects(snap) {
    warmSourceSelect.innerHTML = "";
    warmTargetSelect.innerHTML = "";
    if (!snap || !snap.entities || snap.entities.length === 0) return;

    const sorted = [...snap.entities].sort((a, b) => a.full_name.localeCompare(b.full_name));
    sorted.forEach(person => {
      const optA = document.createElement("option");
      optA.value = person.id;
      optA.innerText = `${person.full_name} (${person.job_title})`;
      warmSourceSelect.appendChild(optA);

      const optB = document.createElement("option");
      optB.value = person.id;
      optB.innerText = `${person.full_name} (${person.job_title})`;
      warmTargetSelect.appendChild(optB);
    });

    const root = findRootEntity(snap.entities);
    if (root) warmSourceSelect.value = root.id;
    const lastPerson = snap.entities[snap.entities.length - 1];
    if (lastPerson) warmTargetSelect.value = lastPerson.id;
  }

  async function runWarmPathFinder() {
    const snap = historicalSnapshots[currentSnapshotIndex];
    if (!snap) return;
    const sourceId = warmSourceSelect.value;
    const targetId = warmTargetSelect.value;
    if (!sourceId || !targetId) return;

    const entities = getEffectiveEntities(snap);
    try {
      const res = await apiJson("/api/warm-path", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entities,
          source_id: sourceId,
          target_id: targetId
        })
      });
      const steps = Array.isArray(res.path) ? res.path : (res.path?.steps || []);
      displayWarmPath(steps);
    } catch (_) {
      // Fallback client-side path if endpoint is unreachable
      displayWarmPath([]);
    }
  }

  function clearWarmPathHighlight() {
    warmPathResult.classList.add("hidden");
    warmPathResult.innerHTML = "";
    if (!g) return;
    g.selectAll(".link").classed("warm-path-link", false);
    g.selectAll(".node").classed("warm-path-node", false);
  }

  function displayWarmPath(path) {
    clearWarmPathHighlight();
    warmPathResult.classList.remove("hidden");

    if (!path || path.length === 0) {
      warmPathResult.innerText = "No connected path found between these two people.";
      return;
    }

    const nodeIds = new Set(path.map(step => step.id));
    if (g) {
      g.selectAll(".node").classed("warm-path-node", d => {
        const id = d.data ? d.data.id : d.id;
        return nodeIds.has(id);
      });

      for (let i = 0; i < path.length - 1; i++) {
        const a = path[i].id;
        const b = path[i + 1].id;
        g.selectAll(".link").each(function () {
          const el = d3.select(this);
          const src = el.attr("data-source");
          const tgt = el.attr("data-target");
          if ((src === a && tgt === b) || (src === b && tgt === a)) {
            el.classed("warm-path-link", true);
          }
        });
      }
    }

    warmPathResult.innerHTML = "";
    const header = document.createElement("div");
    header.style.fontWeight = "600";
    header.style.marginBottom = "6px";
    header.innerText = `${path.length - 1} Hop${path.length - 1 === 1 ? "" : "s"} Discovered:`;
    warmPathResult.appendChild(header);

    path.forEach((step, idx) => {
      if (idx > 0 && step.edge_label) {
        const edgeRow = document.createElement("div");
        edgeRow.className = "warm-edge-label";
        edgeRow.innerText = `↳ via ${step.edge_label}`;
        warmPathResult.appendChild(edgeRow);
      }
      const stepRow = document.createElement("div");
      stepRow.className = "warm-step";
      stepRow.innerText = `${idx + 1}. ${step.full_name} (${step.job_title})`;
      warmPathResult.appendChild(stepRow);
    });
  }

  // ==========================================================================
  // Natural Language Search, Non-Match Dimming & Search-to-Zoom
  // ==========================================================================
  function entityMatchesQuery(entity, query) {
    if (!entity || entity._isVirtualRoot || !query) return false;
    const nameMatch = entity.full_name?.toLowerCase().includes(query);
    const titleMatch = entity.job_title?.toLowerCase().includes(query);
    const deptMatch = entity.department?.toLowerCase().includes(query);
    const skillsMatch = entity.expertise_keywords?.some(skill =>
      skill.toLowerCase().includes(query)
    );
    return !!(nameMatch || titleMatch || deptMatch || skillsMatch);
  }

  function applySearchFilter(rawQuery, allowAutoExpand = true) {
    const query = (rawQuery || "").toLowerCase().trim();
    if (!g) return;

    if (!query) {
      g.classed("search-active", false);
      g.selectAll(".node").classed("highlight", false);
      searchMatchIds = [];
      searchMatchCursor = 0;
      if (searchMatchCount) {
        searchMatchCount.innerText = "";
        searchMatchCount.classList.add("hidden");
      }
      return;
    }

    // If a matching node is hidden inside a collapsed subtree in Tree mode, expand its ancestors
    if (allowAutoExpand && viewMode === "tree" && collapsedNodeIds.size > 0) {
      const snap = historicalSnapshots[currentSnapshotIndex];
      const entities = getEffectiveEntities(snap);
      const byId = new Map(entities.map(e => [e.id, e]));
      let expandedAny = false;
      entities.forEach(e => {
        if (entityMatchesQuery(e, query)) {
          let mgrId = e.manager_name_or_id;
          const seen = new Set();
          while (mgrId && !seen.has(mgrId)) {
            seen.add(mgrId);
            if (collapsedNodeIds.has(mgrId)) {
              collapsedNodeIds.delete(mgrId);
              expandedAny = true;
            }
            const mgr = byId.get(mgrId);
            mgrId = mgr ? mgr.manager_name_or_id : null;
          }
        }
      });
      if (expandedAny) {
        updateExpandAllButton();
        renderCurrentSnapshotCanvas();
        return;
      }
    }

    const matchedIds = [];
    g.selectAll(".node").classed("highlight", d => {
      const entity = d.data || d;
      const isMatch = entityMatchesQuery(entity, query);
      if (isMatch && entity.id) {
        matchedIds.push(entity.id);
      }
      return isMatch;
    });

    searchMatchIds = matchedIds;
    searchMatchCursor = 0;
    g.classed("search-active", true);

    if (searchMatchCount) {
      searchMatchCount.innerText = `${matchedIds.length} match${matchedIds.length === 1 ? "" : "es"}`;
      searchMatchCount.classList.remove("hidden");
    }
  }

  function zoomToNodeById(nodeId) {
    if (!svg || !g || !zoomBehavior || !nodeId) return;
    const nodeSel = g.select(`#node-${CSS.escape(nodeId)}`);
    if (nodeSel.empty()) return;

    const datum = nodeSel.datum();
    // In tree layout coordinates are (y, x); in force mesh layout coordinates are (x, y)
    const targetX = viewMode === "tree" ? datum.y : datum.x;
    const targetY = viewMode === "tree" ? datum.x : datum.y;
    if (typeof targetX !== "number" || typeof targetY !== "number") return;

    const width = canvasContainer.clientWidth || 800;
    const height = canvasContainer.clientHeight || 550;
    const scale = 1.15;
    const tx = width / 2 - targetX * scale;
    const ty = height / 2 - targetY * scale;

    svg.transition()
      .duration(450)
      .call(zoomBehavior.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
  }

  nodeSearchInput.addEventListener("input", (e) => {
    applySearchFilter(e.target.value, true);
  });

  nodeSearchInput.addEventListener("keydown", (e) => {
    if (e.isComposing) return;
    if (e.key === "Enter" && searchMatchIds.length > 0) {
      e.preventDefault();
      const targetId = searchMatchIds[searchMatchCursor % searchMatchIds.length];
      searchMatchCursor = (searchMatchCursor + 1) % searchMatchIds.length;
      selectNodeById(targetId);
      zoomToNodeById(targetId);
    }
  });

  // ==========================================================================
  // Export & Shareable Artifacts (Temporal JSON, Roster CSV, Vector SVG)
  // ==========================================================================
  function closeExportPopover() {
    if (!exportPopover) return;
    if (typeof exportPopover.hidePopover === "function") {
      try { exportPopover.hidePopover(); } catch (_) {}
    }
    exportPopover.classList.remove("fallback-open");
  }

  if (exportMenuBtn && exportPopover) {
    // Fallback toggle for browsers/environments where native popover API isn't active
    exportMenuBtn.addEventListener("click", () => {
      if (typeof exportPopover.togglePopover !== "function") {
        exportPopover.classList.toggle("fallback-open");
      }
    });
  }

  function triggerBlobDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function csvEscape(val) {
    if (val === null || val === undefined) return "";
    const str = String(val);
    if (/[",\n\r]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  function exportTemporalJson() {
    if (!historicalSnapshots || historicalSnapshots.length === 0) return;
    const domainSlug = (displayDomain.innerText || "organization").replace(/[^a-zA-Z0-9_-]/g, "_");
    const payload = {
      domain: displayDomain.innerText,
      exported_at: new Date().toISOString(),
      snapshots_count: historicalSnapshots.length,
      data: historicalSnapshots,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
    triggerBlobDownload(blob, `${domainSlug}_archigraph_temporal.json`);
    closeExportPopover();
  }

  function exportCurrentSnapshotCsv() {
    const snap = historicalSnapshots[currentSnapshotIndex];
    if (!snap) return;
    const domainSlug = (displayDomain.innerText || "organization").replace(/[^a-zA-Z0-9_-]/g, "_");
    const tsSlug = snap.snapshot_timestamp || "current";

    const headers = [
      "id",
      "full_name",
      "job_title",
      "department",
      "manager_name_or_id",
      "reporting_confidence",
      "reporting_evidence",
      "diff_status",
      "diff_summary",
      "poachability_score",
      "poachability_tier",
      "primary_recruiting_trigger",
      "previous_title",
      "previous_department",
      "previous_manager",
      "expertise_keywords",
      "bio_summary",
    ];

    const rows = [headers.join(",")];
    const allRows = [
      ...(snap.entities || []).map(e => ({ ...e, _departed: false })),
      ...(snap.diff_summary?.departed || []).map(e => ({ ...e, _departed: true })),
    ];

    allRows.forEach(e => {
      const diffStatus = e._departed ? "departed" : (e.diff?.status || "baseline");
      const diffSummary = e.diff?.summary || e.summary || "";
      const rec = e.recruiting || {};
      const primaryTrigger = rec.triggers?.[0]?.label || (e._departed ? "Departed Alumni" : "");
      const row = [
        e.id,
        e.full_name,
        e.job_title,
        e.department || "",
        e.manager_name_or_id || "",
        e.reporting_confidence || (e.manager_name_or_id ? "inferred" : "none"),
        e.reporting_evidence || "",
        diffStatus,
        diffSummary,
        e._departed ? "" : (rec.score ?? ""),
        e._departed ? "alumni" : (rec.tier_label || ""),
        primaryTrigger,
        e.diff?.previous_title || "",
        e.diff?.previous_department || "",
        e.diff?.previous_manager || "",
        (e.expertise_keywords || []).join("; "),
        e.bio_summary || "",
      ].map(csvEscape);
      rows.push(row.join(","));
    });

    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
    triggerBlobDownload(blob, `${domainSlug}_${tsSlug}_roster.csv`);
    closeExportPopover();
  }

  function exportCurrentGraphSvg() {
    const svgEl = canvasContainer.querySelector("svg");
    if (!svgEl) return;
    const snap = historicalSnapshots[currentSnapshotIndex];
    const domainSlug = (displayDomain.innerText || "organization").replace(/[^a-zA-Z0-9_-]/g, "_");
    const tsSlug = snap?.snapshot_timestamp || "current";

    const clone = svgEl.cloneNode(true);
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");

    const width = svgEl.getAttribute("width") || 800;
    const height = svgEl.getAttribute("height") || 550;

    const styleEl = document.createElementNS("http://www.w3.org/2000/svg", "style");
    styleEl.textContent = `
      text { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; fill: #cbd5e1; font-size: 11px; }
      .link { fill: none; stroke: rgba(99, 102, 241, 0.45); stroke-width: 1.75px; }
      .link.confidence-inferred { stroke-dasharray: 5, 4; stroke: rgba(148, 163, 184, 0.48); }
      .link.mesh-skill-link { stroke-dasharray: 2, 4; stroke: rgba(168, 85, 247, 0.35); stroke-width: 1.2px; }
      .link.departed-link { stroke-dasharray: 3, 4; stroke: rgba(251, 113, 133, 0.42); }
      .link.hiring-link { stroke-dasharray: 4, 3; stroke: rgba(52, 211, 153, 0.55); }
      .link.org-root-link { stroke-dasharray: 3, 3; stroke: rgba(129, 140, 248, 0.38); }
      .link.warm-path-link { stroke: #ec4899; stroke-width: 3.2px; }
      .node circle { fill: #111827; stroke: #6366f1; stroke-width: 2.2px; }
      .node.dept-Executive circle { stroke: #fb7185; }
      .node.dept-Design circle { stroke: #fbbf24; }
      .node.dept-Engineering circle { stroke: #38bdf8; }
      .node.dept-Product circle { stroke: #34d399; }
      .node.dept-Artificial circle, .node.dept-AI circle, .node.dept-Research circle { stroke: #c084fc; }
      .node.diff-joined circle { stroke: #10b981; }
      .node.diff-promoted circle { stroke: #f59e0b; }
      .node.diff-moved circle { stroke: #38bdf8; }
      .node.diff-departed circle { stroke: #fb7185; stroke-dasharray: 3, 2; fill: #1f1224; }
      .node.diff-hiring circle { stroke: #34d399; stroke-dasharray: 3, 2; fill: #072622; }
      .node.node-org-root circle { fill: #1e1b4b; stroke: #818cf8; stroke-dasharray: 2, 2; }
      .node-diff-tag { font-size: 8.5px; font-weight: 700; }
      .node-collapse-bg { fill: #1e293b; stroke: rgba(99, 102, 241, 0.55); stroke-width: 1.2px; rx: 7px; ry: 7px; }
      .node-collapse-text { font-size: 8.5px; font-weight: 700; fill: #e2e8f0; }
      .node-network-ring { fill: none; stroke: #2dd4bf; stroke-width: 2.2px; }
      .node-radar-halo { fill: none; stroke-width: 2px; stroke-dasharray: 3, 2; }
      .node-radar-halo.tier-high { stroke: #f43f5e; }
      .node-radar-halo.tier-watch { stroke: #f59e0b; }
      .node-radar-score-tag { font-size: 8.5px; font-weight: 700; }
    `;
    clone.insertBefore(styleEl, clone.firstChild);

    const bgRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bgRect.setAttribute("width", width);
    bgRect.setAttribute("height", height);
    bgRect.setAttribute("fill", "#080a0f");
    clone.insertBefore(bgRect, styleEl.nextSibling);

    const serializer = new XMLSerializer();
    const svgString = '<?xml version="1.0" encoding="UTF-8"?>\n' + serializer.serializeToString(clone);
    const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    triggerBlobDownload(blob, `${domainSlug}_${tsSlug}_${viewMode}.svg`);
    closeExportPopover();
  }

  function exportDiligenceBriefMarkdown() {
    const snap = historicalSnapshots[currentSnapshotIndex];
    if (!snap) return;
    const intel = snap.intelligence;
    const domain = displayDomain.innerText || snap.organization_name || "organization";
    const domainSlug = domain.replace(/[^a-zA-Z0-9_-]/g, "_");
    const era = intel?.era_label || formatTimestamp(snap.snapshot_timestamp);
    const vc = intel?.vc_metrics || {};
    const brief = intel?.diligence_brief || {};
    const signals = intel?.strategic_signals || {};
    const candidates = (intel?.recruiting_radar?.candidates || []).slice(0, 6);
    const alumni = (intel?.alumni_spinout_radar || []).slice(0, 6);

    const lines = [
      `# Archigraph Institutional Diligence & Talent Brief: ${domain}`,
      `*Snapshot Era: ${era} · Generated ${new Date().toISOString().slice(0, 10)}*`,
      "",
      "## 1. Executive Summary",
      `> ${brief.headline || "Organizational snapshot mapped via Archigraph."}`,
      "",
      "## 2. VC / PE Org Health Scorecard",
      `- **Mapped Leadership Headcount:** ${vc.headcount ?? snap.entities.length}`,
      `- **Leadership Retention Rate:** ${vc.retention_rate_pct ?? 100}%`,
      `- **Senior (VP+/C-Suite) Churn:** ${vc.senior_churn_pct ?? 0}%`,
      `- **Talent Bench Archetype:** ${vc.bench_archetype || "Baseline"} (${vc.internal_promo_count ?? 0} internal promos vs. ${vc.external_senior_hires ?? 0} external VP+ hires)`,
      `- **Hierarchy Depth &Avg Span:** ${vc.org_depth ?? 1} layers · ${vc.avg_span_of_control ?? 0} avg direct reports`,
      vc.max_span_manager
        ? `- **Primary Span Concentration:** ${vc.max_span_manager.full_name} (${vc.max_span_manager.job_title}) — ${vc.max_span_manager.direct_reports} direct reports (${vc.max_span_manager.share_pct}% of mapped org)`
        : "",
      "",
      "### Positive Momentum Signals",
      ...((brief.bull_signals || []).map(s => `- ${s}`)),
      "",
      "### Diligence Risks & Open Questions",
      ...((brief.risk_signals || []).map(s => `- ${s}`)),
      "",
      "### Emerging Domain Capabilities",
      (signals.emerging_capabilities || []).length
        ? `- ${(signals.emerging_capabilities || []).join(", ")}`
        : "- None detected",
      "",
      "## 3. Executive Search — Prime Poachability Targets",
      ...candidates.map(
        c => `- **${c.full_name}** (${c.job_title}, ${c.department}) — **${c.score}/100 (${c.tier_label})** · *${c.primary_trigger}*: ${c.primary_detail}`
      ),
    ];

    if (alumni.length > 0) {
      lines.push("", "## 4. Departed Leaders — Spinout Watch & Backchannel References");
      alumni.forEach(a => {
        lines.push(`- **${a.full_name}** (ex-${a.last_title}, exited ${a.departed_era}) — VC: *${a.vc_angle}* | Search: *${a.recruiting_angle}*`);
      });
    }

    const jobs = snap.hiring_signals || historicalSnapshots[historicalSnapshots.length - 1]?.hiring_signals;
    if (jobs && jobs.total_open_roles > 0) {
      lines.push("", `## 5. Forward Hiring Velocity & Open Requisitions (${jobs.ats_provider || "Public ATS"})`);
      lines.push(`- **Active Open Roles:** ${jobs.total_open_roles} (${jobs.executive_open_roles} Director+/VP+ leadership searches)`);
      if ((jobs.roadmap_keywords || []).length > 0) {
        lines.push(`- **Roadmap Signals in JDs:** ${jobs.roadmap_keywords.join(", ")}`);
      }
      (jobs.postings || []).forEach(p => {
        lines.push(`- **${p.title}** (${p.department}) — Reports to *${p.hiring_manager_name}* (${p.reporting_confidence}) · ${p.reporting_evidence}`);
      });
    }

    if (networkMatchReport && networkMatchReport.total_matches > 0) {
      lines.push("", "## 6. Proprietary Network & Backchannel Overlaps");
      (networkMatchReport.backchannels || []).forEach(b => {
        lines.push(`- **Backchannel:** ${b.contact_name} (${b.contact_role}) — ${b.summary}`);
      });
      (networkMatchReport.insiders || []).forEach(ins => {
        lines.push(`- **Direct Insider:** ${ins.contact_name} — ${ins.summary}`);
      });
      (networkMatchReport.org_veterans || []).forEach(v => {
        lines.push(`- **Org Overlap:** ${v.contact_name} — ${v.summary}`);
      });
    }

    const blob = new Blob([lines.filter(Boolean).join("\n") + "\n"], { type: "text/markdown;charset=utf-8" });
    triggerBlobDownload(blob, `${domainSlug}_${snap.snapshot_timestamp || "current"}_diligence_brief.md`);
    closeExportPopover();
  }

  if (exportBriefBtn) exportBriefBtn.addEventListener("click", exportDiligenceBriefMarkdown);
  if (exportJsonBtn) exportJsonBtn.addEventListener("click", exportTemporalJson);
  if (exportCsvBtn) exportCsvBtn.addEventListener("click", exportCurrentSnapshotCsv);
  if (exportSvgBtn) exportSvgBtn.addEventListener("click", exportCurrentGraphSvg);

  // ==========================================================================
  // Investor & Executive Search Intelligence Hub (Tabs + Network Modal)
  // ==========================================================================
  const tabPairs = [
    { tab: tabVcBtn, panel: panelVc },
    { tab: tabRecruitingBtn, panel: panelRecruiting },
    { tab: tabHiringBtn, panel: panelHiring },
    { tab: tabNetworkBtn, panel: panelNetwork },
  ].filter(p => p.tab && p.panel);

  function selectIntelTab(targetTab) {
    if (!targetTab) return;
    tabPairs.forEach(({ tab, panel }) => {
      const isSelected = tab === targetTab;
      tab.setAttribute("aria-selected", isSelected ? "true" : "false");
      tab.toggleAttribute("focusgroupstart", isSelected);
      if (isSelected) {
        panel.removeAttribute("hidden");
        panel.tabIndex = 0;
      } else {
        panel.hidden = "until-found";
        panel.removeAttribute("tabindex");
      }
    });
    try {
      targetTab.scrollIntoView({ block: "nearest", inline: "nearest", container: "nearest" });
    } catch (_) {
      targetTab.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }

  tabPairs.forEach(({ tab }, idx) => {
    // Selection follows focus & pointer click
    tab.addEventListener("click", () => selectIntelTab(tab));
    tab.addEventListener("focus", () => selectIntelTab(tab));
    // Fallback arrow-key roving support when native focusgroup & CDN polyfill are unavailable
    tab.addEventListener("keydown", (e) => {
      if (Object.hasOwn(HTMLElement.prototype, "focusGroup")) return;
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        const dir = e.key === "ArrowRight" ? 1 : -1;
        const nextIdx = (idx + dir + tabPairs.length) % tabPairs.length;
        tabPairs[nextIdx].tab.focus();
      } else if (e.key === "Home") {
        e.preventDefault();
        tabPairs[0].tab.focus();
      } else if (e.key === "End") {
        e.preventDefault();
        tabPairs[tabPairs.length - 1].tab.focus();
      }
    });
  });

  if (intelTabs) {
    intelTabs.addEventListener("beforematch", (e) => {
      const matchedPair = tabPairs.find(({ panel }) => panel === e.target || panel.contains(e.target));
      if (matchedPair) {
        selectIntelTab(matchedPair.tab);
      }
    });
  }

  function createKpiCard(label, value, subtext) {
    const card = document.createElement("div");
    card.className = "intel-kpi-card";
    const lbl = document.createElement("span");
    lbl.className = "intel-kpi-label";
    lbl.innerText = label;
    const val = document.createElement("span");
    val.className = "intel-kpi-value";
    val.innerText = value;
    const sub = document.createElement("span");
    sub.className = "intel-kpi-sub";
    sub.innerText = subtext;
    card.appendChild(lbl);
    card.appendChild(val);
    card.appendChild(sub);
    return card;
  }

  function renderIntelligenceHub(snap) {
    if (!snap || !snap.intelligence) return;
    const intel = snap.intelligence;
    if (intelEraSubtitle) {
      intelEraSubtitle.innerText = `Snapshot Era: ${intel.era_label || formatTimestamp(snap.snapshot_timestamp)}`;
    }
    renderVcTab(intel);
    renderRecruitingTab(intel);
    renderHiringTab(snap);
    renderNetworkTab();
  }

  function renderVcTab(intel) {
    if (!vcIntelContent) return;
    vcIntelContent.innerHTML = "";

    const vc = intel.vc_metrics || {};
    const brief = intel.diligence_brief || {};
    const signals = intel.strategic_signals || {};

    if (brief.headline) {
      const hl = document.createElement("p");
      hl.className = "intel-headline-box";
      hl.innerText = brief.headline;
      vcIntelContent.appendChild(hl);
    }

    const grid = document.createElement("div");
    grid.className = "intel-kpi-grid";
    grid.appendChild(createKpiCard(
      "Retention Rate",
      `${vc.retention_rate_pct ?? 100}%`,
      `${vc.senior_churn_pct ?? 0}% VP+/C-suite churn`
    ));
    grid.appendChild(createKpiCard(
      "Bench Velocity",
      vc.promo_vs_hire_ratio_pct !== null && vc.promo_vs_hire_ratio_pct !== undefined
        ? `${vc.promo_vs_hire_ratio_pct}% Internal`
        : `${vc.headcount ?? 0} Mapped`,
      vc.bench_archetype || "Baseline"
    ));
    grid.appendChild(createKpiCard(
      "Max Span Risk",
      vc.max_span_manager ? `${vc.max_span_manager.direct_reports} Directs` : "Flat",
      vc.max_span_manager
        ? `${vc.max_span_manager.full_name} (${vc.org_depth} layers)`
        : `${vc.org_depth ?? 1} org layer(s)`
    ));
    const openSeats = signals.open_leadership_seats || [];
    grid.appendChild(createKpiCard(
      "Unfilled VP+ Seats",
      String(openSeats.length),
      openSeats.length > 0 ? `Ex-${openSeats[0].vacated_by}` : "No open C/VP gaps"
    ));
    vcIntelContent.appendChild(grid);

    // Strategic Pivot & Emerging Capability Chips
    const growingDepts = (signals.department_mix || []).filter(d => d.delta_pct >= 4);
    const emergingCaps = (signals.emerging_capabilities || []).slice(0, 4);
    if (growingDepts.length > 0 || emergingCaps.length > 0) {
      const pivotSec = document.createElement("div");
      pivotSec.className = "intel-subsection";
      const h = document.createElement("h3");
      h.className = "section-title";
      h.innerText = "Strategic Mix & Capability Shifts";
      pivotSec.appendChild(h);

      const chipRow = document.createElement("div");
      chipRow.className = "pivot-chip-row";
      growingDepts.forEach(d => {
        const chip = document.createElement("span");
        chip.className = "pivot-chip";
        chip.innerText = `${d.department} +${d.delta_pct}%`;
        chipRow.appendChild(chip);
      });
      emergingCaps.forEach(cap => {
        const chip = document.createElement("span");
        chip.className = "pivot-chip emerging";
        chip.innerText = `+ ${cap}`;
        chipRow.appendChild(chip);
      });
      pivotSec.appendChild(chipRow);
      vcIntelContent.appendChild(pivotSec);
    }

    // Bull & Risk Thesis Bullets
    const renderBullets = (titleText, items, cls) => {
      if (!items || items.length === 0) return;
      const sec = document.createElement("div");
      sec.className = "intel-subsection";
      const h = document.createElement("h3");
      h.className = "section-title";
      h.innerText = titleText;
      sec.appendChild(h);

      const ul = document.createElement("ul");
      ul.className = "intel-list";
      ul.setAttribute("role", "list");
      items.forEach(txt => {
        const li = document.createElement("li");
        li.className = `intel-bullet ${cls}`;
        li.innerText = txt;
        ul.appendChild(li);
      });
      sec.appendChild(ul);
      vcIntelContent.appendChild(sec);
    };

    renderBullets("Strength & Momentum Signals", brief.bull_signals, "bull");
    renderBullets("Diligence Risks & IC Questions", brief.risk_signals, "risk");
  }

  function renderHiringTab(snap) {
    if (!hiringIntelContent) return;
    hiringIntelContent.innerHTML = "";

    const latestSnap = historicalSnapshots[historicalSnapshots.length - 1];
    const jobs = snap?.hiring_signals || latestSnap?.hiring_signals || {
      total_open_roles: 0,
      executive_open_roles: 0,
      ats_provider: null,
      department_velocity: [],
      roadmap_keywords: [],
      postings: [],
      graph_open_nodes: [],
    };

    const isLatestEra = snap === latestSnap;
    const summary = document.createElement("p");
    summary.className = "intel-headline-box";
    if (!isLatestEra && jobs.total_open_roles > 0) {
      summary.innerText =
        `Showing live job-board signals (${jobs.total_open_roles} open roles via ${jobs.ats_provider || "ATS"}). ` +
        `Jump to the latest snapshot on the Time Machine to overlay open seats on the graph.`;
    } else if (jobs.total_open_roles > 0) {
      summary.innerText =
        `${jobs.total_open_roles} active requisition(s) fused from ${jobs.ats_provider || "Public ATS"} ` +
        `(${jobs.executive_open_roles} Director+/VP+ leadership searches). Click any role to map it under its hiring manager.`;
    } else {
      summary.innerText =
        "No active job postings loaded for this snapshot yet. Expand 'Fuse Custom JD / ATS Board' below to parse reporting lines from a job description.";
    }
    hiringIntelContent.appendChild(summary);

    if (jobs.total_open_roles > 0) {
      const topVel = jobs.department_velocity?.[0];
      const grid = document.createElement("div");
      grid.className = "intel-kpi-grid";
      grid.appendChild(createKpiCard(
        "Open Roles",
        String(jobs.total_open_roles),
        `Source: ${jobs.ats_provider || "Public ATS"}`
      ));
      grid.appendChild(createKpiCard(
        "Exec Searches",
        String(jobs.executive_open_roles),
        "Director+ / VP+ seats"
      ));
      grid.appendChild(createKpiCard(
        "Top Hiring Dept",
        topVel ? topVel.department : "—",
        topVel ? `${topVel.hiring_share_pct}% share (${topVel.signal})` : "—"
      ));
      grid.appendChild(createKpiCard(
        "Roadmap Signals",
        String((jobs.roadmap_keywords || []).length),
        "Extracted from JD prose"
      ));
      hiringIntelContent.appendChild(grid);

      // Roadmap & Department Surge Chips
      if ((jobs.roadmap_keywords || []).length > 0) {
        const kwSec = document.createElement("div");
        kwSec.className = "intel-subsection";
        const h = document.createElement("h3");
        h.className = "section-title";
        h.innerText = "Product Roadmap Signals Leaked in JDs";
        kwSec.appendChild(h);

        const chipRow = document.createElement("div");
        chipRow.className = "pivot-chip-row";
        jobs.roadmap_keywords.forEach(kw => {
          const chip = document.createElement("span");
          chip.className = "pivot-chip emerging";
          chip.innerText = kw;
          chipRow.appendChild(chip);
        });
        kwSec.appendChild(chipRow);
        hiringIntelContent.appendChild(kwSec);
      }

      // Open Role Cards
      const listSec = document.createElement("div");
      listSec.className = "intel-subsection";
      const h = document.createElement("h3");
      h.className = "section-title";
      h.innerText = "Mapped Open Requisitions & Hiring Managers";
      listSec.appendChild(h);

      const ul = document.createElement("ul");
      ul.className = "intel-list";
      ul.setAttribute("role", "list");

      (jobs.postings || []).forEach(post => {
        const li = document.createElement("li");
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "radar-candidate-btn";

        const top = document.createElement("div");
        top.className = "radar-cand-top";
        const nm = document.createElement("span");
        nm.className = "radar-cand-name";
        nm.innerText = post.title;
        const pill = document.createElement("span");
        pill.className = `poach-pill ${post.reporting_confidence === "explicit" ? "anchored" : "watch"}`;
        pill.innerText = post.reporting_confidence === "explicit" ? "Explicit JD Line" : "Dept Head Match";
        top.appendChild(nm);
        top.appendChild(pill);

        const role = document.createElement("span");
        role.className = "radar-cand-role";
        role.innerText = `${post.department} · Reports to: ${post.hiring_manager_name}`;

        const quote = document.createElement("span");
        quote.className = "radar-cand-reason";
        quote.innerText = post.reporting_evidence;

        btn.appendChild(top);
        btn.appendChild(role);
        btn.appendChild(quote);

        btn.addEventListener("click", () => {
          const lastIdx = historicalSnapshots.length - 1;
          if (currentSnapshotIndex !== lastIdx) {
            selectSnapshot(lastIdx);
          }
          if (!showOpenRoles) {
            showOpenRoles = true;
            if (toggleJobsBtn) toggleJobsBtn.setAttribute("aria-pressed", "true");
            renderCurrentSnapshotCanvas();
          }
          selectNodeById(post.id);
          zoomToNodeById(post.id);
        });

        li.appendChild(btn);
        ul.appendChild(li);
      });

      listSec.appendChild(ul);
      hiringIntelContent.appendChild(listSec);
    }

    // Interactive Inline "Fuse Custom JD" Disclosure
    const fuseDetails = document.createElement("details");
    fuseDetails.className = "diff-group";
    const fuseSummary = document.createElement("summary");
    const sumLabel = document.createElement("span");
    sumLabel.innerText = "Fuse Custom Job Description";
    const sumTag = document.createElement("span");
    sumTag.className = "diff-badge hiring";
    sumTag.innerText = "+ Parse JD";
    fuseSummary.appendChild(sumLabel);
    fuseSummary.appendChild(sumTag);
    fuseDetails.appendChild(fuseSummary);

    const form = document.createElement("form");
    form.className = "jd-fuse-form";
    form.setAttribute("aria-label", "Fuse custom job description");

    const titleId = "custom-jd-title";
    const deptId = "custom-jd-dept";
    const descId = "custom-jd-desc";

    const lblTitle = document.createElement("label");
    lblTitle.htmlFor = titleId;
    lblTitle.innerText = "Open Role Title";
    const inpTitle = document.createElement("input");
    inpTitle.type = "text";
    inpTitle.id = titleId;
    inpTitle.name = "title";
    inpTitle.required = true;
    inpTitle.placeholder = "VP of Infrastructure Engineering";

    const lblDept = document.createElement("label");
    lblDept.htmlFor = deptId;
    lblDept.innerText = "Department";
    const inpDept = document.createElement("input");
    inpDept.type = "text";
    inpDept.id = deptId;
    inpDept.name = "department";
    inpDept.placeholder = "Engineering";

    const lblDesc = document.createElement("label");
    lblDesc.htmlFor = descId;
    lblDesc.innerText = "Job Description Snippet (with reporting line)";
    const txtDesc = document.createElement("textarea");
    txtDesc.id = descId;
    txtDesc.name = "description";
    txtDesc.rows = 3;
    txtDesc.required = true;
    txtDesc.placeholder = "Reporting directly to our CTO, you will scale CUDA inference clusters and enterprise RBAC...";

    const submitJdBtn = document.createElement("button");
    submitJdBtn.type = "submit";
    submitJdBtn.className = "secondary-btn";
    submitJdBtn.innerText = "Parse & Attach to Org Graph";

    form.appendChild(lblTitle);
    form.appendChild(inpTitle);
    form.appendChild(lblDept);
    form.appendChild(inpDept);
    form.appendChild(lblDesc);
    form.appendChild(txtDesc);
    form.appendChild(submitJdBtn);

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const targetSnap = historicalSnapshots[currentSnapshotIndex];
      if (!targetSnap) return;
      const existingRaw = (targetSnap.hiring_signals?.postings || []).map(p => ({
        id: p.id.replace(/^open-/, ""),
        title: p.title,
        department: p.department,
        location: p.location,
        ats_source: p.ats_source,
        url: p.url,
        description: `${p.reporting_evidence} ${p.description_excerpt}`,
      }));
      const newJob = {
        id: `custom-${Date.now()}`,
        title: inpTitle.value.trim(),
        department: inpDept.value.trim() || "Engineering",
        location: "Hybrid / Remote",
        ats_source: "Custom JD",
        description: txtDesc.value.trim(),
      };
      try {
        const res = await apiJson("/api/jobs/parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            postings: [newJob, ...existingRaw],
            entities: targetSnap.entities || [],
            domain: displayDomain.innerText || "",
          }),
        });
        targetSnap.hiring_signals = res.hiring_signals;
        showOpenRoles = true;
        if (toggleJobsBtn) {
          const openCnt = res.hiring_signals?.graph_open_nodes?.length || 0;
          toggleJobsBtn.disabled = openCnt === 0;
          toggleJobsBtn.innerText = `Open Roles (${openCnt})`;
          toggleJobsBtn.setAttribute("aria-pressed", "true");
        }
        renderHiringTab(targetSnap);
        renderCurrentSnapshotCanvas();
        const createdId = `open-${newJob.id}`;
        selectNodeById(createdId);
        zoomToNodeById(createdId);
      } catch (err) {
        alert(`Could not fuse JD: ${err.message}`);
      }
    });

    fuseDetails.appendChild(form);
    hiringIntelContent.appendChild(fuseDetails);
  }

  function renderRecruitingTab(intel) {
    if (!recruitingIntelContent) return;
    recruitingIntelContent.innerHTML = "";

    const radar = intel.recruiting_radar || {};
    const candidates = radar.candidates || [];
    const alumni = intel.alumni_spinout_radar || [];

    // Summary header with 1-click canvas halo toggle shortcut
    const summaryBar = document.createElement("div");
    summaryBar.className = "intel-headline-box";
    summaryBar.innerText =
      `${radar.high_priority_count || 0} Prime Target(s) · ${radar.watch_count || 0} Passive Watch · ` +
      `${alumni.length} Departed Exec/Spinout Lead(s). Click any leader to inspect on graph.`;
    recruitingIntelContent.appendChild(summaryBar);

    if (candidates.length > 0) {
      const candSec = document.createElement("div");
      candSec.className = "intel-subsection";
      const h = document.createElement("h3");
      h.className = "section-title";
      h.innerText = "Ranked Poachability Radar (Active Roster)";
      candSec.appendChild(h);

      const ul = document.createElement("ul");
      ul.className = "intel-list";
      ul.setAttribute("role", "list");

      candidates.slice(0, 6).forEach(cand => {
        const li = document.createElement("li");
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "radar-candidate-btn";

        const topRow = document.createElement("div");
        topRow.className = "radar-cand-top";
        const nameSpan = document.createElement("span");
        nameSpan.className = "radar-cand-name";
        nameSpan.innerText = cand.full_name;
        const pill = document.createElement("span");
        pill.className = `poach-pill ${cand.tier}`;
        pill.innerText = `${cand.score} · ${cand.tier_label}`;
        topRow.appendChild(nameSpan);
        topRow.appendChild(pill);

        const roleSpan = document.createElement("span");
        roleSpan.className = "radar-cand-role";
        roleSpan.innerText = `${cand.job_title} · ${cand.department}`;

        const reasonSpan = document.createElement("span");
        reasonSpan.className = "radar-cand-reason";
        reasonSpan.innerText = `${cand.primary_trigger}: ${cand.primary_detail}`;

        btn.appendChild(topRow);
        btn.appendChild(roleSpan);
        btn.appendChild(reasonSpan);

        btn.addEventListener("click", () => {
          selectNodeById(cand.id);
          zoomToNodeById(cand.id);
        });

        li.appendChild(btn);
        ul.appendChild(li);
      });
      candSec.appendChild(ul);
      recruitingIntelContent.appendChild(candSec);
    }

    if (alumni.length > 0) {
      const alumSec = document.createElement("div");
      alumSec.className = "intel-subsection";
      const h = document.createElement("h3");
      h.className = "section-title";
      h.innerText = "Spinout Watch & Available Alumni";
      alumSec.appendChild(h);

      const ul = document.createElement("ul");
      ul.className = "intel-list";
      ul.setAttribute("role", "list");

      alumni.slice(0, 5).forEach(alum => {
        const li = document.createElement("li");
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "radar-candidate-btn";

        const topRow = document.createElement("div");
        topRow.className = "radar-cand-top";
        const nameSpan = document.createElement("span");
        nameSpan.className = "radar-cand-name";
        nameSpan.innerText = alum.full_name;
        const pill = document.createElement("span");
        pill.className = "poach-pill alumni";
        pill.innerText = alum.vc_angle;
        topRow.appendChild(nameSpan);
        topRow.appendChild(pill);

        const roleSpan = document.createElement("span");
        roleSpan.className = "radar-cand-role";
        roleSpan.innerText = `Ex-${alum.last_title} · Exited ${alum.departed_era}`;

        const reasonSpan = document.createElement("span");
        reasonSpan.className = "radar-cand-reason";
        reasonSpan.innerText = `Exec Search: ${alum.recruiting_angle}`;

        btn.appendChild(topRow);
        btn.appendChild(roleSpan);
        btn.appendChild(reasonSpan);

        btn.addEventListener("click", () => {
          if (!showDeparted) {
            showDeparted = true;
            toggleDepartedBtn.setAttribute("aria-pressed", "true");
            renderCurrentSnapshotCanvas();
          }
          selectNodeById(alum.id);
          zoomToNodeById(alum.id);
        });

        li.appendChild(btn);
        ul.appendChild(li);
      });
      alumSec.appendChild(ul);
      recruitingIntelContent.appendChild(alumSec);
    }
  }

  function updateNetworkPill() {
    if (!networkMatchPill) return;
    const count = networkMatchReport?.total_matches || 0;
    if (userContacts.length === 0) {
      networkMatchPill.classList.add("hidden");
      if (clearNetworkBtn) clearNetworkBtn.classList.add("hidden");
    } else {
      networkMatchPill.innerText = String(count);
      networkMatchPill.classList.remove("hidden");
      if (clearNetworkBtn) clearNetworkBtn.classList.remove("hidden");
    }
  }

  function renderNetworkTab() {
    if (!networkIntelContent) return;
    networkIntelContent.innerHTML = "";

    if (userContacts.length === 0) {
      const emptyBox = document.createElement("p");
      emptyBox.className = "intel-headline-box";
      emptyBox.innerText =
        "Load your firm's relationship list or LinkedIn CSV to discover 1st-degree insiders and former-colleague backchannel references who overlapped with current executives.";
      networkIntelContent.appendChild(emptyBox);

      const actionRow = document.createElement("div");
      actionRow.className = "warm-btn-row";

      const demoBtn = document.createElement("button");
      demoBtn.type = "button";
      demoBtn.className = "secondary-btn";
      demoBtn.innerText = "Load Demo VC Network";
      demoBtn.addEventListener("click", () => {
        loadSampleNetwork();
      });

      const uploadBtn = document.createElement("button");
      uploadBtn.type = "button";
      uploadBtn.className = "ghost-btn";
      uploadBtn.innerText = "Upload CSV…";
      uploadBtn.addEventListener("click", () => {
        if (networkDialog && !networkDialog.open) networkDialog.showModal();
      });

      actionRow.appendChild(demoBtn);
      actionRow.appendChild(uploadBtn);
      networkIntelContent.appendChild(actionRow);
      return;
    }

    const rep = networkMatchReport || { total_matches: 0, insiders: [], backchannels: [], org_veterans: [] };
    const summary = document.createElement("p");
    summary.className = "intel-headline-box";
    summary.innerText =
      `${rep.total_matches} bridge(s) discovered across ${userContacts.length} contacts ` +
      `(${rep.backchannels.length} candid alumni backchannel(s), ${rep.insiders.length} direct insider(s), ${rep.org_veterans.length} org veteran(s)).`;
    networkIntelContent.appendChild(summary);

    // 1. Candid Backchannels (Departed snapshots overlap!)
    if (rep.backchannels.length > 0) {
      const sec = document.createElement("div");
      sec.className = "intel-subsection";
      const h = document.createElement("h3");
      h.className = "section-title";
      h.innerText = "Candid Off-List Backchannels (Historical Overlap)";
      sec.appendChild(h);

      const ul = document.createElement("ul");
      ul.className = "intel-list";
      ul.setAttribute("role", "list");

      rep.backchannels.forEach(bc => {
        const li = document.createElement("li");
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "radar-candidate-btn";

        const top = document.createElement("div");
        top.className = "radar-cand-top";
        const nm = document.createElement("span");
        nm.className = "radar-cand-name";
        nm.innerText = bc.contact_name;
        const badge = document.createElement("span");
        badge.className = "poach-pill alumni";
        badge.innerText = bc.relationship;
        top.appendChild(nm);
        top.appendChild(badge);

        const role = document.createElement("span");
        role.className = "radar-cand-role";
        role.innerText = bc.contact_role;

        const overlapNames = (bc.overlapped_leaders || []).map(o => o.full_name).join(", ");
        const desc = document.createElement("span");
        desc.className = "radar-cand-reason";
        desc.innerText = overlapNames
          ? `Overlapped (${bc.last_era}) with: ${overlapNames}`
          : bc.summary;

        btn.appendChild(top);
        btn.appendChild(role);
        btn.appendChild(desc);

        btn.addEventListener("click", () => {
          const firstActive = bc.overlapped_leaders?.[0];
          if (firstActive) {
            selectNodeById(firstActive.id);
            zoomToNodeById(firstActive.id);
          }
        });

        li.appendChild(btn);
        ul.appendChild(li);
      });
      sec.appendChild(ul);
      networkIntelContent.appendChild(sec);
    }

    // 2. Direct Insiders & Functional Org Veterans
    const combinedDirect = [
      ...rep.insiders.map(i => ({
        name: i.contact_name,
        pill: "1st-Degree Insider",
        role: i.contact_role,
        desc: i.summary,
        targetId: i.target_id,
      })),
      ...rep.org_veterans.map(v => ({
        name: v.contact_name,
        pill: v.relationship,
        role: `${v.contact_role} · ${v.contact_company}`,
        desc: v.summary,
        targetId: v.connected_leaders?.[0]?.id || null,
      })),
    ];

    if (combinedDirect.length > 0) {
      const sec = document.createElement("div");
      sec.className = "intel-subsection";
      const h = document.createElement("h3");
      h.className = "section-title";
      h.innerText = "Warm Intro & Functional Operator Bridges";
      sec.appendChild(h);

      const ul = document.createElement("ul");
      ul.className = "intel-list";
      ul.setAttribute("role", "list");

      combinedDirect.forEach(item => {
        const li = document.createElement("li");
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "radar-candidate-btn";

        const top = document.createElement("div");
        top.className = "radar-cand-top";
        const nm = document.createElement("span");
        nm.className = "radar-cand-name";
        nm.innerText = item.name;
        const pill = document.createElement("span");
        pill.className = "poach-pill anchored";
        pill.innerText = item.pill;
        top.appendChild(nm);
        top.appendChild(pill);

        const role = document.createElement("span");
        role.className = "radar-cand-role";
        role.innerText = item.role;

        const desc = document.createElement("span");
        desc.className = "radar-cand-reason";
        desc.innerText = item.desc;

        btn.appendChild(top);
        btn.appendChild(role);
        btn.appendChild(desc);

        if (item.targetId) {
          btn.addEventListener("click", () => {
            selectNodeById(item.targetId);
            zoomToNodeById(item.targetId);
          });
        }

        li.appendChild(btn);
        ul.appendChild(li);
      });
      sec.appendChild(ul);
      networkIntelContent.appendChild(sec);
    }
  }

  // CSV & Paste Contact Parser (supports LinkedIn Connections.csv & generic CSVs)
  function parseCsvRows(rawText) {
    const rows = [];
    let current = [];
    let field = "";
    let inQuotes = false;
    for (let i = 0; i < rawText.length; i++) {
      const ch = rawText[i];
      if (inQuotes) {
        if (ch === '"' && rawText[i + 1] === '"') {
          field += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          field += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        current.push(field.trim());
        field = "";
      } else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && rawText[i + 1] === "\n") i++;
        current.push(field.trim());
        if (current.some(Boolean)) rows.push(current);
        current = [];
        field = "";
      } else {
        field += ch;
      }
    }
    current.push(field.trim());
    if (current.some(Boolean)) rows.push(current);
    return rows;
  }

  function parseContactsText(rawText) {
    const rows = parseCsvRows(rawText);
    if (rows.length === 0) return [];

    // Find header row (LinkedIn exports sometimes include 2-3 preamble notes lines)
    let headerIdx = -1;
    for (let i = 0; i < Math.min(rows.length, 6); i++) {
      const low = rows[i].map(c => c.toLowerCase());
      if (low.includes("name") || low.includes("full name") || (low.includes("first name") && low.includes("last name"))) {
        headerIdx = i;
        break;
      }
    }

    const contacts = [];
    if (headerIdx >= 0) {
      const headers = rows[headerIdx].map(c => c.toLowerCase());
      const nameCol = headers.findIndex(h => h === "name" || h === "full name" || h === "full_name");
      const firstCol = headers.indexOf("first name");
      const lastCol = headers.indexOf("last name");
      const compCol = headers.findIndex(h => h.includes("company") || h.includes("organization"));
      const roleCol = headers.findIndex(h => h.includes("position") || h.includes("title") || h.includes("role"));
      const relCol = headers.findIndex(h => h.includes("relationship") || h.includes("source"));

      for (let r = headerIdx + 1; r < rows.length; r++) {
        const cols = rows[r];
        const fullName = nameCol >= 0
          ? (cols[nameCol] || "")
          : `${cols[firstCol] || ""} ${cols[lastCol] || ""}`.trim();
        if (!fullName) continue;
        contacts.push({
          name: fullName,
          company: compCol >= 0 ? (cols[compCol] || "") : "",
          role: roleCol >= 0 ? (cols[roleCol] || "") : "",
          relationship: relCol >= 0 && cols[relCol] ? cols[relCol] : "Uploaded Contact",
        });
      }
    } else {
      // Headerless simple lines: Name, Company, Role [, Relationship]
      rows.forEach(cols => {
        if (!cols[0]) return;
        contacts.push({
          name: cols[0],
          company: cols[1] || "",
          role: cols[2] || "",
          relationship: cols[3] || "Uploaded Contact",
        });
      });
    }
    return contacts;
  }

  async function refreshNetworkMatches() {
    if (userContacts.length === 0 || historicalSnapshots.length === 0) {
      networkMatchReport = null;
      updateNetworkPill();
      renderNetworkTab();
      return;
    }
    try {
      const res = await apiJson("/api/network-match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contacts: userContacts,
          snapshots: historicalSnapshots,
          domain: displayDomain.innerText || "",
        }),
      });
      networkMatchReport = res.match_report || null;
    } catch (_) {
      networkMatchReport = null;
    }
    updateNetworkPill();
    renderNetworkTab();
    renderCurrentSnapshotCanvas();
    if (selectedNodeId) {
      selectNodeById(selectedNodeId);
    }
  }

  async function loadSampleNetwork() {
    try {
      const res = await apiJson("/api/sample-network");
      userContacts = res.contacts || [];
      if (networkPasteInput) {
        networkPasteInput.value = userContacts
          .map(c => `${c.name}, ${c.company}, ${c.role}, ${c.relationship}`)
          .join("\n");
      }
      await refreshNetworkMatches();
      if (networkFormStatus) {
        networkFormStatus.classList.remove("error");
        networkFormStatus.innerText = historicalSnapshots.length > 0
          ? `Loaded ${userContacts.length} demo contacts — ${networkMatchReport?.total_matches || 0} bridge(s) matched on ${displayDomain.innerText}.`
          : `Loaded ${userContacts.length} demo contacts. Select any company demo to see instant backchannels.`;
      }
      if (tabNetworkBtn && historicalSnapshots.length > 0) {
        selectIntelTab(tabNetworkBtn);
      }
    } catch (err) {
      if (networkFormStatus) {
        networkFormStatus.classList.add("error");
        networkFormStatus.innerText = `Could not load sample network: ${err.message}`;
      }
    }
  }

  if (loadSampleNetworkBtn) {
    loadSampleNetworkBtn.addEventListener("click", () => {
      loadSampleNetwork();
    });
  }

  if (clearNetworkBtn) {
    clearNetworkBtn.addEventListener("click", () => {
      userContacts = [];
      networkMatchReport = null;
      if (networkPasteInput) networkPasteInput.value = "";
      if (networkCsvFile) networkCsvFile.value = "";
      if (networkFormStatus) {
        networkFormStatus.classList.remove("error");
        networkFormStatus.innerText = "Cleared loaded network.";
      }
      updateNetworkPill();
      renderNetworkTab();
      renderCurrentSnapshotCanvas();
      if (selectedNodeId) selectNodeById(selectedNodeId);
    });
  }

  if (networkCsvFile) {
    networkCsvFile.addEventListener("change", async () => {
      const file = networkCsvFile.files?.[0];
      if (!file) return;
      const text = await file.text();
      if (networkPasteInput) networkPasteInput.value = text.slice(0, 12000);
      if (networkFormStatus) {
        networkFormStatus.classList.remove("error");
        networkFormStatus.innerText = `Read ${file.name}. Click "Match Against Org Timeline" to run.`;
      }
    });
  }

  if (networkForm) {
    networkForm.addEventListener("input", () => {
      if (networkFormStatus && networkFormStatus.classList.contains("error")) {
        networkFormStatus.classList.remove("error");
        networkFormStatus.innerText = "";
      }
    });

    networkForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      let rawText = (networkPasteInput?.value || "").trim();
      if (!rawText && networkCsvFile?.files?.[0]) {
        rawText = await networkCsvFile.files[0].text();
      }
      const parsed = parseContactsText(rawText);
      if (parsed.length === 0) {
        if (networkFormStatus) {
          networkFormStatus.classList.add("error");
          networkFormStatus.innerText = "Please upload a CSV file, paste at least one contact, or load the demo network.";
        }
        networkPasteInput?.focus();
        return;
      }
      userContacts = parsed;
      await refreshNetworkMatches();
      if (networkFormStatus) {
        networkFormStatus.classList.remove("error");
        networkFormStatus.innerText = `Matched ${userContacts.length} contact(s).`;
      }
      if (tabNetworkBtn && historicalSnapshots.length > 0) {
        selectIntelTab(tabNetworkBtn);
      }
      if (networkDialog?.open) {
        networkDialog.close("matched");
      }
    });
  }

  // Modal Dialog Fallbacks (Invoker Commands offline fallback + closedby="any" fallback + returnValue reset)
  if (networkDialog) {
    networkDialog.addEventListener("close", () => {
      networkDialog.returnValue = "";
    });

    if (!("commandForElement" in HTMLButtonElement.prototype)) {
      if (openNetworkBtn) {
        openNetworkBtn.addEventListener("click", () => {
          if (!networkDialog.open) networkDialog.showModal();
        });
      }
      networkDialog.querySelectorAll('[command="close"][commandfor="network-dialog"]').forEach(btn => {
        btn.addEventListener("click", () => {
          if (networkDialog.open) networkDialog.close();
        });
      });
    }

    if (!("closedBy" in HTMLDialogElement.prototype)) {
      const outside = (ev, dlg) => {
        const r = dlg.getBoundingClientRect();
        return ev.clientX < r.left || ev.clientX > r.right || ev.clientY < r.top || ev.clientY > r.bottom;
      };
      let pressedOutside = false;
      networkDialog.addEventListener("pointerdown", (ev) => {
        pressedOutside = outside(ev, networkDialog);
      });
      networkDialog.addEventListener("pointerup", (ev) => {
        if (pressedOutside && outside(ev, networkDialog)) networkDialog.close();
      });
    }
  }

  // ==========================================================================
  // Key-Person Departure Blast-Radius Simulator (What-If Sandbox)
  // ==========================================================================
  let activeBlastTargetId = null;

  function clearBlastSimulation() {
    activeBlastTargetId = null;
    if (simulateDepartureBtn) {
      simulateDepartureBtn.setAttribute("aria-pressed", "false");
    }
    if (profSimulationBlock) {
      profSimulationBlock.classList.add("hidden");
    }
    if (g) {
      g.selectAll(".node").classed("blast-affected", false);
      g.selectAll(".link").classed("blast-link", false);
    }
  }

  async function runBlastSimulation() {
    const snap = historicalSnapshots[currentSnapshotIndex];
    if (!snap || !selectedNodeId) return;
    if (activeBlastTargetId === selectedNodeId) {
      clearBlastSimulation();
      return;
    }

    try {
      const res = await apiJson("/api/simulate-departure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entities: snap.entities || [],
          target_id: selectedNodeId,
        }),
      });
      const sim = res.simulation;
      if (!sim) return;
      activeBlastTargetId = selectedNodeId;
      if (simulateDepartureBtn) {
        simulateDepartureBtn.setAttribute("aria-pressed", "true");
      }

      if (profSimulationBlock && profSimPill && profSimSummary && profSimDetails) {
        const pillCls = sim.severity === "critical" ? "high" : (sim.severity === "high" ? "watch" : "anchored");
        profSimPill.className = `poach-pill ${pillCls}`;
        profSimPill.innerText = `${sim.severity.toUpperCase()} · ${sim.blast_radius_pct}% Org Exposure`;
        profSimSummary.innerText = sim.recommendation;

        profSimDetails.innerHTML = "";
        const liOrphans = document.createElement("li");
        liOrphans.className = "signal-trigger-item";
        liOrphans.innerText =
          `Orphaned Directs: ${sim.direct_reports_orphaned} (${sim.subtree_exposed_count} total in downstream subtree; ` +
          `${sim.newly_critical_flight_risks} newly tipped to Prime Flight Risk).`;
        profSimDetails.appendChild(liOrphans);

        if ((sim.unique_capabilities_at_risk || []).length > 0) {
          const liSkills = document.createElement("li");
          liSkills.className = "signal-trigger-item";
          liSkills.innerText = `Single-Point Domain Loss: ${sim.unique_capabilities_at_risk.join(", ")}.`;
          profSimDetails.appendChild(liSkills);
        }

        (sim.succession_bench || []).forEach(succ => {
          const liSucc = document.createElement("li");
          liSucc.className = "signal-trigger-item";
          liSucc.innerText =
            `Successor: ${succ.full_name} (${succ.job_title}) — ${succ.readiness_score}% (${succ.readiness_label}) · ${succ.rationale}`;
          profSimDetails.appendChild(liSucc);
        });

        profSimulationBlock.classList.remove("hidden");
      }

      const affectedSet = new Set(sim.affected_node_ids || []);
      if (g) {
        g.selectAll(".node").classed("blast-affected", d => {
          const id = d.data ? d.data.id : d.id;
          return affectedSet.has(id);
        });
        g.selectAll(".link").each(function () {
          const el = d3.select(this);
          const src = el.attr("data-source");
          const tgt = el.attr("data-target");
          el.classed("blast-link", affectedSet.has(src) && affectedSet.has(tgt));
        });
      }
    } catch (_) {
      clearBlastSimulation();
    }
  }

  if (simulateDepartureBtn) {
    simulateDepartureBtn.addEventListener("click", () => {
      runBlastSimulation();
    });
  }

  // ==========================================================================
  // Watchlist Alert Engine & Copyable Slack / CRM Webhook Payloads
  // ==========================================================================
  let currentAlerts = [];
  let selectedAlertId = null;
  let webhookFormat = "slack"; // "slack" | "crm_ats"

  function getEnabledAlertRules() {
    if (!alertSwitchesRow) return null;
    const boxes = [...alertSwitchesRow.querySelectorAll('input[type="checkbox"][switch]')];
    return boxes.filter(b => b.checked).map(b => b.dataset.rule);
  }

  function renderSelectedAlertWebhook() {
    if (!webhookPayloadCode) return;
    const activeAlert = currentAlerts.find(a => a.id === selectedAlertId) || currentAlerts[0];
    if (!activeAlert) {
      webhookPayloadCode.textContent = "// No alerts match the currently enabled watchlist rules.";
      return;
    }
    selectedAlertId = activeAlert.id;
    const payload = webhookFormat === "slack"
      ? activeAlert.webhooks?.slack
      : activeAlert.webhooks?.crm_ats;
    webhookPayloadCode.textContent = JSON.stringify(payload || {}, null, 2);
  }

  async function refreshAlertsFeed() {
    const enabled = getEnabledAlertRules();
    const qs = enabled !== null ? `?rules=${encodeURIComponent(enabled.join(","))}` : "";
    try {
      const data = await apiJson(`/api/alerts${qs}`);
      currentAlerts = data.alerts || [];
      if (alertsCountPill) {
        alertsCountPill.innerText = String(currentAlerts.length);
        alertsCountPill.classList.toggle("hidden", currentAlerts.length === 0);
      }
      if (alertsFeedHeading) {
        alertsFeedHeading.innerText = `Triggered Portfolio Signals (${currentAlerts.length})`;
      }
      if (!alertsFeedList) return;

      alertsFeedList.innerHTML = "";
      if (currentAlerts.length === 0) {
        const li = document.createElement("li");
        li.className = "intel-bullet";
        li.innerText = "No portfolio alerts triggered for the active rule switches.";
        alertsFeedList.appendChild(li);
        renderSelectedAlertWebhook();
        return;
      }

      if (!currentAlerts.some(a => a.id === selectedAlertId)) {
        selectedAlertId = currentAlerts[0].id;
      }

      currentAlerts.forEach(al => {
        const li = document.createElement("li");
        li.className = `alert-card sev-${al.severity}${al.id === selectedAlertId ? " active" : ""}`;

        const top = document.createElement("div");
        top.className = "radar-cand-top";
        const domSpan = document.createElement("span");
        domSpan.className = "radar-cand-name";
        domSpan.innerText = al.headline;
        const rulePill = document.createElement("span");
        const pCls = al.severity === "critical" ? "high" : (al.severity === "high" ? "watch" : "anchored");
        rulePill.className = `poach-pill ${pCls}`;
        rulePill.innerText = al.rule_label;
        top.appendChild(domSpan);
        top.appendChild(rulePill);

        const detail = document.createElement("span");
        detail.className = "radar-cand-reason";
        detail.innerText = al.detail;

        const actions = document.createElement("div");
        actions.className = "flow-card-actions";

        const jsonBtn = document.createElement("button");
        jsonBtn.type = "button";
        jsonBtn.className = "ghost-btn";
        jsonBtn.innerText = "Webhook JSON";
        jsonBtn.addEventListener("click", () => {
          selectedAlertId = al.id;
          alertsFeedList.querySelectorAll(".alert-card").forEach(c => c.classList.remove("active"));
          li.classList.add("active");
          renderSelectedAlertWebhook();
        });

        const jumpBtn = document.createElement("button");
        jumpBtn.type = "button";
        jumpBtn.className = "secondary-btn";
        jumpBtn.innerText = "Inspect on Graph →";
        jumpBtn.addEventListener("click", () => {
          if (alertsDialog?.open) alertsDialog.close("inspect");
          loadOrganizationByKey(al.load_kind, al.org_key, al.entity_id, !!al.is_departed);
        });

        actions.appendChild(jsonBtn);
        actions.appendChild(jumpBtn);
        li.appendChild(top);
        li.appendChild(detail);
        li.appendChild(actions);
        alertsFeedList.appendChild(li);
      });

      renderSelectedAlertWebhook();
    } catch (_) {
      // Non-fatal if alerts fetch fails
    }
  }

  // Initial background fetch so header Alerts pill shows live portfolio alert count immediately
  refreshAlertsFeed();

  if (openAlertsBtn) {
    openAlertsBtn.addEventListener("click", () => {
      refreshAlertsFeed();
    });
  }

  if (alertSwitchesRow) {
    alertSwitchesRow.addEventListener("change", () => {
      refreshAlertsFeed();
    });
  }

  if (webhookFmtSlackBtn && webhookFmtCrmBtn) {
    webhookFmtSlackBtn.addEventListener("click", () => {
      webhookFormat = "slack";
      webhookFmtSlackBtn.setAttribute("aria-pressed", "true");
      webhookFmtCrmBtn.setAttribute("aria-pressed", "false");
      renderSelectedAlertWebhook();
    });
    webhookFmtCrmBtn.addEventListener("click", () => {
      webhookFormat = "crm_ats";
      webhookFmtCrmBtn.setAttribute("aria-pressed", "true");
      webhookFmtSlackBtn.setAttribute("aria-pressed", "false");
      renderSelectedAlertWebhook();
    });
  }

  if (alertsDialog) {
    alertsDialog.addEventListener("close", () => {
      alertsDialog.returnValue = "";
    });

    if (!("commandForElement" in HTMLButtonElement.prototype)) {
      if (openAlertsBtn) {
        openAlertsBtn.addEventListener("click", () => {
          if (!alertsDialog.open) alertsDialog.showModal();
        });
      }
      alertsDialog.querySelectorAll('[command="close"][commandfor="alerts-dialog"]').forEach(btn => {
        btn.addEventListener("click", () => {
          if (alertsDialog.open) alertsDialog.close();
        });
      });
    }

    if (!("closedBy" in HTMLDialogElement.prototype)) {
      const outside = (ev, dlg) => {
        const r = dlg.getBoundingClientRect();
        return ev.clientX < r.left || ev.clientX > r.right || ev.clientY < r.top || ev.clientY > r.bottom;
      };
      let pressedOutside = false;
      alertsDialog.addEventListener("pointerdown", (ev) => {
        pressedOutside = outside(ev, alertsDialog);
      });
      alertsDialog.addEventListener("pointerup", (ev) => {
        if (pressedOutside && outside(ev, alertsDialog)) alertsDialog.close();
      });
    }
  }

  // Accessible Copy Button Controller (Async Clipboard + legacyCopy + VoiceOver dedup)
  const copyTimers = new WeakMap();
  let lastCopyMessage = "";

  function legacyClipboardCopy(text) {
    const field = Object.assign(document.createElement("textarea"), { value: text });
    field.setAttribute("readonly", "");
    field.style.cssText = "position:fixed;inset-block-start:0;opacity:0";
    document.body.append(field);
    field.select();
    try {
      return document.execCommand("copy");
    } finally {
      field.remove();
    }
  }

  function reportCopyStatus(button, ok) {
    const tip = button.nextElementSibling;
    clearTimeout(copyTimers.get(button));
    button.removeAttribute("data-copied");
    button.removeAttribute("data-failed");
    let message = ok ? "Copied" : "Copy failed";
    if (message === lastCopyMessage) message += "\u00A0";
    lastCopyMessage = message;
    if (tip) tip.textContent = "";
    void button.offsetWidth;
    button.setAttribute(ok ? "data-copied" : "data-failed", "");
    if (tip) {
      requestAnimationFrame(() => {
        tip.textContent = message;
      });
    }
    copyTimers.set(button, setTimeout(() => {
      button.removeAttribute("data-copied");
      button.removeAttribute("data-failed");
      if (tip) tip.textContent = "";
    }, 2000));
  }

  async function copyElementText(button, target) {
    if (!button || !target) return;
    const text = target.matches("input, textarea") ? target.value : target.innerText.trim();
    if (!text) return;
    try {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        if (!legacyClipboardCopy(text)) throw new Error("Copy failed");
      }
      reportCopyStatus(button, true);
    } catch {
      reportCopyStatus(button, false);
    }
  }

  if ("CommandEvent" in window) {
    document.addEventListener("command", (event) => {
      if (event.command && event.command.startsWith("--copy")) {
        copyElementText(event.source, event.target);
      }
    }, true);
  } else {
    document.addEventListener("click", (event) => {
      const button = event.target.closest('button[command^="--copy"]');
      if (!button) return;
      const target = document.getElementById(button.getAttribute("commandfor"));
      if (target) copyElementText(button, target);
    });
  }

  // Handle Demo Pill Clicks (pre-built fixtures: no network or API key needed)
  document.querySelectorAll(".demo-pill").forEach(pill => {
    pill.addEventListener("click", () => {
      const key = pill.getAttribute("data-demo");
      loadOrganizationByKey("demo", key);
    });
  });

  // ==========================================================================
  // Cross-Company Portfolio Screener & Alumni Spinout Modal (Sortable Table)
  // ==========================================================================
  const portfolioCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

  function reorderDomRows(tbody, orderedRows) {
    const move = Object.hasOwn(Element.prototype, "moveBefore")
      ? (row) => tbody.moveBefore(row, null)
      : (row) => tbody.append(row);
    for (const row of orderedRows) move(row);
  }

  function sortPortfolioRows(rows, colIndex, colType, direction) {
    const factor = direction === "ascending" ? 1 : -1;
    const decorated = rows.map(row => {
      const cell = row.cells[colIndex];
      const raw = cell?.dataset.value ?? cell?.textContent.trim() ?? "";
      return {
        row,
        val: colType === "number" ? Number(raw) : raw,
      };
    });
    decorated.sort((a, b) =>
      factor * (colType === "number" ? a.val - b.val : portfolioCollator.compare(a.val, b.val))
    );
    return decorated.map(d => d.row);
  }

  function handlePortfolioSortTrigger(buttonEl) {
    if (!portfolioTable || !portfolioTbody || !buttonEl) return;
    const th = buttonEl.closest("th");
    if (!th) return;

    const currentSort = th.getAttribute("aria-sort");
    const direction = currentSort === "ascending" ? "descending" : "ascending";

    for (const header of portfolioTable.tHead.rows[0].cells) {
      header.removeAttribute("aria-sort");
    }
    th.setAttribute("aria-sort", direction);

    const orderedRows = sortPortfolioRows(
      [...portfolioTbody.rows],
      th.cellIndex,
      th.dataset.type || "text",
      direction
    );

    const applyUpdate = () => reorderDomRows(portfolioTbody, orderedRows);
    if (portfolioTable.startViewTransition) {
      portfolioTable.startViewTransition(applyUpdate);
    } else if (document.startViewTransition) {
      document.startViewTransition(applyUpdate);
    } else {
      applyUpdate();
    }

    if (portfolioSortStatus) {
      const colName = buttonEl.textContent.trim();
      portfolioSortStatus.textContent = `Sorted by ${colName}, ${direction}, ${orderedRows.length} organizations`;
    }
  }

  if (portfolioTable) {
    portfolioTable.addEventListener("command", (event) => {
      if (event.command !== "--sort") return;
      handlePortfolioSortTrigger(event.source);
    });

    if (!("commandForElement" in HTMLButtonElement.prototype)) {
      portfolioTable.querySelectorAll('thead button[command="--sort"]').forEach(btn => {
        btn.addEventListener("click", () => handlePortfolioSortTrigger(btn));
      });
    }
  }

  async function refreshPortfolioDialog() {
    if (!portfolioTbody || !portfolioKpiStrip || !portfolioFlowsList) return;
    try {
      const data = await apiJson("/api/portfolio");
      const kpis = data.portfolio_kpis || {};

      portfolioKpiStrip.innerHTML = "";
      portfolioKpiStrip.appendChild(createKpiCard(
        "Tracked Orgs",
        String(kpis.organizations_tracked || 0),
        "Demos & live cache"
      ));
      portfolioKpiStrip.appendChild(createKpiCard(
        "Mapped Leaders",
        String(kpis.total_leaders_mapped || 0),
        "Canonical profiles"
      ));
      portfolioKpiStrip.appendChild(createKpiCard(
        "Prime Poachable",
        String(kpis.total_prime_targets || 0),
        "Score ≥ 55 flight risk"
      ));
      portfolioKpiStrip.appendChild(createKpiCard(
        "Open Requisitions",
        String(kpis.total_open_roles || 0),
        `${kpis.total_exec_open_roles || 0} Director+/VP+`
      ));
      portfolioKpiStrip.appendChild(createKpiCard(
        "Cross-Org Flows",
        String(kpis.cross_company_flows_count || 0),
        "Spinouts & migrations"
      ));

      portfolioTbody.innerHTML = "";
      (data.companies || []).forEach(comp => {
        const tr = document.createElement("tr");

        const thOrg = document.createElement("th");
        thOrg.scope = "row";
        thOrg.dataset.value = comp.domain;
        thOrg.innerText = `${comp.label} (${comp.domain})`;

        const tdLeaders = document.createElement("td");
        tdLeaders.dataset.value = String(comp.headcount);
        tdLeaders.innerText = `${comp.headcount} (${comp.snapshots_count} eras)`;

        const tdRet = document.createElement("td");
        tdRet.dataset.value = String(comp.retention_rate_pct);
        tdRet.innerText = `${comp.retention_rate_pct}%`;

        const tdChurn = document.createElement("td");
        tdChurn.dataset.value = String(comp.senior_churn_pct);
        tdChurn.innerText = `${comp.senior_churn_pct}%`;

        const tdPrime = document.createElement("td");
        tdPrime.dataset.value = String(comp.prime_targets_count);
        const primePill = document.createElement("span");
        primePill.className = `poach-pill ${comp.prime_targets_count > 0 ? "high" : "anchored"}`;
        primePill.innerText = comp.top_poachable && comp.prime_targets_count > 0
          ? `${comp.prime_targets_count} (${comp.top_poachable.full_name})`
          : "0 Prime";
        tdPrime.appendChild(primePill);

        const tdJobs = document.createElement("td");
        tdJobs.dataset.value = String(comp.open_roles_count);
        tdJobs.innerText = comp.open_roles_count > 0
          ? `${comp.open_roles_count} (${comp.exec_open_roles_count} exec)`
          : "0";

        const tdBench = document.createElement("td");
        tdBench.dataset.value = comp.bench_archetype;
        tdBench.innerText = comp.bench_archetype;

        const tdAct = document.createElement("td");
        const openBtn = document.createElement("button");
        openBtn.type = "button";
        openBtn.className = "secondary-btn";
        openBtn.innerText = "Open Graph";
        openBtn.addEventListener("click", () => {
          if (portfolioDialog?.open) portfolioDialog.close("selected");
          loadOrganizationByKey(comp.load_kind, comp.key);
        });
        tdAct.appendChild(openBtn);

        tr.appendChild(thOrg);
        tr.appendChild(tdLeaders);
        tr.appendChild(tdRet);
        tr.appendChild(tdChurn);
        tr.appendChild(tdPrime);
        tr.appendChild(tdJobs);
        tr.appendChild(tdBench);
        tr.appendChild(tdAct);
        portfolioTbody.appendChild(tr);
      });

      // Reset default sort indicator to Prime Targets descending
      if (portfolioTable) {
        const headers = [...portfolioTable.tHead.rows[0].cells];
        headers.forEach((h, i) => {
          if (i === 4) h.setAttribute("aria-sort", "descending");
          else h.removeAttribute("aria-sort");
        });
      }

      portfolioFlowsList.innerHTML = "";
      const flows = data.cross_company_flows || [];
      if (flows.length === 0) {
        const li = document.createElement("li");
        li.className = "intel-bullet";
        li.innerText = "No cross-company alumni moves detected yet across loaded organizations.";
        portfolioFlowsList.appendChild(li);
      } else {
        flows.forEach(fl => {
          const li = document.createElement("li");
          li.className = "flow-card";

          const info = document.createElement("div");
          info.className = "flow-card-info";
          const top = document.createElement("div");
          top.className = "name-badge-row";
          const nm = document.createElement("span");
          nm.className = "radar-cand-name";
          nm.innerText = fl.full_name;
          const badge = document.createElement("span");
          badge.className = "poach-pill alumni";
          badge.innerText = fl.badge_label;
          top.appendChild(nm);
          top.appendChild(badge);

          const narr = document.createElement("span");
          narr.className = "radar-cand-reason";
          narr.innerText = fl.narrative;
          info.appendChild(top);
          info.appendChild(narr);

          const actions = document.createElement("div");
          actions.className = "flow-card-actions";

          const btnOrigin = document.createElement("button");
          btnOrigin.type = "button";
          btnOrigin.className = "ghost-btn";
          btnOrigin.innerText = `Origin: ${fl.from_org.domain}`;
          btnOrigin.addEventListener("click", () => {
            if (portfolioDialog?.open) portfolioDialog.close("origin");
            loadOrganizationByKey(
              fl.from_org.load_kind,
              fl.from_org.org_key,
              fl.from_org.entity_id,
              fl.from_org.status === "departed"
            );
          });

          const btnDest = document.createElement("button");
          btnDest.type = "button";
          btnDest.className = "secondary-btn";
          btnDest.innerText = `Destination: ${fl.to_org.domain} →`;
          btnDest.addEventListener("click", () => {
            if (portfolioDialog?.open) portfolioDialog.close("destination");
            loadOrganizationByKey(
              fl.to_org.load_kind,
              fl.to_org.org_key,
              fl.to_org.entity_id,
              fl.to_org.status === "departed"
            );
          });

          actions.appendChild(btnOrigin);
          actions.appendChild(btnDest);
          li.appendChild(info);
          li.appendChild(actions);
          portfolioFlowsList.appendChild(li);
        });
      }
    } catch (_) {
      // Non-fatal if portfolio endpoint fails
    }
  }

  if (openPortfolioBtn) {
    openPortfolioBtn.addEventListener("click", () => {
      refreshPortfolioDialog();
    });
  }

  if (portfolioDialog) {
    portfolioDialog.addEventListener("close", () => {
      portfolioDialog.returnValue = "";
    });

    if (!("commandForElement" in HTMLButtonElement.prototype)) {
      if (openPortfolioBtn) {
        openPortfolioBtn.addEventListener("click", () => {
          if (!portfolioDialog.open) portfolioDialog.showModal();
        });
      }
      portfolioDialog.querySelectorAll('[command="close"][commandfor="portfolio-dialog"]').forEach(btn => {
        btn.addEventListener("click", () => {
          if (portfolioDialog.open) portfolioDialog.close();
        });
      });
    }

    if (!("closedBy" in HTMLDialogElement.prototype)) {
      const outside = (ev, dlg) => {
        const r = dlg.getBoundingClientRect();
        return ev.clientX < r.left || ev.clientX > r.right || ev.clientY < r.top || ev.clientY > r.bottom;
      };
      let pressedOutside = false;
      portfolioDialog.addEventListener("pointerdown", (ev) => {
        pressedOutside = outside(ev, portfolioDialog);
      });
      portfolioDialog.addEventListener("pointerup", (ev) => {
        if (pressedOutside && outside(ev, portfolioDialog)) portfolioDialog.close();
      });
    }
  }
});
