// AutoBrix Application Shell Orchestrator

class AppShell {
  constructor() {
    this.panels = {};
  }

  init() {
    this.bindGlobalControls();
    this.mountActivePanels();
  }

  bindGlobalControls() {
    // Dark/Light Theme Switcher
    const themeBtn = document.getElementById("theme-toggle");
    if (themeBtn) {
      const savedTheme = localStorage.getItem("autobrix_theme") || "dark";
      if (savedTheme === "light") {
        document.body.classList.add("light-theme");
        themeBtn.innerHTML = `
          <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
        `;
      } else {
        document.body.classList.remove("light-theme");
        themeBtn.innerHTML = `
          <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"></circle><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"></path></svg>
        `;
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
    }

    // Reset Data Action (useful for testing)
    const resetBtn = document.getElementById("reset-toggle");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        if (confirm("Reset all operational data? This restores default menu items and stock configurations.")) {
          localStorage.removeItem("autobrix_state");
          window.location.reload();
        }
      });
    }
  }

  mountActivePanels() {
    // 1. Standalone POS Cashier
    if (document.getElementById("single-pos")) {
      window.posPanel = new POSPanel("single-pos");
      window.posPanel.init();
      this.panels.pos = window.posPanel;
    }

    // 2. Standalone Kitchen A
    if (document.getElementById("single-kds-a")) {
      window.kitchenDisplayA = new KitchenDisplay("single-kds-a", "A");
      window.kitchenDisplayA.init();
      this.panels.kitchenA = window.kitchenDisplayA;
    }

    // 3. Standalone Kitchen B
    if (document.getElementById("single-kds-b")) {
      window.kitchenDisplayB = new KitchenDisplay("single-kds-b", "B");
      window.kitchenDisplayB.init();
      this.panels.kitchenB = window.kitchenDisplayB;
    }

    // 4. Standalone Operations
    if (document.getElementById("single-ops")) {
      window.opsPanel = new OperationsPanel("single-ops");
      window.opsPanel.init();
      this.panels.operations = window.opsPanel;
    }

    // 5. Standalone Owner Admin
    if (document.getElementById("single-owner")) {
      window.ownerPanel = new OwnerPanel("single-owner");
      window.ownerPanel.init();
      this.panels.owner = window.ownerPanel;
    }

    // 6. Unified Control Hub Dashboard
    if (document.getElementById("panel-hub")) {
      window.posPanel = new POSPanel("hub-pos");
      window.posPanel.init();
      this.panels.pos = window.posPanel;

      window.kitchenDisplayA = new KitchenDisplay("hub-kds-a", "A");
      window.kitchenDisplayA.init();
      this.panels.kitchenA = window.kitchenDisplayA;

      window.kitchenDisplayB = new KitchenDisplay("hub-kds-b", "B");
      window.kitchenDisplayB.init();
      this.panels.kitchenB = window.kitchenDisplayB;
    }
  }
}

// Boot up app on DOM Load
document.addEventListener("DOMContentLoaded", () => {
  window.appShell = new AppShell();
  window.appShell.init();
});
