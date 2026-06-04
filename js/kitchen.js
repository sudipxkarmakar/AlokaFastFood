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
      ? ["roll", "paratha", "chinese"] 
      : ["fry", "mughlai", "main"];
      
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
    const container = document.getElementById("kitchen-orders-container");
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
      const weightA = priorityWeight[a.priority] || 0;
      const weightB = priorityWeight[b.priority] || 0;

      if (weightA !== weightB) {
        return weightB - weightA; // Higher weight first
      }
      // Oldest order first
      return new Date(a.timestamp) - new Date(b.timestamp);
    });

    // Update Header stats
    document.getElementById("k-active-count").innerText = activeOrders.length;
    
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
    document.getElementById("k-avg-wait").innerText = avgText;

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

    container.innerHTML = activeOrders.map(order => {
      const priorityClass = `priority-${order.priority}`;
      
      // Filter items in the card to show ONLY those handled by this screen
      const itemsHTML = order.items.map((item, index) => {
        if (!this.stations.includes(item.station) || item.status === "READY") return "";

        const modifiersConfig = state.config.modifiers;
        const modsText = item.modifiers.map(mId => modifiersConfig[mId]?.name).filter(Boolean).join(", ");
        const modsHTML = modsText ? `<div class="k-item-modifiers">+ ${modsText}</div>` : "";

        // Status cycle button
        let btnClass = "pending";
        let btnText = "Start Cooking";
        if (item.status === "COOKING") {
          btnClass = "cooking";
          btnText = "Mark Ready";
        }

        return `
          <div class="k-item">
            <div class="k-item-header">
              <div style="display:flex; align-items:flex-start;">
                <span class="k-item-qty">${item.quantity}x</span>
                <div style="display:flex; flex-direction:column;">
                  <span class="k-item-name">${item.name}</span>
                  ${modsHTML}
                </div>
              </div>
            </div>
            <button class="k-item-btn ${btnClass}" onclick="kitchenDisplay${this.screenType}.cycleItemStatus('${order.id}', ${index}, '${item.status}')">
              ${btnText}
            </button>
          </div>
        `;
      }).join("");

      // Calculate time values
      const elapsedSec = Math.floor((new Date() - new Date(order.timestamp)) / 1000);
      const elapsedMin = Math.floor(elapsedSec / 60);
      const elapsedSecRemaining = elapsedSec % 60;
      const formattedElapsed = `${elapsedMin}:${elapsedSecRemaining.toString().padStart(2, "0")}`;

      const totalItemPrepTime = order.items
        .filter(it => this.stations.includes(it.station))
        .reduce((max, it) => Math.max(max, it.prepTime), 0);
        
      const isDelayed = elapsedMin >= totalItemPrepTime;
      const delayMin = elapsedMin - totalItemPrepTime;
      const delayText = isDelayed ? `DELAYED by ${delayMin}m` : `ETA: ${totalItemPrepTime}m`;

      return `
        <div class="kitchen-order-card ${priorityClass} ${isDelayed ? "delayed" : ""}" id="k-card-${order.id}" data-timestamp="${order.timestamp}" data-preptime="${totalItemPrepTime}">
          <div class="kitchen-card-header">
            <div class="kitchen-card-meta">
              <span class="kitchen-card-id">#${order.id}</span>
              <span class="kitchen-card-time">${order.customerName} [${order.source}]</span>
            </div>
            <span class="badge badge-${order.priority.toLowerCase()}">${order.priority}</span>
          </div>
          <div class="kitchen-card-body">
            <div class="kitchen-card-items-list">
              ${itemsHTML}
            </div>
          </div>
          <div class="kitchen-card-footer">
            <span class="kitchen-timer-display ${isDelayed ? "delayed" : ""}" id="k-timer-${order.id}">
              <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><path d="M12 6v6l4 2"></path></svg>
              <span>${formattedElapsed}</span>
            </span>
            <span style="font-size:0.75rem; font-weight:700; color:${isDelayed ? "var(--color-critical)" : "var(--text-secondary)"};" id="k-delay-text-${order.id}">
              ${delayText}
            </span>
          </div>
        </div>
      `;
    }).join("");
  }

  updateTimers() {
    const container = document.getElementById("kitchen-orders-container");
    if (!container) return;

    const cards = container.querySelectorAll(".kitchen-order-card");
    cards.forEach(card => {
      const orderId = card.id.replace("k-card-", "");
      const timestamp = new Date(card.dataset.timestamp);
      const prepTime = parseInt(card.dataset.preptime);

      const elapsedSec = Math.floor((new Date() - timestamp) / 1000);
      const elapsedMin = Math.floor(elapsedSec / 60);
      const elapsedSecRemaining = elapsedSec % 60;
      const formattedElapsed = `${elapsedMin}:${elapsedSecRemaining.toString().padStart(2, "0")}`;

      // Update stopwatch
      const timerSpan = document.getElementById(`k-timer-${orderId}`);
      if (timerSpan) {
        timerSpan.querySelector("span").innerText = formattedElapsed;
      }

      // Check if delayed
      const isDelayed = elapsedMin >= prepTime;
      const delayTextSpan = document.getElementById(`k-delay-text-${orderId}`);
      if (delayTextSpan) {
        if (isDelayed) {
          card.classList.add("delayed");
          timerSpan.classList.add("delayed");
          const delayMin = elapsedMin - prepTime;
          delayTextSpan.innerText = `DELAYED by ${delayMin}m`;
          delayTextSpan.style.color = "var(--color-critical)";
        } else {
          card.classList.remove("delayed");
          timerSpan.classList.remove("delayed");
          delayTextSpan.innerText = `ETA: ${prepTime}m`;
          delayTextSpan.style.color = "var(--text-secondary)";
        }
      }
    });
  }

  async cycleItemStatus(orderId, itemIndex, currentStatus) {
    let nextStatus = "COOKING";
    if (currentStatus === "COOKING") {
      nextStatus = "READY";
    }

    if (window.AlokaAPI.isOnline()) {
      try {
        await window.AlokaAPI.patch(`/orders/${orderId}/items/${itemIndex}/status`, { status: nextStatus });
        await window.AlokaAPI.loadAllState();
      } catch (err) {
        alert("Error updating item status: " + err.message);
      }
    } else {
      window.AutoBrixStore.updateOrderItemStatus(orderId, itemIndex, nextStatus);
    }
  }
}

// Bind globally for inline action buttons
window.KitchenDisplay = KitchenDisplay;
