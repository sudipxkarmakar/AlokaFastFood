// AutoBrix Application Shell Orchestrator

class AppShell {
  constructor() {
    this.currentView = "hub"; // hub, receptionist, kitchen-a, kitchen-b, operations, owner
    this.panels = {};
  }

  init() {
    this.bindGlobalControls();
    this.routeView(this.currentView);
  }

  bindGlobalControls() {
    // Top Navigation View Switchers
    document.querySelectorAll(".nav-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const view = btn.dataset.view;
        this.routeView(view);
      });
    });

    // Dark/Light Theme Switcher
    const themeBtn = document.getElementById("theme-toggle");
    
    // Check localStorage
    const savedTheme = localStorage.getItem("autobrix_theme") || "dark";
    if (savedTheme === "light") {
      document.body.classList.add("light-theme");
      themeBtn.innerHTML = `
        <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
      `; // show moon icon (to switch to dark)
    } else {
      document.body.classList.remove("light-theme");
      themeBtn.innerHTML = `
        <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"></circle><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"></path></svg>
      `; // show sun icon (to switch to light)
    }

    themeBtn.addEventListener("click", () => {
      const isLight = document.body.classList.toggle("light-theme");
      if (isLight) {
        localStorage.setItem("autobrix_theme", "light");
        themeBtn.innerHTML = `
          <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
        `;
      } else {
        localStorage.setItem("autobrix_theme", "dark");
        themeBtn.innerHTML = `
          <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"></circle><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"></path></svg>
        `;
      }
    });

    // Reset Data Action (useful for testing)
    document.getElementById("reset-toggle").addEventListener("click", () => {
      if (confirm("Reset all operational data? This restores default menu items and stock configurations.")) {
        localStorage.removeItem("autobrix_state");
        window.location.reload();
      }
    });
  }

  routeView(view) {
    this.currentView = view;

    // Clean up active interval timers in panels to prevent leakages
    if (this.panels.kitchenA) this.panels.kitchenA.destroy();
    if (this.panels.kitchenB) this.panels.kitchenB.destroy();
    if (this.panels.operations) this.panels.operations.destroy();

    // Toggle navigation button classes
    document.querySelectorAll(".nav-btn").forEach(btn => {
      if (btn.dataset.view === view) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });

    // Toggle panel displays
    document.querySelectorAll(".view-panel").forEach(panel => {
      panel.classList.remove("active");
    });

    const activePanelEl = document.getElementById(`panel-${view}`);
    if (activePanelEl) activePanelEl.classList.add("active");

    // Initialize/Mount views dynamically
    if (view === "hub") {
      this.mountControlHub();
    } else if (view === "receptionist") {
      this.mountSinglePOS();
    } else if (view === "kitchen-a") {
      this.mountSingleKitchenA();
    } else if (view === "kitchen-b") {
      this.mountSingleKitchenB();
    } else if (view === "operations") {
      this.mountSingleOperations();
    } else if (view === "owner") {
      this.mountSingleOwner();
    }
  }

  // --- Mounting Routines ---
  mountControlHub() {
    const hubContainer = document.getElementById("panel-hub");
    hubContainer.innerHTML = `
      <div class="control-hub-grid">
        <div class="hub-pane" style="grid-column: span 1; grid-row: span 2;">
          <div class="hub-header">
            <span class="hub-title">Receptionist Checkout POS</span>
          </div>
          <div class="hub-content" id="hub-pos"></div>
        </div>
        
        <div class="hub-pane">
          <div class="hub-header">
            <span class="hub-title">Kitchen Display Screen A</span>
          </div>
          <div class="hub-content" id="hub-kds-a"></div>
        </div>
        
        <div class="hub-pane" style="grid-column: span 1; grid-row: span 1;">
          <div class="hub-header">
            <span class="hub-title">Kitchen Display Screen B</span>
          </div>
          <div class="hub-content" id="hub-kds-b"></div>
        </div>
      </div>
    `;

    // Instantiate and bind panels globally for click delegations in DOM template string
    window.posPanel = new POSPanel("hub-pos");
    window.posPanel.init();

    window.kitchenDisplayA = new KitchenDisplay("hub-kds-a", "A");
    window.kitchenDisplayA.init();

    window.kitchenDisplayB = new KitchenDisplay("hub-kds-b", "B");
    window.kitchenDisplayB.init();
    
    this.panels.kitchenA = window.kitchenDisplayA;
    this.panels.kitchenB = window.kitchenDisplayB;
  }

  mountSinglePOS() {
    const posContainer = document.getElementById("panel-receptionist");
    posContainer.innerHTML = `<div id="single-pos" style="height:100%;"></div>`;
    window.posPanel = new POSPanel("single-pos");
    window.posPanel.init();
  }

  mountSingleKitchenA() {
    const kAContainer = document.getElementById("panel-kitchen-a");
    kAContainer.innerHTML = `<div id="single-kds-a" style="height:100%;"></div>`;
    window.kitchenDisplayA = new KitchenDisplay("single-kds-a", "A");
    window.kitchenDisplayA.init();
    this.panels.kitchenA = window.kitchenDisplayA;
  }

  mountSingleKitchenB() {
    const kBContainer = document.getElementById("panel-kitchen-b");
    kBContainer.innerHTML = `<div id="single-kds-b" style="height:100%;"></div>`;
    window.kitchenDisplayB = new KitchenDisplay("single-kds-b", "B");
    window.kitchenDisplayB.init();
    this.panels.kitchenB = window.kitchenDisplayB;
  }

  mountSingleOperations() {
    const opsContainer = document.getElementById("panel-operations");
    opsContainer.innerHTML = `<div id="single-ops" style="height:100%;"></div>`;
    window.opsPanel = new OperationsPanel("single-ops");
    window.opsPanel.init();
    this.panels.operations = window.opsPanel;
  }

  mountSingleOwner() {
    const ownerContainer = document.getElementById("panel-owner");
    ownerContainer.innerHTML = `<div id="single-owner" style="height:100%;"></div>`;
    window.ownerPanel = new OwnerPanel("single-owner");
    window.ownerPanel.init();
  }
}

// Boot up app on DOM Load
document.addEventListener("DOMContentLoaded", () => {
  window.appShell = new AppShell();
  window.appShell.init();
});
