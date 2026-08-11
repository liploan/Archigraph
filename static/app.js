/* ==========================================================================
   Archigraph JS Client - API Ingestion & D3 Temporal Tree Engine
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
  const nodeSearchInput = document.getElementById("node-search");
  
  const canvasContainer = document.getElementById("canvas-container");
  const placeholderView = document.getElementById("placeholder-view");
  const loadingView = document.getElementById("loading-view");
  const loadingStatus = document.getElementById("loading-status");
  
  const profileEmpty = document.getElementById("profile-empty");
  const profileCard = document.getElementById("profile-card");
  const profAvatar = document.getElementById("prof-avatar");
  const profName = document.getElementById("prof-name");
  const profTitle = document.getElementById("prof-title");
  const profDept = document.getElementById("prof-dept");
  const profManager = document.getElementById("prof-manager");
  const profBio = document.getElementById("prof-bio");
  const profSkills = document.getElementById("prof-skills");
  
  const playBtn = document.getElementById("play-btn");
  const playIcon = playBtn.querySelector(".play-icon");
  const pauseIcon = playBtn.querySelector(".pause-icon");
  const timelineSlider = document.getElementById("timeline-slider");
  const timelineTicks = document.getElementById("timeline-ticks");

  // Global State
  let historicalSnapshots = []; // List of parsed snapshot payloads
  let currentSnapshotIndex = 0;
  let activeTreeData = null;    // Parsed hierarchy for D3
  let selectedNodeId = null;    // Slugs like 'amjad-masad'
  let isPlaying = false;
  let playInterval = null;

  // Init D3 Canvas setup
  let svg = null;
  let g = null;
  let zoomBehavior = null;

  // Handle Form Submission
  extractForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const targetUrl = urlInput.value.trim();
    const limit = limitSelect.value;
    
    if (!targetUrl) return;
    
    // Set UI to loading state
    setLoadingState(true);
    resetState();
    
    try {
      loadingStatus.innerText = "Querying CDX index and extracting historical pages...";
      const response = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: targetUrl, limit: limit })
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || "An error occurred during extraction.");
      }
      
      historicalSnapshots = result.data;
      displayDomain.innerText = result.domain;
      
      // Initialize Timeline slider
      setupTimeline();
      
      // Render first snapshot
      selectSnapshot(0);
      
      // Enable inputs
      nodeSearchInput.disabled = false;
      setLoadingState(false);
    } catch (err) {
      alert(`Pipeline Failed: ${err.message}`);
      setLoadingState(false);
      resetToPlaceholder();
    }
  });

  function setLoadingState(isLoading) {
    if (isLoading) {
      submitBtn.disabled = true;
      btnLoader.classList.remove("hidden");
      loadingView.classList.remove("hidden");
      placeholderView.classList.add("hidden");
      canvasContainer.querySelectorAll("svg").forEach(s => s.remove());
    } else {
      submitBtn.disabled = false;
      btnLoader.classList.add("hidden");
      loadingView.classList.add("hidden");
    }
  }

  function resetState() {
    historicalSnapshots = [];
    currentSnapshotIndex = 0;
    activeTreeData = null;
    selectedNodeId = null;
    stopPlayback();
    playBtn.disabled = true;
    timelineSlider.disabled = true;
    timelineTicks.innerHTML = "";
    nodeSearchInput.value = "";
    nodeSearchInput.disabled = true;
    showProfileDetails(null);
  }

  function resetToPlaceholder() {
    placeholderView.classList.remove("hidden");
    displayDomain.innerText = "No active target";
    displayDate.classList.add("hidden");
  }

  // ==========================================================================
  // Timeline Slider Setup & Navigation
  // ==========================================================================
  function setupTimeline() {
    if (historicalSnapshots.length <= 1) {
      timelineSlider.disabled = true;
      playBtn.disabled = true;
      timelineSlider.max = 0;
      timelineSlider.value = 0;
      
      if (historicalSnapshots.length === 1) {
        renderTickMarks(["Current"]);
      }
      return;
    }
    
    timelineSlider.disabled = false;
    playBtn.disabled = false;
    timelineSlider.max = historicalSnapshots.length - 1;
    timelineSlider.value = 0;
    
    const formattedDates = historicalSnapshots.map(snap => formatTimestamp(snap.snapshot_timestamp));
    renderTickMarks(formattedDates);
  }

  function renderTickMarks(labels) {
    timelineTicks.innerHTML = "";
    labels.forEach((label, idx) => {
      const mark = document.createElement("span");
      mark.className = `tick-mark ${idx === 0 ? "active" : ""}`;
      mark.innerText = label;
      mark.addEventListener("click", () => {
        timelineSlider.value = idx;
        selectSnapshot(idx);
      });
      timelineTicks.appendChild(mark);
    });
  }

  timelineSlider.addEventListener("input", (e) => {
    selectSnapshot(parseInt(e.target.value));
  });

  function selectSnapshot(index) {
    currentSnapshotIndex = index;
    timelineSlider.value = index;
    
    // Highlight active tick mark
    const ticks = timelineTicks.querySelectorAll(".tick-mark");
    ticks.forEach((tick, i) => {
      if (i === index) tick.classList.add("active");
      else tick.classList.remove("active");
    });
    
    const snap = historicalSnapshots[index];
    if (!snap) return;
    
    // Update labels
    const dateStr = formatTimestamp(snap.snapshot_timestamp);
    displayDate.innerText = dateStr;
    displayDate.classList.remove("hidden");
    
    // Build tree and render
    activeTreeData = buildHierarchy(snap.entities);
    renderTree(activeTreeData);
    
    // Maintain profile selection if person exists in the new snapshot
    if (selectedNodeId) {
      const match = snap.entities.find(e => e.id === selectedNodeId);
      showProfileDetails(match);
    }
  }

  function formatTimestamp(ts) {
    if (ts === "current" || !ts) return "Current";
    // Wayback standard format YYYYMMDDHHMMSS -> YYYY-MM-DD
    if (ts.length >= 8) {
      const year = ts.substring(0, 4);
      const month = ts.substring(4, 6);
      const day = ts.substring(6, 8);
      
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const mIdx = parseInt(month, 10) - 1;
      return `${monthNames[mIdx]} ${year}`;
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
        nextIdx = 0; // Loop around
      }
      selectSnapshot(nextIdx);
    }, 3000); // Shift snapshots every 3 seconds
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
  function buildHierarchy(entities) {
    if (!entities || entities.length === 0) return null;
    
    const map = {};
    entities.forEach(e => {
      map[e.id] = { ...e, children: [] };
    });
    
    let root = null;
    
    entities.forEach(e => {
      const node = map[e.id];
      const managerId = e.manager_name_or_id;
      
      let parent = null;
      if (managerId) {
        if (map[managerId]) {
          parent = map[managerId];
        } else {
          // Fallback fuzzy name matching
          const matched = Object.values(map).find(x => x.full_name.toLowerCase() === managerId.toLowerCase());
          if (matched) {
            parent = matched;
          }
        }
      }
      
      if (parent && parent.id !== node.id) {
        parent.children.push(node);
      } else {
        if (!root) {
          root = node;
        }
      }
    });
    
    // Handle fallback: if no root is resolved (or multiple disconnected graphs)
    if (!root) root = Object.values(map)[0];
    
    // Attach orphans to root to prevent silent clipping
    const visited = new Set();
    function visit(n) {
      if (!n) return;
      visited.add(n.id);
      n.children.forEach(visit);
    }
    visit(root);
    
    Object.values(map).forEach(n => {
      if (!visited.has(n.id)) {
        root.children.push(n);
        visit(n);
      }
    });
    
    return root;
  }

  // ==========================================================================
  // D3 Org Chart Tree Rendering Engine
  // ==========================================================================
  function renderTree(treeData) {
    // Clear old visual elements
    canvasContainer.querySelectorAll("svg").forEach(s => s.remove());
    if (!treeData) return;

    const width = canvasContainer.clientWidth;
    const height = canvasContainer.clientHeight;

    // Create D3 canvas elements
    svg = d3.select("#canvas-container")
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("aria-label", "Organizational Chart Tree");

    // Add gradient defs for nodes/borders
    const defs = svg.append("defs");
    const glowFilter = defs.append("filter")
      .attr("id", "blue-glow")
      .attr("x", "-20%")
      .attr("y", "-20%")
      .attr("width", "140%")
      .attr("height", "140%");
    glowFilter.append("feGaussianBlur")
      .attr("stdDeviation", "4")
      .attr("result", "blur");
    glowFilter.append("feComposite")
      .attr("in", "SourceGraphic")
      .attr("in2", "blur")
      .attr("operator", "over");

    g = svg.append("g");

    // Setup pan/zoom actions
    zoomBehavior = d3.zoom()
      .scaleExtent([0.3, 3])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });
    svg.call(zoomBehavior);

    // D3 Tree Layout Generation
    const root = d3.hierarchy(treeData);
    
    // Dynamic layout sizing depending on nodes
    const nodeCount = root.descendants().length;
    const treeHeight = Math.max(height - 100, nodeCount * 45);
    const treeWidth = width - 260;

    const treeLayout = d3.tree().size([treeHeight, treeWidth]);
    treeLayout(root);

    // Move tree g container slightly to the right/center
    const initialX = 80;
    const initialY = 40;
    svg.call(zoomBehavior.transform, d3.zoomIdentity.translate(initialX, initialY).scale(0.9));

    // 1. Draw connecting link paths (manager lines)
    const links = g.selectAll(".link")
      .data(root.links())
      .enter()
      .append("path")
      .attr("class", "link")
      .attr("id", d => `link-${d.source.data.id}-${d.target.data.id}`)
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
        // Map clean dept strings for style rules
        const deptClean = d.data.department ? d.data.department.split(" ")[0] : "Other";
        return `node dept-${deptClean}`;
      })
      .attr("id", d => `node-${d.data.id}`)
      .attr("transform", d => `translate(${d.y},${d.x})`)
      .on("click", (event, d) => {
        // Toggle selected state
        g.selectAll(".node").classList?.remove("selected");
        d3.selectAll(".node").classed("selected", false);
        
        d3.select(`#node-${d.data.id}`).classed("selected", true);
        selectedNodeId = d.data.id;
        
        // Show Profile detail panel
        showProfileDetails(d.data);
        
        // Highlight reporting path up to root
        highlightReportingPath(d);
      });

    // Node Circles
    nodes.append("circle")
      .attr("r", 7.5);

    // Name labels
    nodes.append("text")
      .attr("dy", "-11px")
      .attr("x", 0)
      .attr("text-anchor", "middle")
      .text(d => d.data.full_name);

    // Title label
    nodes.append("text")
      .attr("dy", "16px")
      .attr("x", 0)
      .attr("text-anchor", "middle")
      .style("font-size", "9px")
      .style("fill", "var(--text-color-muted)")
      .text(d => {
        const title = d.data.job_title || "";
        return title.length > 20 ? title.substring(0, 18) + "..." : title;
      });
  }

  // Highlight paths up to manager roots
  function highlightReportingPath(currentNode) {
    // Reset all link styles first
    g.selectAll(".link")
      .style("stroke", "rgba(99, 102, 241, 0.2)")
      .style("stroke-width", "1.5px")
      .style("filter", "none");

    let n = currentNode;
    while (n && n.parent) {
      const linkId = `#link-${n.parent.data.id}-${n.data.id}`;
      d3.select(linkId)
        .style("stroke", "var(--color-accent-pink)")
        .style("stroke-width", "3px")
        .style("filter", "drop-shadow(0 0 5px var(--color-accent-pink))");
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

    // Get initials for Avatar
    const names = entity.full_name.split(" ");
    const initials = names.map(n => n[0]).join("").substring(0, 2).toUpperCase();
    profAvatar.innerText = initials;

    profName.innerText = entity.full_name;
    profTitle.innerText = entity.job_title;
    profDept.innerText = entity.department || "N/A";
    
    // Display reporting lines
    if (entity.manager_name_or_id) {
      profManager.innerText = entity.manager_name_or_id;
      profManager.classList.add("highlight-link");
      
      // Add linking capability back to tree clicking
      profManager.onclick = () => {
        // Find node inside D3 and trigger click
        const managerNode = g.selectAll(".node").filter(d => {
          return d.data.id === entity.manager_name_or_id || d.data.full_name === entity.manager_name_or_id;
        });
        if (!managerNode.empty()) {
          const d = managerNode.datum();
          // Select manager node and highlight path
          d3.selectAll(".node").classed("selected", false);
          d3.select(`#node-${d.data.id}`).classed("selected", true);
          selectedNodeId = d.data.id;
          showProfileDetails(d.data);
          highlightReportingPath(d);
        }
      };
    } else {
      profManager.innerText = "None (CEO / Founder)";
      profManager.classList.remove("highlight-link");
      profManager.onclick = null;
    }

    profBio.innerText = entity.bio_summary || "No professional biography extracted for this snapshot.";

    // Generate Skills tags
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
      tag.style.opacity = 0.5;
      tag.innerText = "None extracted";
      profSkills.appendChild(tag);
    }
  }

  // ==========================================================================
  // Natural Language Search / Highlighter
  // ==========================================================================
  nodeSearchInput.addEventListener("input", (e) => {
    const query = e.target.value.toLowerCase().trim();
    
    if (!g) return;

    // Reset highlights
    g.selectAll(".node").classed("highlight", false);

    if (!query) return;

    g.selectAll(".node").classed("highlight", d => {
      const nameMatch = d.data.full_name.toLowerCase().includes(query);
      const titleMatch = d.data.job_title?.toLowerCase().includes(query);
      const deptMatch = d.data.department?.toLowerCase().includes(query);
      
      const skillsMatch = d.data.expertise_keywords?.some(skill => 
        skill.toLowerCase().includes(query)
      );

      return nameMatch || titleMatch || deptMatch || skillsMatch;
    });
  });

  // Handle Demo Pill Clicks
  document.querySelectorAll(".demo-pill").forEach(pill => {
    pill.addEventListener("click", () => {
      urlInput.value = pill.getAttribute("data-url");
      limitSelect.value = "2"; // Demo snapshots are pre-generated with limit=2
      // Programmatically trigger search form submission using the button click
      submitBtn.click();
    });
  });
});
