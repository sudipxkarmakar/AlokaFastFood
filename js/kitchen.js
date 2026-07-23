// AutoBrix Kitchen Display Screen (KDS) Controller

class KitchenDisplay {
  constructor(containerId, screenType) {
    this.container = document.getElementById(containerId);
    this.screenType = screenType; // "A" or "B"
    this.timerInterval = null;
    
    // Map screen types to assigned station IDs
    // Screen A: Rolls, Paratha, Chinese (Pasta, Noodles, Chowmein)
    // Screen B: Fry, Mughlai, Curry/Main courses
    this.stations = this.screenType === "A" 
      ? ["tawa", "chilley"] 
      : ["deep_fry", "moghlai", "kosha", "moghlai_tawa"];
      
    this.chimeAudio = null;
    this.lastOrderCount = 0;
  }

  init() {
    this.render();
    this.startTimers();
    
    // Subscribe to store changes
    window.AutoBrixStore.subscribe((state, reason) => {
      this.renderOrdersGrid(state);
      this.playChimeOnNewOrder(state);
    });

    // Initial render
    this.renderOrdersGrid(window.AutoBrixStore.state);
  }

  render() {
    // If the wrapper is already statically defined in HTML, don't overwrite it
    if (this.container.querySelector(".kitchen-view-wrapper")) {
      return;
    }
    const titleText = this.screenType === "A" 
      ? "KITCHEN SCREEN A — FAST FOOD / ROLLS / CHINESE" 
      : "KITCHEN SCREEN B — MAINS / FRY / MUGHLAI";

    this.container.innerHTML = `
      <div class="kitchen-view-wrapper">
        <div class="kitchen-header">
          <div style="display:flex; align-items:center; gap:0.75rem;">
            <span class="logo-icon" style="background:${this.screenType === "A" ? "#5850ec" : "#ec4899"}">${this.screenType}</span>
            <h3 style="font-size:1.1rem; font-weight:700; font-family:var(--font-sans);">${titleText}</h3>
          </div>
          <div class="kitchen-stats">
            <span class="kitchen-stat-item">Active Orders: <strong id="k-active-count">0</strong></span>
            <span class="kitchen-stat-item">Avg Prep Time: <strong id="k-avg-wait">0m</strong></span>
          </div>
        </div>
        <div class="kitchen-orders-scroll" id="kitchen-orders-container"></div>
      </div>
    `;
  }

  startTimers() {
    // Refresh countdown timers and delays every second
    this.timerInterval = setInterval(() => {
      this.updateTimers();
    }, 1000);
  }

  destroy() {
    if (this.timerInterval) clearInterval(this.timerInterval);
  }

  playChimeOnNewOrder(state) {
    // Find active orders matching this screen
    const matchingOrders = state.orders.filter(o => 
      ["ACCEPTED", "COOKING"].includes(o.fulfillmentStatus) &&
      o.items.some(it => this.stations.includes(it.station) && it.status !== "READY")
    );

    if (matchingOrders.length > this.lastOrderCount) {
      this.triggerAudioChime();
    }
    this.lastOrderCount = matchingOrders.length;
  }

  triggerAudioChime() {
    try {
      // Inline Synthesized Audio using Web Audio API (zero external files required!)
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      osc.type = "sine";
      // Double chime sound
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
      
      osc.frequency.setValueAtTime(880.00, audioCtx.currentTime + 0.18); // A5
      gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime + 0.18);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
      
      osc.start(audioCtx.currentTime);
      osc.stop(audioCtx.currentTime + 0.4);
    } catch (e) {
      console.warn("Audio chime block by browser auto-play policy.", e);
    }
  }

  renderOrdersGrid(state) {
    const container = this.container.querySelector(".kitchen-orders-scroll") || document.getElementById("kitchen-orders-container");
    if (!container) return;

    // Filter orders:
    // 1. Must be in ACCEPTED or COOKING status
    // 2. Must contain items belonging to this screen's stations
    // 3. Those items must not be fully completed ("READY") yet
    let activeOrders = state.orders.filter(order => {
      const isStatusActive = ["ACCEPTED", "COOKING", "READY"].includes(order.fulfillmentStatus);
      if (!isStatusActive) return false;

      // check if any item of this order belongs to this display and is not yet READY
      return order.items.some(item => this.stations.includes(item.station) && item.status !== "READY");
    });

    // Priority sort: VIP > SWIGGY = ZOMATO > TAKEAWAY > NORMAL
    const priorityWeight = { VIP: 5, SWIGGY: 4, ZOMATO: 4, TAKEAWAY: 3, NORMAL: 2 };
    
    activeOrders.sort((a, b) => {
      const aRunning = !!a.ts_active;
      const bRunning = !!b.ts_active;
      if (aRunning !== bRunning) {
        return aRunning ? -1 : 1;
      }

      const weightA = priorityWeight[a.priority] || 0;
      const weightB = priorityWeight[b.priority] || 0;

      if (weightA !== weightB) {
        return weightB - weightA; // Higher weight first
      }

      const queueA = a.ts_queued || (a.timestamps && a.timestamps.queued) || a.ts_active || a.timestamp;
      const queueB = b.ts_queued || (b.timestamps && b.timestamps.queued) || b.ts_active || b.timestamp;
      return new Date(queueA) - new Date(queueB);
    });

    // Update Header stats
    const activeCountEl = this.container.querySelector("#k-active-count") || this.container.querySelector(".kitchen-stats strong");
    if (activeCountEl) activeCountEl.innerText = activeOrders.length;
    
    // Calculate avg wait time of completed orders from closing history or live completed
    let totalPrepTimes = 0;
    let completedCount = 0;
    state.orders.forEach(o => {
      if (o.fulfillmentStatus === "COMPLETED" && o.timestamps.completed && o.timestamps.accepted) {
        const diffMs = new Date(o.timestamps.completed) - new Date(o.timestamps.accepted);
        totalPrepTimes += diffMs / 1000 / 60; // minutes
        completedCount++;
      }
    });
    const avgText = completedCount > 0 ? `${Math.round(totalPrepTimes / completedCount)}m` : "5m";
    const avgWaitEl = this.container.querySelector("#k-avg-wait") || this.container.querySelector(".kitchen-stats span:nth-child(2) strong");
    if (avgWaitEl) avgWaitEl.innerText = avgText;



    if (activeOrders.length === 0) {
      container.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; width:100%; color:var(--text-muted); gap:0.5rem; text-align:center;">
          <svg width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"></path></svg>
          <span style="font-size:1rem; font-weight:500;">Kitchen Queue Clear!</span>
          <span style="font-size:0.8rem;">No active orders for this station.</span>
        </div>
      `;
      return;
    }

    container.innerHTML = activeOrders.map((order, idx) => {
      const isOnHold = idx > 0;
      const priorityClass = `priority-${order.priority}`;
      const orderedItems = window.AutoBrixStore.sortOrderItems(order.items);
      
      // Filter items in the card (show other station items with lower opacity)
      const itemsHTML = orderedItems.map((item, index) => {
        if (item.status === "READY") return "";

        const isOtherStation = !this.stations.includes(item.station);
        const otherStyle = isOtherStation ? "opacity: 0.55; font-style: italic;" : "";
        const stationBadge = isOtherStation ? `<span style="background: rgba(255,255,255,0.06); color: var(--text-muted); font-size: 0.6rem; padding: 1px 4px; border-radius: 4px; font-weight: 700; font-style: normal; margin-left: 6px; text-transform: uppercase; vertical-align: middle;">${item.station}</span>` : "";

        const modifiersConfig = state.config.modifiers;
        const getModifierImgHTML = (modId, size = 20) => {
          const fileMap = {
            no_onion: "NO ONION.png",
            only_onion: "ONLY ONION.png",
            no_salad: "NO SALAD.png",
            no_sauce: "NO SAUCE.png",
            extra_sauce: "EXTRA SAUCE.png",
            no_spice: "NO SPICE.png",
            extra_spice: "EXTRA SPICE.png",
            extra_egg: "EXTRA EGG.png"
          };
          const filename = fileMap[modId];
          if (!filename) return "";
          return `<img src="http://localhost:3001/uploads/${encodeURIComponent(filename)}" width="${size}" height="${size}" style="margin-right:4px; object-fit:contain; flex-shrink:0; vertical-align:middle; border-radius:3px;" onerror="this.style.display='none'">`;
        };

        const modsListHTML = item.modifiers.map(mId => {
          const mod = modifiersConfig[mId];
          if (!mod) return "";
          const icon = getModifierImgHTML(mId, 20);
          return `<span class="k-mod-badge" style="display:inline-flex; align-items:center; background:rgba(255,255,255,0.06); padding:4px 8px; border-radius:4px; margin-right:4px; margin-top:4px; font-size:0.75rem; font-weight:700; border:1px solid rgba(255,255,255,0.12); color:var(--text-primary);">${icon}${mod.name}</span>`;
        }).filter(Boolean).join("");
        
        const modsHTML = modsListHTML ? `<div class="k-item-modifiers" style="display:flex; flex-wrap:wrap; margin-top:2px;">${modsListHTML}</div>` : "";

        const highlightStyle = item.is_new 
          ? "background:rgba(245,158,11,0.08); border-left:4px solid #d97706; border-top:1px dashed rgba(245,158,11,0.25); border-bottom:1px dashed rgba(245,158,11,0.25); border-right:1px dashed rgba(245,158,11,0.25); padding:8px 12px; margin:4px -12px; border-radius:0 6px 6px 0;" 
          : "padding:8px 0;";

        return `
          <div class="k-item" style="border-bottom:1px solid rgba(255,255,255,0.04); ${highlightStyle} ${otherStyle}">
            <div class="k-item-header" style="margin-bottom:6px;">
              <div style="display:flex; align-items:center;">
                <span class="k-item-qty" style="font-size:1.15rem; font-weight:800; color:var(--accent-color); margin-right:8px;">${item.quantity}x</span>
                <div style="display:flex; flex-direction:column;">
                  <div style="display:flex; align-items:center; gap:6px;">
                    <span class="k-item-name" style="font-size:0.95rem; font-weight:700; color:var(--text-primary);">${item.name} ${stationBadge}</span>
                    ${item.is_new ? '<span style="background:#d97706; color:white; font-size:0.6rem; font-weight:800; padding:1px 4px; border-radius:4px; text-transform:uppercase; letter-spacing:0.05em;">New</span>' : ""}
                  </div>
                  ${modsHTML}
                </div>
              </div>
            </div>
          </div>
        `;
      }).join("");

      const subsetSum = order.items
        .filter(it => this.stations.includes(it.station) && it.status !== "READY")
        .reduce((sum, it) => sum + (it.prepTime * it.quantity), 0);
      const totalItemPrepTime = subsetSum || order.eta || 0;
      const hasNewItemsForStation = order.items.some(it => this.stations.includes(it.station) && it.status !== "READY" && it.is_new);
      const readyButtonStyle = hasNewItemsForStation
        ? "background:#d97706; color:#ffffff; box-shadow:0 0 0 2px rgba(245,158,11,0.25);"
        : "";
      const readyButtonText = hasNewItemsForStation ? "Mark Added Items Ready" : "Mark Ready";

      // Calculate backwards timer values
      const startTimestamp = order.ts_active ? new Date(order.ts_active) : new Date();
      const elapsedSec = Math.floor((new Date() - startTimestamp) / 1000);
      const elapsedMin = Math.floor(elapsedSec / 60);
      const remainingSec = (totalItemPrepTime * 60) - (isOnHold ? 0 : elapsedSec);
      const isDelayed = !isOnHold && remainingSec < 0;
      const absSec = Math.abs(remainingSec);
      const min = Math.floor(absSec / 60);
      const sec = absSec % 60;
      const formattedElapsed = (isDelayed ? "-" : "") + min + ":" + sec.toString().padStart(2, "0");
        
      const delayMin = elapsedMin - totalItemPrepTime;
      const delayText = isDelayed ? "DELAYED by " + delayMin + "m" : "ETA: " + totalItemPrepTime + "m";

      const isRunningOrder = !!order.ts_active && ["ACCEPTED", "COOKING"].includes(order.fulfillmentStatus);
      let deliveryTime;
      if (isRunningOrder) {
        const activeTime = new Date(order.ts_active);
        const pendingPrep = order.items
          .filter(it => it.status !== "READY")
          .reduce((sum, it) => sum + (it.prepTime * it.quantity), 0);
        const prepMin = pendingPrep || totalItemPrepTime;
        deliveryTime = new Date(activeTime.getTime() + prepMin * 60 * 1000);
      } else {
        const queueTimeStr = order.ts_queued || (order.timestamps && order.timestamps.queued) || order.timestamp;
        const queueTime = queueTimeStr ? new Date(queueTimeStr) : new Date();
        const estMinutes = (typeof order.eta === "number" && order.eta > 0)
          ? order.eta
          : window.AutoBrixStore.calculateCartWaitTime(order.items, { excludeOrderId: order.id });
        deliveryTime = new Date(queueTime.getTime() + estMinutes * 60 * 1000);
      }

      let dHours = deliveryTime.getHours();
      const dMinutes = deliveryTime.getMinutes().toString().padStart(2, '0');
      const dAmpm = dHours >= 12 ? 'PM' : 'AM';
      dHours = dHours % 12;
      dHours = dHours ? dHours : 12;
      const formattedDelivery = dHours.toString().padStart(2, '0') + ":" + dMinutes + " " + dAmpm;

      // Compute dynamic card style based on elapsed time ratio (0 for on-hold)
      const ratio = (!isOnHold && totalItemPrepTime > 0) ? (elapsedMin / totalItemPrepTime) : 0;
      let cardStyle = "background: var(--bg-card); border: 1px solid rgba(255,255,255,0.08);";
      if (ratio >= 1.0) {
        cardStyle = "background: linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(239, 68, 68, 0.05)); border: 1px solid rgba(239, 68, 68, 0.4);";
      } else if (ratio >= 0.6) {
        cardStyle = "background: linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(245, 158, 11, 0.05)); border: 1px solid rgba(245, 158, 11, 0.4);";
      } else {
        cardStyle = "background: linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(16, 185, 129, 0.03)); border: 1px solid rgba(16, 185, 129, 0.25);";
      }

      return `
        <div class="kitchen-order-card ${priorityClass} ${isDelayed ? "delayed" : ""}" id="k-card-${order.id}" data-timestamp="${order.ts_active || ""}" data-preptime="${totalItemPrepTime}" style="${cardStyle} border-radius:8px; padding:12px; margin-bottom:12px; transition:all 0.3s ease; ${isOnHold ? "pointer-events: none; user-select: none; border-color: rgba(255,255,255,0.05);" : ""}">
          <div class="kitchen-card-header" style="border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:6px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:flex-start;">
            <div class="kitchen-card-meta" style="display:flex; flex-direction:column; gap:2px;">
              <div style="display:flex; align-items:center; gap:6px;">
                <span class="kitchen-card-id" style="font-size:1rem; font-weight:800; color:var(--text-primary);">${order.id}</span>
                ${isOnHold ? '<span style="background:rgba(255,255,255,0.08); color:var(--text-muted); border:1px solid rgba(255,255,255,0.12); font-size:0.65rem; font-weight:800; padding:1px 6px; border-radius:4px; text-transform:uppercase; letter-spacing:0.05em;">On Hold</span>' : ""}
              </div>
              <span class="kitchen-card-time" style="font-size:0.75rem; color:var(--text-muted);">${order.customerName} [${order.source}]</span>
            </div>
            <span class="badge badge-${order.priority.toLowerCase()}">${order.priority}</span>
          </div>
          <div class="kitchen-card-body">
            <div class="kitchen-card-items-list">
              ${itemsHTML}
            </div>
            <button class="k-item-btn cooking" style="width:100%; border:none; padding:10px; border-radius:6px; font-weight:800; font-size:0.9rem; cursor:pointer; margin-top:12px; margin-bottom:4px; text-transform:uppercase; letter-spacing:0.02em; ${readyButtonStyle}" onclick="kitchenDisplay${this.screenType}.markOrderAsReady('${order.id}')">
              ${readyButtonText}
            </button>
          </div>
          <div class="kitchen-card-footer" style="border-top:1px solid rgba(255,255,255,0.08); padding-top:6px; margin-top:8px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:4px;">
            <span class="kitchen-timer-display ${isDelayed ? "delayed" : ""}" id="k-timer-${order.id}" style="display:inline-flex; align-items:center; gap:4px; font-weight:700; font-size:0.85rem;">
              <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><path d="M12 6v6l4 2"></path></svg>
              <span>${formattedElapsed}</span>
            </span>
            <span style="font-size:0.75rem; font-weight:700; color:#fbbf24;">Delv: ${formattedDelivery}</span>
            <span style="font-size:0.8rem; font-weight:800; color:${isDelayed ? "var(--color-critical)" : "var(--text-secondary)"};" id="k-delay-text-${order.id}">
              ${delayText}
            </span>
          </div>
        </div>
      `;
    }).join("");
  }

  updateTimers() {
    const container = this.container.querySelector(".kitchen-orders-scroll") || document.getElementById("kitchen-orders-container");
    if (!container) return;

    const cards = container.querySelectorAll(".kitchen-order-card");
    cards.forEach((card, idx) => {
      const orderId = card.id.replace("k-card-", "");
      const rawTimestamp = card.dataset.timestamp;
      const timestamp = (rawTimestamp && rawTimestamp !== "null") ? new Date(rawTimestamp) : null;
      const prepTime = parseInt(card.dataset.preptime);

      if (idx > 0 || !timestamp || isNaN(timestamp.getTime())) {
        const timerSpan = document.getElementById(`k-timer-${orderId}`);
        if (timerSpan) {
          timerSpan.querySelector("span").innerText = `${prepTime}:00`;
        }
        return;
      }

      const elapsedSec = Math.floor((new Date() - timestamp) / 1000);
      const elapsedMin = Math.floor(elapsedSec / 60);
      const remainingSec = (prepTime * 60) - elapsedSec;
      const isDelayed = remainingSec < 0;
      const absSec = Math.abs(remainingSec);
      const min = Math.floor(absSec / 60);
      const sec = absSec % 60;
      const formattedElapsed = `${isDelayed ? "-" : ""}${min}:${sec.toString().padStart(2, "0")}`;

      // Update stopwatch
      const timerSpan = document.getElementById(`k-timer-${orderId}`);
      if (timerSpan) {
        timerSpan.querySelector("span").innerText = formattedElapsed;
      }

      // Check if delayed and update card background color dynamically
      const ratio = prepTime > 0 ? (elapsedMin / prepTime) : 0;
      if (ratio >= 1.0) {
        card.style.background = "linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(239, 68, 68, 0.05))";
        card.style.borderColor = "rgba(239, 68, 68, 0.4)";
      } else if (ratio >= 0.6) {
        card.style.background = "linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(245, 158, 11, 0.05))";
        card.style.borderColor = "rgba(245, 158, 11, 0.4)";
      } else {
        card.style.background = "linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(16, 185, 129, 0.03))";
        card.style.borderColor = "rgba(16, 185, 129, 0.25)";
      }

      const delayTextSpan = document.getElementById(`k-delay-text-${orderId}`);
      if (delayTextSpan) {
        if (isDelayed) {
          card.classList.add("delayed");
          if (timerSpan) timerSpan.classList.add("delayed");
          const delayMin = elapsedMin - prepTime;
          delayTextSpan.innerText = `DELAYED by ${delayMin}m`;
          delayTextSpan.style.color = "var(--color-critical)";
        } else {
          card.classList.remove("delayed");
          if (timerSpan) timerSpan.classList.remove("delayed");
          delayTextSpan.innerText = `ETA: ${prepTime}m`;
          delayTextSpan.style.color = "var(--text-secondary)";
        }
      }
    });
  }

  async cycleItemStatus(orderId, itemIndex, currentStatus) {
    let nextStatus = "READY";
    if (currentStatus === "COOKING") {
      nextStatus = "READY";
    }

    if (window.AlokaAPI.isOnline()) {
      try {
        await window.AlokaAPI.patch(`/orders/${encodeURIComponent(orderId)}/items/${itemIndex}/status`, { status: nextStatus });
        await window.AlokaAPI.loadAllState();
      } catch (err) {
        alert("Error updating item status: " + err.message);
      }
    } else {
      window.AutoBrixStore.updateOrderItemStatus(orderId, itemIndex, nextStatus);
    }
  }

  async markOrderAsReady(orderId) {
    if (window.AlokaAPI.isOnline()) {
      try {
        await window.AlokaAPI.patch(`/orders/${encodeURIComponent(orderId)}/status`, { fulfillment_status: "READY" });
        await window.AlokaAPI.loadAllState();
      } catch (err) {
        alert("Error marking order ready: " + err.message);
      }
    } else {
      window.AutoBrixStore.updateState(state => {
        const order = state.orders.find(o => o.id === orderId);
        if (order) {
          order.fulfillmentStatus = "READY";
          order.items.forEach(it => {
            if (this.stations.includes(it.station)) {
              it.status = "READY";
            }
          });
        }
      });
    }
  }
}

// Bind globally for inline action buttons
window.KitchenDisplay = KitchenDisplay;
