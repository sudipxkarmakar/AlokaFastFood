// AutoBrix POS Cashier/Receptionist Panel Module

class POSPanel {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.activeCategory = "all";
    this.searchQuery = "";
    
    this.cart = []; // { id, name, variant, modifiers: [], price, quantity, prepTime, station }
    this.heldCarts = []; // queue of held orders
    
    this.customerName = "";
    this.orderSource = "DINE_IN";
    this.orderPriority = "NORMAL";
    
    this.selectedMenuItem = null; // for variant/modifier modal
    this.selectedVariant = "single";
    this.selectedModifiers = [];
  }

  init() {
    this.render();
    this.bindEvents();
    
    // Subscribe to store updates to keep stock numbers live!
    window.AutoBrixStore.subscribe(() => {
      this.renderMenuGrid();
      this.updateCartETA();
    });
  }

  render() {
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

    // Customer name input
    document.getElementById("cart-cust-name").addEventListener("input", (e) => {
      this.customerName = e.target.value;
    });

    // Order source selector (adjust commissions)
    document.getElementById("cart-order-source").addEventListener("change", (e) => {
      this.orderSource = e.target.value;
      
      // Auto adjust priority to match source for easy operational flow
      if (["SWIGGY", "ZOMATO", "TAKEAWAY"].includes(this.orderSource)) {
        this.orderPriority = this.orderSource;
        document.getElementById("cart-order-priority").value = this.orderSource;
      }
      this.renderCart();
    });

    // Priority selector
    document.getElementById("cart-order-priority").addEventListener("change", (e) => {
      this.orderPriority = e.target.value;
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
      { id: "rolls", name: "Rolls" },
      { id: "paratha", name: "Paratha" },
      { id: "chinese", name: "Chinese" },
      { id: "curry", name: "Mains & Curries" },
      { id: "fry", name: "Snacks & Starters" }
    ];

    list.innerHTML = categories.map(cat => {
      let count = 0;
      if (cat.id === "all") {
        count = Object.values(menuItems).filter(item => item.active).length;
      } else {
        count = Object.values(menuItems).filter(item => item.active && this.isItemInCat(item, cat.id)).length;
      }

      return `
        <button class="category-btn ${this.activeCategory === cat.id ? "active" : ""}" data-category="${cat.id}">
          <span>${cat.name}</span>
          <span class="category-count">${count}</span>
        </button>
      `;
    }).join("");
  }

  isItemInCat(item, categoryId) {
    if (categoryId === "rolls") return item.id.includes("roll") && !item.id.includes("paratha");
    if (categoryId === "paratha") return item.id.includes("paratha");
    if (categoryId === "chinese") return item.station === "chinese";
    if (categoryId === "curry") return item.station === "main";
    if (categoryId === "fry") return item.station === "fry";
    return false;
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

    grid.innerHTML = filtered.map(item => {
      // Calculate availability based on default variant ('single' or 'half')
      const defaultVariant = Object.keys(item.variants)[0];
      const available = window.AutoBrixStore.getMenuItemAvailableStock(item.id, defaultVariant);
      const isOutOfStock = available <= 0;
      
      const prepTimeText = item.prepTime > 1 ? `${item.prepTime} mins` : `${item.prepTime} min`;
      const priceText = item.variants[defaultVariant].price;
      
      // Stock warning class
      let stockClass = "good";
      if (available === 0) stockClass = "empty";
      else if (available < 10) stockClass = "low";
      
      const stockText = isOutOfStock ? "Out of Stock" : `Available: ${available}`;

      // High quality SVG path representing food items
      let foodIcon = `
        <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
        </svg>
      `; // default icon is currency/food

      return `
        <div class="menu-card ${isOutOfStock ? "out-of-stock" : ""}" data-item-id="${item.id}">
          <div class="menu-card-image-placeholder">
            ${foodIcon}
          </div>
          <div class="menu-card-title">${item.name}</div>
          <div class="menu-card-details">
            <span class="menu-card-price">₹${priceText}</span>
            <div class="menu-card-meta">
              <span>Prep: ${prepTimeText}</span>
              <span class="stock-badge ${stockClass}">${stockText}</span>
            </div>
          </div>
        </div>
      `;
    }).join("");

    // Click handler for menu cards
    grid.querySelectorAll(".menu-card").forEach(card => {
      card.addEventListener("click", () => {
        const itemId = card.dataset.itemId;
        const item = menuItems[itemId];
        
        const defaultVar = Object.keys(item.variants)[0];
        const stock = window.AutoBrixStore.getMenuItemAvailableStock(itemId, defaultVar);
        if (stock <= 0) {
          alert(`Warning: ${item.name} is currently out of stock due to raw ingredient constraints!`);
          return;
        }

        this.openCustomizerModal(itemId);
      });
    });
  }

  // Opens variant and modifiers configuration
  openCustomizerModal(itemId) {
    const item = window.AutoBrixStore.state.config.menuItems[itemId];
    const modifiers = window.AutoBrixStore.state.config.modifiers;
    
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
        <div>
          <h4 class="modal-section-title">Select Variant</h4>
          <div class="modal-variants-grid">
            ${variantsKeys.map(key => {
              const v = item.variants[key];
              const isSelected = this.selectedVariant === key;
              const avail = window.AutoBrixStore.getMenuItemAvailableStock(item.id, key, this.selectedModifiers);
              return `
                <div class="variant-select-row ${isSelected ? "selected" : ""}" data-variant-key="${key}">
                  <div style="display:flex; align-items:center; gap:0.5rem;">
                    <input type="radio" name="variant-option" class="variant-radio" ${isSelected ? "checked" : ""}>
                    <strong>${v.name}</strong>
                  </div>
                  <div style="text-align:right;">
                    <span style="font-weight:700;">₹${v.price}</span>
                    <div style="font-size:0.7rem; opacity:0.7;">Avail: ${avail}</div>
                  </div>
                </div>
              `;
            }).join("")}
          </div>
        </div>
      `;
    }

    // Generate modifiers content
    let modifiersHTML = `
      <div>
        <h4 class="modal-section-title">Modifiers / Extras</h4>
        <div class="modal-modifiers-list">
          ${Object.values(modifiersConfig).map(mod => {
            const isSelected = this.selectedModifiers.includes(mod.id);
            // Check availability if we add this modifier
            const testMods = [...this.selectedModifiers];
            if (!isSelected) testMods.push(mod.id);
            const availWithMod = window.AutoBrixStore.getMenuItemAvailableStock(item.id, this.selectedVariant, testMods);
            const isSelectable = isSelected || availWithMod > 0;
            
            return `
              <div class="modifier-select-row ${isSelected ? "selected" : ""} ${!isSelectable ? "out-of-stock" : ""}" data-mod-id="${mod.id}">
                <div style="display:flex; align-items:center; gap:0.5rem;">
                  <input type="checkbox" class="modifier-checkbox" ${isSelected ? "checked" : ""} ${!isSelectable ? "disabled" : ""}>
                  <span>${mod.name}</span>
                </div>
                <strong>+ ₹${mod.price}</strong>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `;

    modal.innerHTML = `
      <div class="modal-container">
        <div class="modal-header">
          <span class="modal-title">Customize ${item.name}</span>
          <button class="modal-close-btn" id="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          ${variantsHTML}
          ${modifiersHTML}
        </div>
        <div class="modal-footer">
          <button class="pos-action-btn primary" id="modal-add-to-cart" style="flex:1;">Add to Order</button>
          <button class="pos-action-btn secondary" id="modal-cancel">Cancel</button>
        </div>
      </div>
    `;

    // Event listeners inside modal
    document.getElementById("modal-close").addEventListener("click", () => this.closeCustomizerModal());
    document.getElementById("modal-cancel").addEventListener("click", () => this.closeCustomizerModal());

    // Variant selection
    modal.querySelectorAll(".variant-select-row").forEach(row => {
      row.addEventListener("click", () => {
        this.selectedVariant = row.dataset.variantKey;
        this.renderCustomizer(); // re-evaluate modifiers stock availability
      });
    });

    // Modifier selection
    modal.querySelectorAll(".modifier-select-row").forEach(row => {
      row.addEventListener("click", (e) => {
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

    // Add to cart
    document.getElementById("modal-add-to-cart").addEventListener("click", () => {
      this.addToCart(item.id, this.selectedVariant, this.selectedModifiers);
      this.closeCustomizerModal();
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
      JSON.stringify(c.modifiers.sort()) === JSON.stringify(modifierIds.sort())
    );

    if (existingIndex > -1) {
      // Validate stock availability for incremented count
      const testCart = JSON.parse(JSON.stringify(this.cart));
      testCart[existingIndex].quantity += 1;
      
      const available = window.AutoBrixStore.getMenuItemAvailableStock(itemId, variantId, modifierIds);
      if (this.cart[existingIndex].quantity >= available) {
        alert(`Cannot add more. Restricted by raw ingredient inventory availability!`);
        return;
      }

      this.cart[existingIndex].quantity += 1;
    } else {
      this.cart.push({
        id: itemId,
        name: nameString,
        variant: variantId,
        modifiers: modifierIds,
        modifierNames: modifierNames,
        price: finalPrice,
        quantity: 1,
        prepTime: item.prepTime,
        station: item.station
      });
    }

    this.renderCart();
  }

  renderCart() {
    const list = document.getElementById("pos-cart-items-list");
    if (this.cart.length === 0) {
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
      return;
    }

    list.innerHTML = this.cart.map((item, index) => {
      const subtotal = item.price * item.quantity;
      const modsHTML = item.modifierNames.length > 0 
        ? `<div class="cart-item-modifiers-list">${item.modifierNames.map(m => `<span>+ ${m}</span>`).join("")}</div>`
        : "";

      return `
        <div class="cart-item">
          <div class="cart-item-header">
            <div class="cart-item-info">
              <span class="cart-item-name">${item.name}</span>
              ${modsHTML}
            </div>
            <span class="cart-item-price">₹${subtotal}</span>
          </div>
          <div class="cart-item-controls">
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
      `;
    }).join("");

    this.calculateTotals();
    this.updateCartETA();
  }

  changeQty(index, delta) {
    const item = this.cart[index];
    const newQty = item.quantity + delta;
    
    if (newQty <= 0) {
      this.deleteItem(index);
      return;
    }

    // Check inventory availability limit
    const available = window.AutoBrixStore.getMenuItemAvailableStock(item.id, item.variant, item.modifiers);
    if (newQty > available) {
      alert(`Cannot add more. Restricted by ingredient stock constraints!`);
      return;
    }

    item.quantity = newQty;
    this.renderCart();
  }

  deleteItem(index) {
    this.cart.splice(index, 1);
    this.renderCart();
  }

  calculateTotals() {
    let subtotal = 0;
    this.cart.forEach(item => {
      subtotal += item.price * item.quantity;
    });

    const settings = window.AutoBrixStore.state.config.settings;
    const taxRate = settings.gstRate || 5;
    const tax = subtotal * (taxRate / 100);

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
    const etaVal = window.AutoBrixStore.calculateCartWaitTime(this.cart);
    document.getElementById("pos-cart-eta-value").innerText = `${etaVal} Mins`;
  }

  clearCart() {
    this.cart = [];
    this.customerName = "";
    document.getElementById("cart-cust-name").value = "";
    this.orderSource = "DINE_IN";
    document.getElementById("cart-order-source").value = "DINE_IN";
    this.orderPriority = "NORMAL";
    document.getElementById("cart-order-priority").value = "NORMAL";
    
    this.renderCart();
  }

  holdOrder() {
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

  confirmOrder() {
    if (this.cart.length === 0) {
      alert("Cart is empty!");
      return;
    }

    // Totals calculations
    let subtotal = 0;
    this.cart.forEach(item => {
      subtotal += item.price * item.quantity;
    });

    const settings = window.AutoBrixStore.state.config.settings;
    const taxRate = settings.gstRate || 5;
    const tax = subtotal * (taxRate / 100);
    const total = subtotal + tax;

    const sourceInfo = window.AutoBrixStore.state.config.sources[this.orderSource];
    const commPct = sourceInfo ? sourceInfo.commissionPct : 0;
    const commission = subtotal * (commPct / 100);
    const netRevenue = total - commission;

    const etaVal = window.AutoBrixStore.calculateCartWaitTime(this.cart);
    const orderId = "AB-" + Math.floor(1000 + Math.random() * 9000);

    const orderData = {
      id: orderId,
      customerName: this.customerName || "Walk-In Customer",
      source: this.orderSource,
      priority: this.orderPriority,
      items: this.cart.map(item => ({
        id: item.id,
        name: item.name,
        variant: item.variant,
        modifiers: item.modifiers,
        quantity: item.quantity,
        price: item.price,
        prepTime: item.prepTime,
        station: item.station
      })),
      subtotal: subtotal,
      tax: tax,
      total: total,
      commission: commission,
      netRevenue: netRevenue,
      eta: etaVal,
      paymentStatus: (this.orderSource === "SWIGGY" || this.orderSource === "ZOMATO") ? "PAID" : "UNPAID" // aggregators pre-pay
    };

    // Perform atomic transaction reservation
    const success = window.AutoBrixStore.reserveInventoryAtomically(orderData);
    if (success) {
      this.printBillReceipt(orderData);
      
      // Clean up POS
      this.clearCart();
    } else {
      alert("Checkout failed: Insufficient ingredient stock! Ingredients were reserved by another terminal or stock is depleted.");
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
          <div>GST (5%): ₹${order.tax.toFixed(2)}</div>
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
