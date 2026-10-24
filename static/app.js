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
  const expandAllBtn = document.getElementById("expand-all-btn");
  const canvasLegend = document.getElementById("canvas-legend");

  const exportMenuBtn = document.getElementById("export-menu-btn");
  const exportPopover = document.getElementById("export-popover");
  const exportJsonBtn = document.getElementById("export-json-btn");
  const exportCsvBtn = document.getElementById("export-csv-btn");
  const exportSvgBtn = document.getElementById("export-svg-btn");

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
  const profEvidence = document.getElementById("prof-evidence");
  const profBio = document.getElementById("prof-bio");
  const profSkills = document.getElementById("prof-skills");
  const profCareerBlock = document.getElementById("prof-career-block");
  const profCareerTimeline = document.getElementById("prof-career-timeline");
  const traceFromRootBtn = document.getElementById("trace-from-root-btn");

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

  // Global State
  let historicalSnapshots = [];
  let currentSnapshotIndex = 0;
  let selectedNodeId = null;
  let currentManagerTargetId = null;
  let viewMode = "tree"; // "tree" | "mesh"
  let showDeparted = false;
  let collapsedNodeIds = new Set();
  let searchMatchIds = [];
  let searchMatchCursor = 0;
  let isPlaying = false;
  let playInterval = null;
  let activeSimulation = null;

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
  async function loadResult(fetcher) {
    sampleBanner.classList.add("hidden");
    setLoadingState(true);
    resetState();

    try {
      const result = await fetcher();

      historicalSnapshots = result.data || [];
      displayDomain.innerText = result.domain || "Unknown";
      showBanner(result);

      setupTimeline();
      selectSnapshot(historicalSnapshots.length > 1 ? historicalSnapshots.length - 1 : 0);

      nodeSearchInput.disabled = false;
      if (exportMenuBtn) exportMenuBtn.disabled = false;
      canvasLegend.classList.remove("hidden");
      warmPathSection.classList.remove("hidden");
      setLoadingState(false);
    } catch (err) {
      alert(`Pipeline Failed: ${err.message}`);
      setLoadingState(false);
      resetToPlaceholder();
    }
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
    if (showDeparted && snap.diff_summary && Array.isArray(snap.diff_summary.departed)) {
      const existingIds = new Set(base.map(e => e.id));
      snap.diff_summary.departed.forEach(dep => {
        if (!existingIds.has(dep.id)) {
          base.push({ ...dep, _isDeparted: true });
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

    renderDiffKpis(snap, index);
    renderDiffAccordions(snap, index);
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
    if (data._isDeparted) return "departed";
    return data.diff?.status || "baseline";
  }

  function getDiffTagText(status) {
    if (status === "joined") return "+ NEW";
    if (status === "promoted") return "↑ PROMOTED";
    if (status === "moved") return "⇄ MOVED";
    if (status === "departed") return "DEPARTED";
    return "";
  }

  function getDiffTagColor(status) {
    if (status === "joined") return "#6ee7b7";
    if (status === "promoted") return "#fcd34d";
    if (status === "moved") return "#7dd3fc";
    if (status === "departed") return "#fda4af";
    return "#94a3b8";
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
          isDeparted: !!n._isDeparted
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
    const initials = names.map(n => n[0]).join("").substring(0, 2).toUpperCase();
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
      departed: "Departed"
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

    profEvidence.innerText = entity.reporting_evidence ||
      (confidence === "explicit"
        ? "Explicitly stated in bio or page layout."
        : "Inferred from organizational tier and department hierarchy.");

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
      .node.node-org-root circle { fill: #1e1b4b; stroke: #818cf8; stroke-dasharray: 2, 2; }
      .node-diff-tag { font-size: 8.5px; font-weight: 700; }
      .node-collapse-bg { fill: #1e293b; stroke: rgba(99, 102, 241, 0.55); stroke-width: 1.2px; rx: 7px; ry: 7px; }
      .node-collapse-text { font-size: 8.5px; font-weight: 700; fill: #e2e8f0; }
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

  if (exportJsonBtn) exportJsonBtn.addEventListener("click", exportTemporalJson);
  if (exportCsvBtn) exportCsvBtn.addEventListener("click", exportCurrentSnapshotCsv);
  if (exportSvgBtn) exportSvgBtn.addEventListener("click", exportCurrentGraphSvg);

  // Handle Demo Pill Clicks (pre-built fixtures: no network or API key needed)
  document.querySelectorAll(".demo-pill").forEach(pill => {
    pill.addEventListener("click", () => {
      document.querySelectorAll(".demo-pill").forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      const key = pill.getAttribute("data-demo");
      loadingStatus.innerText = "Loading organizational snapshots & computing diffs...";
      loadResult(() => apiJson(`/api/demo/${encodeURIComponent(key)}`));
    });
  });
});
