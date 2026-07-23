// AutoBrix POS Cashier/Receptionist Panel Module

class POSPanel {
  constructor(containerId) {
    this.containerId = containerId;
    this.container = document.getElementById(containerId);
    this.activeCategory = "all";
    this.searchQuery = "";
    this.modifyingOrderId = null;
    
    try {
      this.cart = JSON.parse(localStorage.getItem("autobrix_cart")) || [];
      this.customerName = localStorage.getItem("autobrix_cart_customer") || "";
      this.orderSource = localStorage.getItem("autobrix_cart_source") || "DINE_IN";
      this.orderPriority = localStorage.getItem("autobrix_cart_priority") || "NORMAL";
      this.modifyingOrderId = localStorage.getItem("autobrix_modifying_order_id") || null;
    } catch (e) {
      this.cart = [];
      this.customerName = "";
      this.orderSource = "DINE_IN";
      this.orderPriority = "NORMAL";
      this.modifyingOrderId = null;
    }
    this.heldCarts = []; // queue of held orders
    
    this.selectedMenuItem = null; // for variant/modifier modal
    this.selectedVariant = "single";
    this.selectedModifiers = [];
    this.lastModifiers = [];
  }

  saveCart() {
    localStorage.setItem("autobrix_cart", JSON.stringify(this.cart));
    localStorage.setItem("autobrix_cart_customer", this.customerName);
    localStorage.setItem("autobrix_cart_source", this.orderSource);
    localStorage.setItem("autobrix_cart_priority", this.orderPriority);
    if (this.modifyingOrderId) {
      localStorage.setItem("autobrix_modifying_order_id", this.modifyingOrderId);
    } else {
      localStorage.removeItem("autobrix_modifying_order_id");
    }
  }

  init() {
    this.render();
    this.bindEvents();
    
    // Subscribe to store updates to keep stock numbers live!
    window.AutoBrixStore.subscribe(() => {
      this.renderCategories();
      this.renderMenuGrid();
      this.updateCartETA();
    });
  }

  render() {
    // If the wrapper is already statically defined in HTML, don't overwrite it
    if (this.container.querySelector(".receptionist-grid")) {
      this.renderCategories();
      this.renderMenuGrid();
      this.renderCart();
      return;
    }
    this.container.innerHTML = `
      <div class="receptionist-grid">
        <!-- Left Categories Panel -->
        <div class="pos-categories" id="pos-categories-list"></div>
        
        <!-- Center Menu Cards Panel -->
        <div class="pos-menu-wrapper">
          <div class="pos-search-bar">
            <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.3-4.3"></path></svg>
            <input type="text" class="pos-search-input" id="pos-search" placeholder="Search menu item (e.g. Roll, Chowmein, Kosha)..." value="${this.searchQuery}">
          </div>
          <div class="pos-menu-grid" id="pos-menu-items"></div>
        </div>
        
        <!-- Right Cart Panel -->
        <div class="pos-cart">
          <div class="pos-cart-header">
            <span class="pos-cart-title">Current Order</span>
            <span class="badge badge-normal" id="pos-held-count" style="display:none; cursor:pointer;">Held: 0</span>
          </div>
          
          <div class="pos-order-details">
            <div class="form-row">
              <div class="form-group-flex">
                <label class="form-label-xs">Customer Name</label>
                <input type="text" class="pos-input-sm" id="cart-cust-name" placeholder="Walk-in Customer" value="${this.customerName}">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group-flex">
                <label class="form-label-xs">Order Source</label>
                <select class="pos-select-sm" id="cart-order-source">
                  <option value="DINE_IN" ${this.orderSource === "DINE_IN" ? "selected" : ""}>Dine-In (0%)</option>
                  <option value="TAKEAWAY" ${this.orderSource === "TAKEAWAY" ? "selected" : ""}>Takeaway (0%)</option>
                  <option value="SWIGGY" ${this.orderSource === "SWIGGY" ? "selected" : ""}>Swiggy (+22%)</option>
                  <option value="ZOMATO" ${this.orderSource === "ZOMATO" ? "selected" : ""}>Zomato (+22%)</option>
                  <option value="PHONE_ORDER" ${this.orderSource === "PHONE_ORDER" ? "selected" : ""}>Phone Order (0%)</option>
                </select>
              </div>
              <div class="form-group-flex">
                <label class="form-label-xs">Priority</label>
                <select class="pos-select-sm" id="cart-order-priority">
                  <option value="NORMAL" ${this.orderPriority === "NORMAL" ? "selected" : ""}>Dine-In/Normal</option>
                  <option value="TAKEAWAY" ${this.orderPriority === "TAKEAWAY" ? "selected" : ""}>Takeaway</option>
                  <option value="SWIGGY" ${this.orderPriority === "SWIGGY" ? "selected" : ""}>Swiggy</option>
                  <option value="ZOMATO" ${this.orderPriority === "ZOMATO" ? "selected" : ""}>Zomato</option>
                  <option value="VIP" ${this.orderPriority === "VIP" ? "selected" : ""}>🔴 VIP</option>
                </select>
              </div>
            </div>
          </div>
          
          <div class="pos-cart-items" id="pos-cart-items-list"></div>
          
          <div class="pos-cart-eta">
            <span class="eta-label">Estimated Cook Time:</span>
            <span class="eta-value" id="pos-cart-eta-value">0 Min</span>
          </div>
          
          <div class="pos-cart-summary">
            <div class="summary-row">
              <span>Subtotal:</span>
              <span id="pos-subtotal">₹0.00</span>
            </div>
            <div class="summary-row">
              <span>Taxes (GST 5%):</span>
              <span id="pos-tax">₹0.00</span>
            </div>
            <div class="summary-row" id="aggregator-row" style="display:none;">
              <span id="aggregator-label">Aggregator Comm (22%):</span>
              <span id="pos-commission">₹0.00</span>
            </div>
            <div class="summary-row total">
              <span>Grand Total:</span>
              <span id="pos-total">₹0.00</span>
            </div>
          </div>
          
          <div class="pos-cart-actions">
            <button class="pos-action-btn primary" id="cart-confirm-btn">Confirm Order (Space)</button>
            <button class="pos-action-btn secondary" id="cart-hold-btn">Hold Order</button>
            <button class="pos-action-btn danger" id="cart-clear-btn">Cancel Order (Esc)</button>
          </div>
        </div>
      </div>
      
      <!-- Variant/Modifier Selection Modal Overlay (hidden by default) -->
      <div class="modal-overlay" id="pos-customize-modal" style="display:none;"></div>
      
      <!-- Receipt print workspace (hidden from screen, visible for printer) -->
      <div id="invoice-print-area" style="display:none;"></div>
    `;
    
    this.renderCategories();
    this.renderMenuGrid();
    this.renderCart();
  }

  bindEvents() {
    // Category click handler
    document.getElementById("pos-categories-list").addEventListener("click", (e) => {
      const btn = e.target.closest(".category-btn");
      if (btn) {
        this.activeCategory = btn.dataset.category;
        this.renderCategories();
        this.renderMenuGrid();
      }
    });

    // Search filter
    document.getElementById("pos-search").addEventListener("input", (e) => {
      this.searchQuery = e.target.value.toLowerCase();
      this.renderMenuGrid();
    });

    // Set initial values from saved state
    document.getElementById("cart-cust-name").value = this.customerName;
    document.getElementById("cart-order-source").value = this.orderSource;
    document.getElementById("cart-order-priority").value = this.orderPriority;

    // Customer name input
    document.getElementById("cart-cust-name").addEventListener("input", (e) => {
      this.customerName = e.target.value;
      this.saveCart();
    });

    // Order source selector (adjust commissions)
    document.getElementById("cart-order-source").addEventListener("change", (e) => {
      this.orderSource = e.target.value;
      
      // Auto adjust priority to match source for easy operational flow
      if (["SWIGGY", "ZOMATO", "TAKEAWAY"].includes(this.orderSource)) {
        this.orderPriority = this.orderSource;
        document.getElementById("cart-order-priority").value = this.orderSource;
      }
      this.saveCart();
      this.renderCart();
    });

    // Priority selector
    document.getElementById("cart-order-priority").addEventListener("change", (e) => {
      this.orderPriority = e.target.value;
      this.saveCart();
    });

    // Clear cart
    document.getElementById("cart-clear-btn").addEventListener("click", () => this.clearCart());

    // Confirm Order
    document.getElementById("cart-confirm-btn").addEventListener("click", () => this.confirmOrder());

    // Hold Order
    document.getElementById("cart-hold-btn").addEventListener("click", () => this.holdOrder());
    
    // Recall Held Order
    document.getElementById("pos-held-count").addEventListener("click", () => this.recallHeldOrder());

    // Keyboard Shortcuts
    document.addEventListener("keydown", (e) => {
      if (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "SELECT") {
        return; // Ignore if focused on fields
      }
      if (e.key === "Escape") {
        this.clearCart();
      } else if (e.key === " ") {
        e.preventDefault();
        this.confirmOrder();
      }
    });
  }

  renderCategories() {
    const list = document.getElementById("pos-categories-list");
    const menuItems = window.AutoBrixStore.state.config.menuItems;
    
    // Count items in each category
    const categories = [
      { id: "all", name: "All Menu" },
      { id: "rolls", name: "Roll" },
      { id: "pasta", name: "Pasta" },
      { id: "chowmein", name: "Chowmean" },
      { id: "moghlai", name: "Moghlai" },
      { id: "others", name: "Others" },
      { id: "egg", name: "Egg" },
      { id: "cold_drink", name: "Cold Drink" }
    ];

    const svgMap = {
      all: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="14" width="7" height="7" rx="1"></rect><rect x="3" y="14" width="7" height="7" rx="1"></rect></svg>`,
      rolls: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path><path d="M8.5 7h7M7.5 12h9M8.5 17h7"></path></svg>`,
      pasta: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12a10 10 0 0 0 20 0H2Z"></path><path d="M12 2v10M8 3v9M16 3v9M6 5v7M18 5v7M12 12c0 3 2 4 2 4"></path></svg>`,
      chowmein: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11a9 9 0 0 0 18 0H3Z"></path><path d="m19 2-8 8M21 4 13 12M8 11s0-4-2-4M12 11s0-5-3-5M16 11s0-3-1-3"></path></svg>`,
      moghlai: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 2a15.3 15.3 0 0 1 0 20M2 12a15.3 15.3 0 0 1 20 0"></path></svg>`,
      others: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>`,
      egg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2C8.5 2 6 7.5 6 12s2.5 10 6 10 6-5.5 6-10S15.5 2 12 2Z"></path></svg>`,
      cold_drink: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 8H7l1 13h8zM6 8h12M15 8l1-5"></path></svg>`
    };

    const catsHTML = categories.map(cat => {
      let count = 0;
      if (cat.id === "all") {
        count = Object.values(menuItems).filter(item => item.active).length;
      } else {
        count = Object.values(menuItems).filter(item => item.active && this.isItemInCat(item, cat.id)).length;
      }

      return `
        <button class="category-btn ${this.activeCategory === cat.id ? "active" : ""}" data-category="${cat.id}" title="${cat.name}" style="display:flex; justify-content:center; align-items:center; width:52px; height:52px; padding:0; border-radius:12px; position:relative; flex-shrink:0; margin: 0 auto 0.25rem auto;">
          ${svgMap[cat.id] || ""}
          <span class="category-count" style="position:absolute; top:-4px; right:-4px; font-size:0.65rem; padding:1px 5px; border-radius:10px; font-weight:800; border:2px solid var(--bg-card);">${count}</span>
        </button>
      `;
    }).join("");

    const activeDineInOrders = (window.AutoBrixStore.state.orders || []).filter(o => 
      (o.source === "DINE_IN" || o.source === "BOTH") && 
      o.paymentStatus === "UNPAID" && 
      ["ACCEPTED", "COOKING", "READY", "COMPLETED"].includes(o.fulfillmentStatus)
    );

    const dividerHTML = activeDineInOrders.length > 0 ? `<div style="width:28px; height:1px; background:rgba(255,255,255,0.1); margin:0.75rem auto;"></div>` : "";

    const dineInHTML = activeDineInOrders.map(order => {
      const mainItem = order.items[0];
      const mainCat = mainItem ? this.getItemCategory(mainItem.id) : "all";
      const icon = svgMap[mainCat] || svgMap.all;
      const displaySerial = order.id.split('-').pop();

      return `
        <button class="active-dine-circle" onclick="posPanel.loadOrderForModification('${order.id}')" title="Modify Order ${order.id}" style="display:flex; justify-content:center; align-items:center; width:44px; height:44px; border-radius:50%; border:2px solid var(--accent-color); background:rgba(88,80,236,0.1); color:var(--accent-color); cursor:pointer; position:relative; flex-shrink:0; margin:0.35rem auto; transition:all 0.2s ease;">
          ${icon}
          <span style="position:absolute; bottom:-4px; right:-4px; background:var(--bg-card); color:var(--text-primary); border:1px solid rgba(255,255,255,0.08); font-size:0.55rem; font-weight:800; padding:0 3px; border-radius:4px; transform:scale(0.85);">${displaySerial}</span>
        </button>
      `;
    }).join("");

    list.innerHTML = catsHTML + dividerHTML + dineInHTML;
  }

  isItemInCat(item, categoryId) {
    if (categoryId === "rolls") {
      return item.id.toLowerCase().includes("roll");
    }
    if (categoryId === "pasta") {
      return item.id.toLowerCase().includes("pasta");
    }
    if (categoryId === "chowmein") {
      return item.id.toLowerCase().includes("chowmein") || item.id.toLowerCase().includes("chowmean") || item.name.toLowerCase().includes("chowmein") || item.name.toLowerCase().includes("chowmean");
    }
    if (categoryId === "moghlai") {
      return item.id.toLowerCase().includes("moghlai") || item.id.toLowerCase().includes("mughlai") || item.name.toLowerCase().includes("moghlai") || item.name.toLowerCase().includes("mughlai");
    }
    if (categoryId === "egg") {
      const lowerId = item.id.toLowerCase();
      const lowerName = item.name.toLowerCase();
      const isEggWord = lowerId.includes("egg") || lowerName.includes("egg");
      const isCooked = lowerId.includes("roll") || lowerId.includes("pasta") || lowerId.includes("chowmein") || lowerId.includes("chowmean") || lowerId.includes("moghlai") || lowerId.includes("mughlai") ||
                       lowerName.includes("roll") || lowerName.includes("pasta") || lowerName.includes("chowmein") || lowerName.includes("chowmean") || lowerName.includes("moghlai") || lowerName.includes("mughlai");
      return isEggWord && !isCooked;
    }
    if (categoryId === "cold_drink") {
      // Exclude raw egg items from cold drinks even if assigned to reception station
      if (this.isItemInCat(item, "egg")) return false;
      return item.id.toLowerCase().includes("pepsi") || item.id.toLowerCase().includes("7up") || item.id.toLowerCase().includes("mirinda") || item.id.toLowerCase().includes("dew") || item.id.toLowerCase().includes("water") || item.id.toLowerCase().includes("beverage") || item.station === "reception";
    }
    if (categoryId === "others") {
      return !this.isItemInCat(item, "rolls") && 
             !this.isItemInCat(item, "pasta") && 
             !this.isItemInCat(item, "chowmein") && 
             !this.isItemInCat(item, "moghlai") && 
             !this.isItemInCat(item, "egg") && 
             !this.isItemInCat(item, "cold_drink");
    }
    return false;
  }

  getItemCategory(itemId) {
    const item = window.AutoBrixStore.state.config.menuItems[itemId];
    if (!item) return "all";
    if (this.isItemInCat(item, "rolls")) return "rolls";
    if (this.isItemInCat(item, "pasta")) return "pasta";
    if (this.isItemInCat(item, "chowmein")) return "chowmein";
    if (this.isItemInCat(item, "moghlai")) return "moghlai";
    if (this.isItemInCat(item, "egg")) return "egg";
    if (this.isItemInCat(item, "cold_drink")) return "cold_drink";
    return "others";
  }

  loadOrderForModification(orderId) {
    const cleanId = (orderId || "").toString().trim();
    const order = window.AutoBrixStore.state.orders.find(o =>
      o.id === cleanId ||
      o.id === "#" + cleanId ||
      "#" + o.id === cleanId ||
      (o.id && cleanId && o.id.replace(/^#/, "") === cleanId.replace(/^#/, ""))
    );
    if (order) {
      this.cart = window.AutoBrixStore.sortOrderItems(order.items.map(it => {
        const itemConfig = window.AutoBrixStore.state.config.menuItems[it.id] || {};
        return {
          id: it.id,
          name: it.name,
          variant: it.variant,
          modifiers: it.modifiers || [],
          modifierNames: (it.modifiers || []).map(mId => {
            const mod = window.AutoBrixStore.state.config.modifiers[mId];
            return mod ? mod.name : "";
          }).filter(Boolean),
          price: it.price || it.unitPrice,
          quantity: it.quantity,
          prepTime: it.prepTime || itemConfig.prepTime || 5,
          station: it.station || itemConfig.station || 'prep',
          type: it.type || 'DINE_IN',
          is_new: false,
          status: it.status || 'PENDING'
        };
      }));
      this.customerName = order.customerName || "";
      this.orderSource = order.source || "DINE_IN";
      this.orderPriority = order.priority || "NORMAL";
      this.modifyingOrderId = order.id;
      this.saveCart();

      const nameInput = document.getElementById("cart-cust-name");
      if (nameInput) nameInput.value = this.customerName;
      const sourceSelect = document.getElementById("cart-order-source");
      if (sourceSelect) sourceSelect.value = this.orderSource;
      const prioritySelect = document.getElementById("cart-order-priority");
      if (prioritySelect) prioritySelect.value = this.orderPriority;

      // Automatically open cart drawer if it is hidden (useful for Control Hub cart hiding)
      const cartEl = document.querySelector(".pos-cart");
      if (cartEl) {
        cartEl.style.display = "flex";
      }

      this.renderCart();
    }
  }

  renderMenuGrid() {
    const grid = document.getElementById("pos-menu-items");
    const menuItems = window.AutoBrixStore.state.config.menuItems;
    
    let filtered = Object.values(menuItems).filter(item => item.active);
    
    if (this.activeCategory !== "all") {
      filtered = filtered.filter(item => this.isItemInCat(item, this.activeCategory));
    }
    
    if (this.searchQuery) {
      filtered = filtered.filter(item => item.name.toLowerCase().includes(this.searchQuery));
    }

    const cardHTMLs = [];
    filtered.forEach(item => {
      const isEggOrDrink = item.id === "egg" || item.station === "reception" || item.id.includes("pepsi") || item.id.includes("7up") || item.id.includes("mirinda") || item.id.includes("water") || item.id.includes("beverage");
      
      const defaultImages = {
        egg: "https://images.unsplash.com/photo-1516448424440-9dbca97779c1?w=400",
        chowmein: "https://images.unsplash.com/photo-1585032226651-759b368d7246?w=400",
        pasta: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400",
        roll: "https://images.unsplash.com/photo-1626700051175-6518c4793f4f?w=400",
        pepsi: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=400",
        mirinda: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=400",
        '7up': "https://images.unsplash.com/photo-1543257580-7269da773bf5?w=400",
        water: "https://images.unsplash.com/photo-1548839130-3bf6047b9609?w=400"
      };
      
      const matchedKey = Object.keys(defaultImages).find(k => item.id.toLowerCase().includes(k) || item.name.toLowerCase().includes(k));
      const imageSrc = item.image || defaultImages[matchedKey] || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400";

      if (isEggOrDrink) {
        // Render a card for each variant sorted by price
        Object.keys(item.variants)
          .sort((a, b) => parseFloat(item.variants[a].price) - parseFloat(item.variants[b].price))
          .forEach(varKey => {
          const v = item.variants[varKey];
          const available = window.AutoBrixStore.getMenuItemAvailableStock(item.id, varKey);
          let stockClass = "good";
          if (available <= 0) stockClass = "empty";
          else if (available < 10) stockClass = "low";
          
          cardHTMLs.push(`
            <div class="menu-card" data-item-id="${item.id}" data-variant-key="${varKey}">
              <div class="menu-card-image-bg" style="background-image: url('${imageSrc}');"></div>
              <div class="menu-card-overlay">
                <div class="menu-card-title-white">${item.name} - ${v.name}</div>
                <div class="menu-card-meta-row">
                  <span class="menu-card-price-white">₹${v.price}</span>
                  <span class="stock-badge ${stockClass} menu-card-stock-white">${available} Avail</span>
                </div>
              </div>
            </div>
          `);
        });
      } else {
        // Standard item
        const defaultVariant = Object.keys(item.variants)[0];
        const available = window.AutoBrixStore.getMenuItemAvailableStock(item.id, defaultVariant);
        let stockClass = "good";
        if (available <= 0) stockClass = "empty";
        else if (available < 10) stockClass = "low";
        
        const priceText = item.variants[defaultVariant].price;
        
        cardHTMLs.push(`
          <div class="menu-card" data-item-id="${item.id}" data-variant-key="${defaultVariant}">
            <div class="menu-card-image-bg" style="background-image: url('${imageSrc}');"></div>
            <div class="menu-card-overlay">
              <div class="menu-card-title-white">${item.name}</div>
              <div class="menu-card-meta-row">
                <span class="menu-card-price-white">₹${priceText}</span>
                <span class="stock-badge ${stockClass} menu-card-stock-white">${available} Avail</span>
              </div>
            </div>
          </div>
        `);
      }
    });

    grid.innerHTML = cardHTMLs.join("");

    // Click / Long-press handler for menu cards
    grid.querySelectorAll(".menu-card").forEach(card => {
      let pressTimer = null;
      let isLongPress = false;
      
      const startPress = () => {
        isLongPress = false;
        pressTimer = setTimeout(() => {
          isLongPress = true;
          // Long press: open customization modal
          const itemId = card.dataset.itemId;
          const variantKey = card.dataset.variantKey;
          const item = menuItems[itemId];
          const isEggOrDrink = itemId === "egg" || item.station === "reception" || itemId.includes("pepsi") || itemId.includes("7up") || itemId.includes("mirinda") || itemId.includes("water") || itemId.includes("beverage");
          
          if (!isEggOrDrink) {
            this.selectedVariant = variantKey; // Set target variant for customizer
            this.openCustomizerModal(itemId);
          }
        }, 500); // 500ms threshold for long press
      };

      const endPress = (e) => {
        if (pressTimer) {
          clearTimeout(pressTimer);
          pressTimer = null;
        }
        
        if (!isLongPress && e.type === "click") {
          // Short click: directly add to cart
          const itemId = card.dataset.itemId;
          const variantKey = card.dataset.variantKey;
          this.addToCart(itemId, variantKey, []);
        }
      };

      card.addEventListener("mousedown", startPress);
      card.addEventListener("touchstart", startPress, { passive: true });
      card.addEventListener("mouseup", endPress);
      card.addEventListener("touchend", endPress);
      card.addEventListener("mouseleave", () => {
        if (pressTimer) {
          clearTimeout(pressTimer);
          pressTimer = null;
        }
      });
      card.addEventListener("click", endPress);
    });
  }

  openCustomizerModal(itemId) {
    const item = window.AutoBrixStore.state.config.menuItems[itemId];
    this.selectedMenuItem = item;
    this.selectedVariant = Object.keys(item.variants)[0];
    this.selectedModifiers = [];

    const modal = document.getElementById("pos-customize-modal");
    modal.style.display = "flex";
    
    this.renderCustomizer();
  }

  renderCustomizer() {
    const modal = document.getElementById("pos-customize-modal");
    const item = this.selectedMenuItem;
    const modifiersConfig = window.AutoBrixStore.state.config.modifiers;
    
    // Generate variants content
    const variantsKeys = Object.keys(item.variants);
    const showVariants = variantsKeys.length > 1;
    
    let variantsHTML = "";
    if (showVariants) {
      variantsHTML = `
        <div style="margin-bottom: 1rem;">
          <h4 class="modal-section-title" style="font-size:0.75rem; text-transform:uppercase; color:var(--text-muted); margin-bottom:0.5rem; letter-spacing:0.05em;">Select Variant</h4>
          <div class="modal-variants-grid" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 8px;">
            ${variantsKeys.map(key => {
              const v = item.variants[key];
              const isSelected = this.selectedVariant === key;
              const avail = window.AutoBrixStore.getMenuItemAvailableStock(item.id, key, this.selectedModifiers);
              return `
                <div class="variant-select-row ${isSelected ? "selected" : ""}" data-variant-key="${key}" style="border:1px solid ${isSelected ? "var(--accent-color)" : "rgba(255,255,255,0.06)"}; padding:8px; border-radius:6px; cursor:pointer; background:${isSelected ? "rgba(245,158,11,0.08)" : "rgba(0,0,0,0.15)"}; display:flex; flex-direction:column; align-items:center; gap:2px; text-align:center;">
                  <strong style="font-size:0.8rem; color:${isSelected ? "var(--accent-color)" : "inherit"};">${v.name}</strong>
                  <span style="font-size:0.75rem; font-weight:700;">₹${v.price}</span>
                  <span style="font-size:0.6rem; opacity:0.6;">Avail: ${avail}</span>
                </div>
              `;
            }).join("")}
          </div>
        </div>
      `;
    }

    // Split modifiers into Kitchen Specifications vs Premium Add-ons
    const kitchenKeys = ['no_onion', 'only_onion', 'no_salad', 'no_sauce', 'no_spice', 'extra_spice', 'extra_sauce'];
    const kitchenModifiers = kitchenKeys.map(k => modifiersConfig[k]).filter(Boolean);
    const premiumModifiers = Object.values(modifiersConfig).filter(m => !kitchenKeys.includes(m.id));
    const getModifierImgHTML = (modId, size = 24, extraStyle = "") => {
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
      return `<img src="http://localhost:3001/uploads/${encodeURIComponent(filename)}" width="${size}" height="${size}" style="object-fit:contain; flex-shrink:0; border-radius:3px; ${extraStyle}" onerror="this.style.display='none'">`;
    };

    let kitchenHTML = `
      <div style="margin-bottom:0.5rem;">
        <h4 class="modal-section-title" style="font-size:0.75rem; text-transform:uppercase; color:var(--text-muted); margin-bottom:0.35rem; letter-spacing:0.05em;">Kitchen Preference (Free)</h4>
        <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:6px;">
          ${kitchenModifiers.map(mod => {
            const isSelected = this.selectedModifiers.includes(mod.id);
            const icon = getModifierImgHTML(mod.id, 24, "margin-bottom:2px;");
            return `
              <div class="modifier-pill-btn ${isSelected ? "selected" : ""}" data-mod-id="${mod.id}" style="border:1px solid ${isSelected ? "var(--accent-color)" : "rgba(255,255,255,0.06)"}; padding:6px 2px; border-radius:6px; cursor:pointer; background:${isSelected ? "rgba(245,158,11,0.1)" : "rgba(255,255,255,0.02)"}; display:inline-flex; flex-direction:column; align-items:center; justify-content:center; font-size:0.75rem; font-weight:700; text-align:center; height:56px; transition:all 0.15s ease;">
                ${icon}<span>${mod.name}</span>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `;

    let premiumHTML = "";
    if (premiumModifiers.length > 0) {
      premiumHTML = `
        <div style="margin-bottom:0.5rem;">
          <h4 class="modal-section-title" style="font-size:0.75rem; text-transform:uppercase; color:var(--text-muted); margin-bottom:0.35rem; letter-spacing:0.05em;">Premium Add-ons</h4>
          <div style="display:flex; flex-direction:column; gap:4px;">
            ${premiumModifiers.map(mod => {
              const isSelected = this.selectedModifiers.includes(mod.id);
              const testMods = [...this.selectedModifiers];
              if (!isSelected) testMods.push(mod.id);
              const availWithMod = window.AutoBrixStore.getMenuItemAvailableStock(item.id, this.selectedVariant, testMods);
              const isSelectable = true;
              const icon = getModifierImgHTML(mod.id, 24, "margin-right:6px;");
              
              return `
                <div class="modifier-select-row ${isSelected ? "selected" : ""}" data-mod-id="${mod.id}" style="display:flex; justify-content:space-between; align-items:center; border:1px solid ${isSelected ? "var(--accent-color)" : "rgba(255,255,255,0.05)"}; padding:6px 10px; border-radius:6px; cursor:pointer; background:${isSelected ? "rgba(245,158,11,0.05)" : "rgba(0,0,0,0.1)"}; font-size:0.8rem;">
                  <div style="display:flex; align-items:center; gap:0.5rem;">
                    <input type="checkbox" class="modifier-checkbox" ${isSelected ? "checked" : ""} style="pointer-events:none; width:14px; height:14px;">
                    ${icon}
                    <span style="font-weight:600;">${mod.name}</span>
                  </div>
                  <strong style="font-size:0.8rem;">+ ₹${mod.price}</strong>
                </div>
              `;
            }).join("")}
          </div>
        </div>
      `;
    }

    modal.innerHTML = `
      <div class="modal-container" style="max-width: 360px; border-radius: 8px; background: var(--bg-card); border: 1px solid rgba(255,255,255,0.08); padding: 0.75rem 1rem; display: flex; flex-direction: column;">
        <div class="modal-header" style="border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:0.25rem; margin-bottom:0.5rem; display:flex; justify-content:space-between; align-items:center;">
          <span class="modal-title" style="font-weight:600; font-size:0.9rem; color:var(--text-primary);">Customize ${item.name}</span>
          <button class="modal-close-btn" id="modal-close" style="background:none; border:none; font-size:1.1rem; color:var(--text-muted); cursor:pointer;">&times;</button>
        </div>
        <div class="modal-body" style="flex:1; padding-right:2px;">
          ${variantsHTML}
          ${kitchenHTML}
          ${premiumHTML}
        </div>
        <div class="modal-footer" style="border-top:1px solid rgba(255,255,255,0.08); padding-top:0.5rem; margin-top:0.5rem; display:flex; flex-direction:column; gap:6px;">
          <div style="display:flex; gap:6px;">
            <button class="pos-action-btn secondary" id="modal-repeat-last" style="flex:1.2; font-size:0.7rem; height:30px; display:flex; align-items:center; justify-content:center; gap:3px; font-weight:600; grid-column:auto;">🔁 Repeat Last</button>
            <button class="pos-action-btn danger" id="modal-no-cust" style="flex:1; font-size:0.7rem; height:30px; display:flex; align-items:center; justify-content:center; gap:3px; font-weight:600; grid-column:auto;">🚫 Plain / None</button>
          </div>
          <button class="pos-action-btn primary" id="modal-add-to-cart" style="width:100%; height:32px; font-weight:700; font-size:0.8rem; grid-column:auto;">Confirm & Add</button>
        </div>
      </div>
    `;

    // Event listeners inside modal
    document.getElementById("modal-close").addEventListener("click", () => this.closeCustomizerModal());
    
    // Repeat Last Customization
    document.getElementById("modal-repeat-last").addEventListener("click", () => {
      this.selectedModifiers = [...this.lastModifiers];
      this.renderCustomizer();
    });

    // Plain / No Customization
    document.getElementById("modal-no-cust").addEventListener("click", () => {
      this.addToCart(item.id, this.selectedVariant, []);
      this.closeCustomizerModal();
    });

    // Confirm & Add to Cart
    document.getElementById("modal-add-to-cart").addEventListener("click", () => {
      this.lastModifiers = [...this.selectedModifiers];
      this.addToCart(item.id, this.selectedVariant, this.selectedModifiers);
      this.closeCustomizerModal();
    });

    // Variant selection
    modal.querySelectorAll(".variant-select-row").forEach(row => {
      row.addEventListener("click", () => {
        this.selectedVariant = row.dataset.variantKey;
        this.renderCustomizer();
      });
    });

    // Kitchen preference pills (toggling)
    modal.querySelectorAll(".modifier-pill-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const modId = btn.dataset.modId;
        const index = this.selectedModifiers.indexOf(modId);
        
        if (index > -1) {
          this.selectedModifiers.splice(index, 1);
        } else {
          // Exclude contradictory onion configurations
          if (modId === 'no_onion') {
            const onlyIdx = this.selectedModifiers.indexOf('only_onion');
            if (onlyIdx > -1) this.selectedModifiers.splice(onlyIdx, 1);
          } else if (modId === 'only_onion') {
            const noIdx = this.selectedModifiers.indexOf('no_onion');
            if (noIdx > -1) this.selectedModifiers.splice(noIdx, 1);
          }
          this.selectedModifiers.push(modId);
        }
        this.renderCustomizer();
      });
    });

    // Premium modifiers toggle
    modal.querySelectorAll(".modifier-select-row").forEach(row => {
      row.addEventListener("click", () => {
        if (row.classList.contains("out-of-stock")) return;
        const modId = row.dataset.modId;
        const index = this.selectedModifiers.indexOf(modId);
        
        if (index > -1) {
          this.selectedModifiers.splice(index, 1);
        } else {
          this.selectedModifiers.push(modId);
        }
        this.renderCustomizer();
      });
    });
  }

  closeCustomizerModal() {
    document.getElementById("pos-customize-modal").style.display = "none";
    this.selectedMenuItem = null;
  }

  addToCart(itemId, variantId, modifierIds) {
    const item = window.AutoBrixStore.state.config.menuItems[itemId];
    const modifierConfig = window.AutoBrixStore.state.config.modifiers;
    const variant = item.variants[variantId];
    
    // Calculate final price of customized item
    let basePrice = variant.price;
    let nameString = item.name;
    if (Object.keys(item.variants).length > 1) {
      nameString += ` (${variant.name})`;
    }

    let modifierNames = [];
    let modPrice = 0;
    modifierIds.forEach(mId => {
      const mod = modifierConfig[mId];
      if (mod) {
        modifierNames.push(mod.name);
        modPrice += mod.price;
      }
    });

    const finalPrice = basePrice + modPrice;

    // Check if identical item already in cart
    const existingIndex = this.cart.findIndex(c => 
      c.id === itemId && 
      c.variant === variantId && 
      (!this.modifyingOrderId || c.is_new) &&
      c.status !== 'READY' &&
      JSON.stringify(c.modifiers.sort()) === JSON.stringify(modifierIds.sort())
    );

    if (existingIndex > -1) {
      this.cart[existingIndex].quantity += 1;
    } else {
      const sourceSelect = document.getElementById("cart-order-source");
      const defaultType = (sourceSelect && sourceSelect.value === "PARCEL") ? "PARCEL" : "DINE_IN";
      this.cart.push({
        id: itemId,
        name: nameString,
        variant: variantId,
        modifiers: modifierIds,
        modifierNames: modifierNames,
        price: finalPrice,
        quantity: 1,
        prepTime: item.prepTime,
        station: item.station,
        type: defaultType,
        is_new: !!this.modifyingOrderId,
        status: 'PENDING'
      });
    }

    this.autoUpdateOrderSource();
    this.cart = window.AutoBrixStore.sortOrderItems(this.cart);
    this.renderCart();
  }

  renderCart() {
    const list = document.getElementById("pos-cart-items-list");
    const container = document.getElementById(this.containerId);
    const cartEl = container ? container.querySelector(".pos-cart") : null;
    const gridEl = container ? container.querySelector(".receptionist-grid") : null;
    const titleEl = this.container.querySelector(".pos-cart-title");
    const confirmBtn = this.container.querySelector("#cart-confirm-btn");
    const clearBtn = this.container.querySelector("#cart-clear-btn");

    if (titleEl) {
      titleEl.innerText = this.modifyingOrderId ? `Edit Order ${this.modifyingOrderId}` : "Current Order";
    }
    if (confirmBtn) {
      confirmBtn.innerText = this.modifyingOrderId ? "Update Order (Space)" : "Confirm Order (Space)";
    }
    if (clearBtn) {
      clearBtn.innerText = this.modifyingOrderId ? "Close Edit (Esc)" : "Cancel Order (Esc)";
    }

    if (this.cart.length === 0) {
      if (this.containerId === "hub-pos") {
        if (cartEl) cartEl.style.display = "none";
        if (gridEl) gridEl.style.gridTemplateColumns = "72px 1fr";
      } else {
        if (cartEl) cartEl.style.display = "flex";
        if (gridEl) gridEl.style.gridTemplateColumns = "72px 1fr 360px";
      }

      list.innerHTML = `
        <div style="flex-grow:1; display:flex; flex-direction:column; align-items:center; justify-content:center; color:var(--text-muted); gap:0.5rem; min-height:150px;">
          <svg width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
          <span style="font-size:0.85rem;">Cart is empty. Select items to order.</span>
        </div>
      `;
      document.getElementById("pos-subtotal").innerText = "₹0.00";
      document.getElementById("pos-tax").innerText = "₹0.00";
      document.getElementById("pos-total").innerText = "₹0.00";
      document.getElementById("pos-commission").innerText = "₹0.00";
      document.getElementById("aggregator-row").style.display = "none";
      document.getElementById("pos-cart-eta-value").innerText = "0 Min";
      this.saveCart();
      return;
    }

    if (this.containerId === "hub-pos") {
      if (cartEl) cartEl.style.display = "flex";
      if (gridEl) gridEl.style.gridTemplateColumns = "72px 1fr 360px";
    }

    this.cart = window.AutoBrixStore.sortOrderItems(this.cart);
    list.innerHTML = this.cart.map((item, index) => {
      const subtotal = item.price * item.quantity;
      const modsHTML = item.modifierNames.length > 0 
        ? `<div class="cart-item-modifiers-list">${item.modifierNames.map(m => `<span>+ ${m}</span>`).join("")}</div>`
        : "";

      const isDineIn = item.type !== "PARCEL";

      const highlightBorder = item.is_new ? "border-left: 3px solid #d97706; padding-left: 8px; margin-left: -8px; background: rgba(245, 158, 11, 0.03);" : "";

      return `
        <div class="cart-item" style="${highlightBorder}">
          <div class="cart-item-header">
            <div class="cart-item-info">
              <span class="cart-item-name">${item.name} ${item.is_new ? `<span style="background:#d97706; color:white; font-size:0.6rem; font-weight:800; padding:1px 4px; border-radius:4px; margin-left:6px; text-transform:uppercase; vertical-align:middle;">New</span>` : ""}</span>
              ${modsHTML}
            </div>
            <span class="cart-item-price">₹${subtotal}</span>
          </div>
          <div class="cart-item-controls" style="display:flex; justify-content:space-between; align-items:center; gap:8px; width:100%;">
            <button style="padding:4px 10px; font-size:0.7rem; font-weight:700; border:1px solid rgba(255,255,255,0.12); border-radius:6px; cursor:pointer; font-family:var(--font-sans); transition:all 0.15s ease; background:${isDineIn ? "rgba(88,80,236,0.15)" : "rgba(255,255,255,0.04)"}; color:${isDineIn ? "var(--accent-color)" : "var(--text-muted)"}; flex-shrink:0;" onclick="posPanel.toggleItemType(${index}, '${isDineIn ? 'PARCEL' : 'DINE_IN'}')">
              ${isDineIn ? 'Dine-In' : 'Parcel'}
            </button>
            <div style="display:flex; align-items:center; gap:8px;">
              <div class="cart-qty-buttons">
                <button class="qty-btn" onclick="posPanel.changeQty(${index}, -1)">-</button>
                <span class="cart-qty-val">${item.quantity}</span>
                <button class="qty-btn" onclick="posPanel.changeQty(${index}, 1)">+</button>
              </div>
              <button class="cart-item-delete" onclick="posPanel.deleteItem(${index})">
                <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join("");

    this.calculateTotals();
    this.updateCartETA();

    const holdBtn = document.getElementById("cart-hold-btn");
    if (holdBtn) {
      if (this.modifyingOrderId) {
        holdBtn.innerText = "Settle Payment";
        holdBtn.style.background = "#d97706";
        holdBtn.style.color = "#ffffff";
        holdBtn.style.borderColor = "#b45309";
      } else {
        holdBtn.innerText = "Hold Order";
        holdBtn.style.background = "";
        holdBtn.style.color = "";
        holdBtn.style.borderColor = "";
      }
    }

    this.saveCart();
  }

  changeQty(index, delta) {
    const item = this.cart[index];
    const newQty = item.quantity + delta;
    
    if (newQty <= 0) {
      this.deleteItem(index);
      return;
    }

    item.quantity = newQty;
    this.renderCart();
  }

  deleteItem(index) {
    this.cart.splice(index, 1);
    this.autoUpdateOrderSource();
    this.renderCart();
  }

  toggleItemType(index, type) {
    if (this.cart[index]) {
      this.cart[index].type = type;
      this.autoUpdateOrderSource();
      this.renderCart();
    }
  }

  autoUpdateOrderSource() {
    if (["SWIGGY", "ZOMATO", "TAKEAWAY"].includes(this.orderSource)) return;
    const hasDineIn = this.cart.some(it => it.type === "DINE_IN");
    const hasParcel = this.cart.some(it => it.type === "PARCEL");
    const select = document.getElementById("cart-order-source");
    if (!select) return;
    if (hasDineIn && hasParcel) {
      select.value = "BOTH";
    } else if (hasDineIn) {
      select.value = "DINE_IN";
    } else if (hasParcel) {
      select.value = "PARCEL";
    }
    this.orderSource = select.value;
  }

  calculateTotals() {
    let subtotal = 0;
    this.cart.forEach(item => {
      subtotal += item.price * item.quantity;
    });

    const taxRate = 0;
    const tax = 0;

    // Calculate delivery aggregator commission if applicable
    const sourceInfo = window.AutoBrixStore.state.config.sources[this.orderSource];
    const commPct = sourceInfo ? sourceInfo.commissionPct : 0;
    const commission = subtotal * (commPct / 100);

    // Grand total = subtotal + tax
    // Note: aggregators take commission out of subtotal but customer pays total.
    const total = subtotal + tax;

    document.getElementById("pos-subtotal").innerText = `₹${subtotal.toFixed(2)}`;
    document.getElementById("pos-tax").innerText = `₹${tax.toFixed(2)}`;
    
    if (commPct > 0) {
      document.getElementById("aggregator-row").style.display = "flex";
      document.getElementById("aggregator-label").innerText = `${sourceInfo.name} Comm (${commPct}%):`;
      document.getElementById("pos-commission").innerText = `₹${commission.toFixed(2)}`;
    } else {
      document.getElementById("aggregator-row").style.display = "none";
    }
    
    document.getElementById("pos-total").innerText = `₹${total.toFixed(2)}`;
  }

  updateCartETA() {
    // Standard mapping of items to station schema
    const etaVal = window.AutoBrixStore.calculateCartWaitTime(this.cart, { excludeOrderId: this.modifyingOrderId, editingOrderId: this.modifyingOrderId });
    document.getElementById("pos-cart-eta-value").innerText = `${etaVal} Mins`;

    const deliveryTimeEl = document.getElementById("pos-cart-delivery-time");
    if (deliveryTimeEl) {
      if (this.cart.length === 0) {
        deliveryTimeEl.innerText = "--:--";
      } else {
        const now = new Date();
        const deliveryTime = new Date(now.getTime() + etaVal * 60 * 1000);
        
        let hours = deliveryTime.getHours();
        const minutes = deliveryTime.getMinutes().toString().padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12;
        const formatted = `${hours.toString().padStart(2, '0')}:${minutes} ${ampm}`;
        
        deliveryTimeEl.innerText = formatted;
      }
    }
  }

  clearCart() {
    if (this.modifyingOrderId) {
      this.modifyingOrderId = null;
    }

    this.cart = [];
    this.customerName = "";
    document.getElementById("cart-cust-name").value = "";
    this.orderSource = "DINE_IN";
    document.getElementById("cart-order-source").value = "DINE_IN";
    this.orderPriority = "NORMAL";
    document.getElementById("cart-order-priority").value = "NORMAL";
    this.modifyingOrderId = null;
    
    this.renderCart();
  }

  holdOrder() {
    if (this.modifyingOrderId) {
      this.confirmOrder(true);
      return;
    }
    if (this.cart.length === 0) return;
    
    this.heldCarts.push({
      cart: this.cart,
      customerName: this.customerName,
      orderSource: this.orderSource,
      orderPriority: this.orderPriority
    });

    // Reset current POS cart
    this.cart = [];
    this.customerName = "";
    document.getElementById("cart-cust-name").value = "";
    
    this.renderCart();
    
    const countBadge = document.getElementById("pos-held-count");
    countBadge.innerText = `Held: ${this.heldCarts.length}`;
    countBadge.style.display = "inline-flex";
  }

  recallHeldOrder() {
    if (this.heldCarts.length === 0) return;
    
    const held = this.heldCarts.shift();
    this.cart = held.cart;
    this.customerName = held.customerName;
    document.getElementById("cart-cust-name").value = held.customerName;
    this.orderSource = held.orderSource;
    document.getElementById("cart-order-source").value = held.orderSource;
    this.orderPriority = held.orderPriority;
    document.getElementById("cart-order-priority").value = held.orderPriority;

    this.renderCart();

    const countBadge = document.getElementById("pos-held-count");
    if (this.heldCarts.length > 0) {
      countBadge.innerText = `Held: ${this.heldCarts.length}`;
    } else {
      countBadge.style.display = "none";
    }
  }

  confirmOrder(forceSettle = false) {
    if (this.cart.length === 0) {
      alert("Cart is empty!");
      return;
    }

    const editingOrderId = this.modifyingOrderId;

    // Totals calculations
    let subtotal = 0;
    this.cart.forEach(item => {
      subtotal += item.price * item.quantity;
    });

    const taxRate = 0;
    const tax = 0;
    const total = subtotal;

    const sourceInfo = window.AutoBrixStore.state.config.sources[this.orderSource];
    const commPct = sourceInfo ? sourceInfo.commissionPct : 0;
    const commission = subtotal * (commPct / 100);
    const netRevenue = total - commission;

    const etaVal = window.AutoBrixStore.calculateCartWaitTime(this.cart, { excludeOrderId: editingOrderId, editingOrderId: editingOrderId });
    
    // Generate order ID like #7-7-26-0001
    const now = new Date();
    const day = now.getDate();
    const month = now.getMonth() + 1;
    const shortYear = now.getFullYear().toString().slice(-2);
    const datePrefix = `${day}-${month}-${shortYear}-`;
    const todayOrders = window.AutoBrixStore.state.orders.filter(o => o.id.startsWith("#" + datePrefix) || o.id.startsWith(datePrefix));
    const nextSerial = todayOrders.length + 1;
    const serialStr = nextSerial.toString().padStart(4, '0');
    const orderId = editingOrderId || `#${datePrefix}${serialStr}`;

    const orderData = {
      id: orderId,
      customerName: this.customerName || "Walk-In Customer",
      source: this.orderSource,
      priority: this.orderPriority,
      items: window.AutoBrixStore.sortOrderItems(this.cart).map(item => ({
        id: item.id,
        name: item.name,
        variant: item.variant,
        modifiers: item.modifiers,
        quantity: item.quantity,
        price: item.price,
        prepTime: item.prepTime,
        station: item.station,
        type: item.type || 'DINE_IN',
        is_new: item.is_new || false,
        status: item.status || 'PENDING'
      })),
      subtotal: subtotal,
      tax: tax,
      total: total,
      commission: commission,
      netRevenue: netRevenue,
      eta: etaVal,
      paymentStatus: (this.orderSource === "SWIGGY" || this.orderSource === "ZOMATO") ? "PAID" : "UNPAID"
    };

    const hasDineIn = this.cart.some(it => it.type === "DINE_IN");

    const finalizeCheckout = (paymentStatus) => {
      orderData.paymentStatus = paymentStatus;
      
      const success = window.AutoBrixStore.reserveInventoryAtomically(orderData);
      if (success) {
        if (window.AlokaAPI.isOnline()) {
           const itemsPayload = window.AutoBrixStore.sortOrderItems(orderData.items).map(it => ({
            id: it.id,
            name: it.name,
            variant: it.variant,
            variantName: it.variant === 'single' ? 'Single' : (it.variant === 'half' ? 'Half' : 'Full'),
            quantity: it.quantity,
            unitPrice: it.price,
            modifiers: it.modifiers,
            type: it.type || 'DINE_IN',
            is_new: it.is_new || false,
            status: it.status || 'PENDING'
          }));
          const method = editingOrderId ? 'put' : 'post';
          const path = editingOrderId ? `/orders/${encodeURIComponent(editingOrderId)}` : '/orders';
          window.AlokaAPI[method](path, {
            id: orderData.id,
            customer_name: orderData.customerName,
            source: orderData.source,
            priority: orderData.priority,
            subtotal: orderData.subtotal,
            tax: orderData.tax,
            total: orderData.total,
            commission: orderData.commission,
            net_revenue: orderData.netRevenue,
            eta: orderData.eta,
            payment_status: orderData.paymentStatus,
            items: itemsPayload
          }).then(() => {
            window.AlokaAPI.loadAllState();
          }).catch(err => {
            console.error("Online order save failed:", err);
            alert("Order recorded locally, but failed to sync online: " + err.message);
          });
        }
        
        // Reset modifyingOrderId BEFORE calling clearCart to avoid cancel prompt!
        this.modifyingOrderId = null;
        this.clearCart();
        
        // Show success notification/toast
        const successToast = document.createElement("div");
        successToast.style = "position:fixed; bottom:24px; right:24px; background:#10b981; color:white; font-weight:700; font-size:0.9rem; padding:12px 24px; border-radius:8px; box-shadow:0 4px 12px rgba(0,0,0,0.3); z-index:9999;";
        successToast.innerText = `Order ${orderId} Placed Successfully (${paymentStatus === 'PAID' ? 'Paid' : 'Unpaid'})!`;
        document.body.appendChild(successToast);
        setTimeout(() => successToast.remove(), 3000);
      } else {
        alert("Checkout failed: Insufficient ingredient stock!");
      }
    };

    if (hasDineIn && !forceSettle) {
      // Dine-In orders bypass modal payment selection and are directly checked out unpaid
      finalizeCheckout("UNPAID");
    } else {
      // Show Payment Mode Selection Modal for full parcel orders OR settled Dine-In orders
      const paymentModal = document.createElement("div");
      paymentModal.className = "custom-modal-backdrop";
      paymentModal.style = "position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.7); display:flex; justify-content:center; align-items:center; z-index:2000; font-family:var(--font-sans);";
      paymentModal.innerHTML = `
        <div style="background:var(--bg-card); border:1px solid rgba(255,255,255,0.08); border-radius:12px; width:360px; padding:1.5rem; text-align:center; box-shadow:0 10px 25px rgba(0,0,0,0.5);">
          <h3 style="font-size:1.15rem; font-weight:700; margin-bottom:0.5rem; color:var(--text-primary);">Select Payment Mode</h3>
          <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:1.5rem;">Choose the payment method for Order ${orderId}</p>
          
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:1.5rem;">
            <button id="pay-online" style="display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; height:80px; border:1px solid rgba(255,255,255,0.08); background:rgba(255,255,255,0.02); border-radius:8px; cursor:pointer; color:var(--text-primary); font-weight:600; font-size:0.9rem; transition:all 0.15s ease;">
              <svg width="24" height="24" fill="none" stroke="var(--accent-color)" stroke-width="2" viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20m-5 4h.01M13 14h.01"/></svg>
              <span>Online</span>
            </button>
            
            <button id="pay-offline" style="display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; height:80px; border:1px solid rgba(255,255,255,0.08); background:rgba(255,255,255,0.02); border-radius:8px; cursor:pointer; color:var(--text-primary); font-weight:600; font-size:0.9rem; transition:all 0.15s ease;">
              <svg width="24" height="24" fill="none" stroke="#10b981" stroke-width="2" viewBox="0 0 24 24"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>
              <span>Offline (Cash)</span>
            </button>
          </div>
          
          <button id="pay-cancel" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:0.85rem; font-weight:500;">Cancel</button>
        </div>
      `;

      document.body.appendChild(paymentModal);

      const buttons = paymentModal.querySelectorAll("button:not(#pay-cancel)");
      buttons.forEach(btn => {
        btn.onmouseenter = () => btn.style.background = "rgba(255,255,255,0.06)";
        btn.onmouseleave = () => btn.style.background = "rgba(255,255,255,0.02)";
      });

      paymentModal.querySelector("#pay-online").onclick = () => {
        finalizeCheckout("PAID");
        paymentModal.remove();
      };
      paymentModal.querySelector("#pay-offline").onclick = () => {
        finalizeCheckout("PAID"); // Forced paid when settling
        paymentModal.remove();
      };
      paymentModal.querySelector("#pay-cancel").onclick = () => paymentModal.remove();
    }
  }

  printBillReceipt(order) {
    const printArea = document.getElementById("invoice-print-area");
    
    let itemsHTML = order.items.map(it => {
      let modsStr = "";
      if (it.modifiers && it.modifiers.length > 0) {
        const modConfigs = window.AutoBrixStore.state.config.modifiers;
        modsStr = `<div style="font-size: 8pt; margin-left: 10px; color:#555;">${it.modifiers.map(mId => `+ ${modConfigs[mId].name}`).join(", ")}</div>`;
      }
      return `
        <tr style="border-bottom: 1px dashed #ccc;">
          <td style="padding: 4px 0; font-size: 9pt;">
            ${it.name} ${modsStr}
          </td>
          <td style="padding: 4px 0; text-align: center; font-family: monospace; font-size: 9pt;">${it.quantity}</td>
          <td style="padding: 4px 0; text-align: right; font-family: monospace; font-size: 9pt;">₹${(it.price * it.quantity).toFixed(2)}</td>
        </tr>
      `;
    }).join("");

    printArea.innerHTML = `
      <div style="font-family: Arial, sans-serif; color: #000; padding: 10px; width: 100%; max-width: 280px; margin: 0 auto; border: 1px solid #000;">
        <div style="text-align: center; margin-bottom: 10px;">
          <h2 style="margin: 0; font-size: 14pt; font-weight: 700;">ALOKA FAST FOOD</h2>
          <div style="font-size: 8pt;">Airport Gate 2 Road, Kolkata</div>
          <div style="font-size: 8pt; font-weight: bold; margin-top: 5px;">AutoBrix Restaurant Platform</div>
        </div>
        
        <hr style="border: none; border-top: 1px dashed #000; margin: 10px 0;"/>
        
        <div style="font-size: 8pt; line-height: 1.4; margin-bottom: 10px;">
          <div><strong>Order:</strong> #${order.id}</div>
          <div><strong>Date:</strong> ${new Date(order.timestamp).toLocaleString()}</div>
          <div><strong>Customer:</strong> ${order.customerName}</div>
          <div><strong>Source:</strong> ${order.source} | Priority: ${order.priority}</div>
          <div><strong>Estimated Time:</strong> ${order.eta} Mins</div>
        </div>
        
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 10px;">
          <thead>
            <tr style="border-bottom: 1px solid #000;">
              <th style="text-align: left; font-size: 8pt; padding-bottom: 4px;">Item</th>
              <th style="text-align: center; font-size: 8pt; padding-bottom: 4px; width: 40px;">Qty</th>
              <th style="text-align: right; font-size: 8pt; padding-bottom: 4px; width: 70px;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHTML}
          </tbody>
        </table>
        
        <div style="font-size: 9pt; line-height: 1.4; text-align: right; margin-top: 10px;">
          <div>Subtotal: ₹${order.subtotal.toFixed(2)}</div>
          <div>Tax (0%): ₹${order.tax.toFixed(2)}</div>
          <div style="font-size: 11pt; font-weight: bold; margin-top: 4px; border-top: 1px double #000; padding-top: 4px;">
            Total: ₹${order.total.toFixed(2)}
          </div>
        </div>
        
        <div style="text-align: center; margin-top: 20px; font-size: 7.5pt;">
          <div>Thank you for dining with us!</div>
          <div style="margin-top: 3px; font-weight: bold; color: #555;">AutoBrix Real-Time KDS Enabled</div>
        </div>
      </div>
    `;

    // Trigger printing
    window.print();
  }
}

// Bind globally
window.POSPanel = POSPanel;
