document.addEventListener("DOMContentLoaded", () => {
  document.documentElement.classList.add("js-ready");

  const burger = document.getElementById("burger");
  const nav = document.getElementById("nav");

  if (burger && nav) {
    burger.addEventListener("click", () => {
      burger.classList.toggle("is-open");
      nav.classList.toggle("is-open");
      const expanded = burger.getAttribute("aria-expanded") === "true";
      burger.setAttribute("aria-expanded", String(!expanded));
    });

    nav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        burger.classList.remove("is-open");
        nav.classList.remove("is-open");
        burger.setAttribute("aria-expanded", "false");
      });
    });
  }

  const revealItems = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && revealItems.length) {
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    revealItems.forEach((item) => revealObserver.observe(item));
  } else {
    revealItems.forEach((item) => item.classList.add("is-visible"));
  }

  const cartTrigger = document.getElementById("cartTrigger");
  const cartDrawer = document.getElementById("cartDrawer");
  const cartOverlay = document.getElementById("cartOverlay");
  const cartClose = document.getElementById("cartClose");
  const cartItems = document.getElementById("cartItems");
  const cartCount = document.getElementById("cartCount");
  const cartTotal = document.getElementById("cartTotal");
  const cartOrder = document.getElementById("cartOrder");
  const cartToast = document.getElementById("cartToast");

  const qtyModal = document.getElementById("qtyModal");
  const qtyModalOverlay = document.getElementById("qtyModalOverlay");
  const qtyModalClose = document.getElementById("qtyModalClose");
  const qtyModalTitle = document.getElementById("qtyModalTitle");
  const qtyModalPrice = document.getElementById("qtyModalPrice");
  const qtyModalDesc = document.getElementById("qtyModalDesc");
  const qtyMinus = document.getElementById("qtyMinus");
  const qtyPlus = document.getElementById("qtyPlus");
  const qtyValue = document.getElementById("qtyValue");
  const qtyAddToCart = document.getElementById("qtyAddToCart");

  let cart = [];
  let selectedProduct = null;
  let selectedQty = 1;
  let toastTimer = null;

  try {
    const saved = localStorage.getItem("lira_cart");
    cart = saved ? JSON.parse(saved) : [];
    if (!Array.isArray(cart)) cart = [];
  } catch {
    cart = [];
  }

  function saveCart() {
    localStorage.setItem("lira_cart", JSON.stringify(cart));
  }

  function totalCount() {
    return cart.reduce((sum, item) => sum + item.qty, 0);
  }

  function totalPrice() {
    return cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  }

  function encodeMessage(text) {
    return encodeURIComponent(text).replace(/%20/g, "+");
  }

  function buildTelegramText() {
    if (!cart.length) return encodeMessage("Хочу зробити замовлення");

    let text = "🕯 Замовлення з сайту Lira Candles\n\n";
    cart.forEach((item, index) => {
      text += `${index + 1}. ${item.name}\n`;
      text += `${item.desc}\n`;
      text += `Кількість: ${item.qty}\n`;
      text += `Ціна: ${item.price} грн\n`;
      text += `Сума позиції: ${item.price * item.qty} грн\n\n`;
    });
    text += `Загальна сума: ${totalPrice()} грн\n\n`;
    text += "Ім'я:\n";
    text += "Телефон:\n";
    text += "Місто:\n";
    text += "Відділення / адреса доставки:\n";
    text += "Коментар до замовлення:\n";

    return encodeMessage(text);
  }

  function updateOrderLink() {
    if (!cartOrder) return;
    const baseHref = cartOrder.dataset.href || cartOrder.getAttribute("href") || "#";
    if (!baseHref || baseHref === "#" || baseHref.includes("PASTE_")) return;
    const cleanHref = baseHref.split("?")[0];
    cartOrder.setAttribute("href", `${cleanHref}?text=${buildTelegramText()}`);
  }

  function openCart() {
    if (!cartDrawer || !cartOverlay) return;
    cartDrawer.classList.add("is-open");
    cartOverlay.classList.add("is-open");
    cartDrawer.setAttribute("aria-hidden", "false");
    document.body.classList.add("cart-open");
  }

  function closeCart() {
    if (!cartDrawer || !cartOverlay) return;
    cartDrawer.classList.remove("is-open");
    cartOverlay.classList.remove("is-open");
    cartDrawer.setAttribute("aria-hidden", "true");
    if (!qtyModal?.classList.contains("is-open")) document.body.classList.remove("cart-open");
  }

  function openQtyModal(name, price, desc) {
    if (!qtyModal || !qtyModalOverlay) return;
    selectedProduct = { name, price, desc };
    selectedQty = 1;
    if (qtyModalTitle) qtyModalTitle.textContent = name;
    if (qtyModalPrice) qtyModalPrice.textContent = `${price} грн`;
    if (qtyModalDesc) qtyModalDesc.textContent = desc;
    if (qtyValue) qtyValue.textContent = String(selectedQty);
    qtyModal.classList.add("is-open");
    qtyModalOverlay.classList.add("is-open");
    qtyModal.setAttribute("aria-hidden", "false");
    document.body.classList.add("cart-open");
  }

  function closeQtyModal() {
    if (!qtyModal || !qtyModalOverlay) return;
    qtyModal.classList.remove("is-open");
    qtyModalOverlay.classList.remove("is-open");
    qtyModal.setAttribute("aria-hidden", "true");
    if (!cartDrawer?.classList.contains("is-open")) document.body.classList.remove("cart-open");
  }

  function showToast(message) {
    if (!cartToast) return;
    cartToast.textContent = message;
    cartToast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      cartToast.classList.remove("is-visible");
    }, 1800);
  }

  function renderCart() {
    if (!cartItems || !cartCount || !cartTotal) return;
    cartCount.textContent = String(totalCount());
    cartTotal.textContent = `${totalPrice()} грн`;
    if (!cart.length) {
      cartItems.innerHTML = '<div class="cart-empty">Кошик порожній</div>';
      updateOrderLink();
      return;
    }
    cartItems.innerHTML = cart.map((item, index) => `
      <div class="cart-item">
        <div class="cart-item__top">
          <div>
            <strong>${item.name}</strong>
            <span class="cart-item__desc">${item.desc}</span>
          </div>
          <div class="cart-item__subtotal">${item.price * item.qty} грн</div>
        </div>
        <div class="cart-item__controls">
          <div class="qty-box">
            <button class="qty-btn" type="button" data-action="minus" data-index="${index}">−</button>
            <span class="qty-value">${item.qty}</span>
            <button class="qty-btn" type="button" data-action="plus" data-index="${index}">+</button>
          </div>
          <button class="cart-remove" type="button" data-action="remove" data-index="${index}">Видалити</button>
        </div>
      </div>`).join("");
    updateOrderLink();
  }

  function addToCart(name, price, desc, qty) {
    const existing = cart.find((item) => item.name === name);
    if (existing) {
      existing.qty += qty;
    } else {
      cart.push({ name, price, desc, qty });
    }
    saveCart();
    renderCart();
  }

  function changeQty(index, action) {
    const item = cart[index];
    if (!item) return;
    if (action === "plus") item.qty += 1;
    if (action === "minus") {
      item.qty -= 1;
      if (item.qty <= 0) cart.splice(index, 1);
    }
    if (action === "remove") cart.splice(index, 1);
    saveCart();
    renderCart();
  }

  document.querySelectorAll(".product-add").forEach((button) => {
    button.addEventListener("click", () => {
      const name = button.dataset.product || "Товар";
      const price = Number(button.dataset.price || 0);
      const desc = button.dataset.desc || "Декоративна свічка ручної роботи.";
      openQtyModal(name, price, desc);
    });
  });

  if (qtyMinus) qtyMinus.addEventListener("click", () => {
    selectedQty = Math.max(1, selectedQty - 1);
    if (qtyValue) qtyValue.textContent = String(selectedQty);
  });
  if (qtyPlus) qtyPlus.addEventListener("click", () => {
    selectedQty += 1;
    if (qtyValue) qtyValue.textContent = String(selectedQty);
  });
  if (qtyAddToCart) qtyAddToCart.addEventListener("click", () => {
    if (!selectedProduct) return;
    addToCart(selectedProduct.name, selectedProduct.price, selectedProduct.desc, selectedQty);
    closeQtyModal();
    showToast(`Додано: ${selectedProduct.name}`);
  });
  if (qtyModalClose) qtyModalClose.addEventListener("click", closeQtyModal);
  if (qtyModalOverlay) qtyModalOverlay.addEventListener("click", closeQtyModal);

  if (cartItems) {
    cartItems.addEventListener("click", (event) => {
      const target = event.target.closest("[data-action]");
      if (!target) return;
      const action = target.dataset.action;
      const index = Number(target.dataset.index);
      if (Number.isNaN(index)) return;
      changeQty(index, action);
    });
  }

  if (cartTrigger) cartTrigger.addEventListener("click", openCart);
  if (cartClose) cartClose.addEventListener("click", closeCart);
  if (cartOverlay) cartOverlay.addEventListener("click", closeCart);

  renderCart();
});
