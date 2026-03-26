
document.addEventListener('DOMContentLoaded', () => {
  document.documentElement.classList.add('js-ready');

  const STATUS_LABELS = {
    new: 'Нове замовлення',
    production: 'Передано на виготовлення',
    awaiting_delivery: 'Очікує на доставку',
    shipping: 'Передано на доставку',
    pickup: 'Прибуло в пункт видачі',
    done: 'Виконано',
    cancelled: 'Скасовано'
  };

  const burger = document.getElementById('burger');
  const nav = document.getElementById('nav');

  if (burger && nav) {
    burger.addEventListener('click', () => {
      burger.classList.toggle('is-open');
      nav.classList.toggle('is-open');
      const expanded = burger.getAttribute('aria-expanded') === 'true';
      burger.setAttribute('aria-expanded', String(!expanded));
      document.body.classList.toggle('menu-open');
    });

    nav.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        burger.classList.remove('is-open');
        nav.classList.remove('is-open');
        burger.setAttribute('aria-expanded', 'false');
        document.body.classList.remove('menu-open');
      });
    });
  }

  const revealItems = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && revealItems.length) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });

    revealItems.forEach((item) => observer.observe(item));
  } else {
    revealItems.forEach((item) => item.classList.add('is-visible'));
  }

  const cartTrigger = document.getElementById('cartTrigger');
  const cartDrawer = document.getElementById('cartDrawer');
  const cartOverlay = document.getElementById('cartOverlay');
  const cartClose = document.getElementById('cartClose');
  const cartItems = document.getElementById('cartItems');
  const cartCount = document.getElementById('cartCount');
  const cartTotal = document.getElementById('cartTotal');

  const qtyModal = document.getElementById('qtyModal');
  const qtyModalOverlay = document.getElementById('qtyModalOverlay');
  const qtyModalClose = document.getElementById('qtyModalClose');
  const qtyModalTitle = document.getElementById('qtyModalTitle');
  const qtyModalPrice = document.getElementById('qtyModalPrice');
  const qtyModalDesc = document.getElementById('qtyModalDesc');
  const qtyMinus = document.getElementById('qtyMinus');
  const qtyPlus = document.getElementById('qtyPlus');
  const qtyValue = document.getElementById('qtyValue');
  const qtyAddToCart = document.getElementById('qtyAddToCart');

  const checkoutOpen = document.getElementById('checkoutOpen');
  const checkoutModal = document.getElementById('checkoutModal');
  const checkoutOverlay = document.getElementById('checkoutOverlay');
  const checkoutClose = document.getElementById('checkoutClose');
  const checkoutForm = document.getElementById('checkoutForm');
  const checkoutStatus = document.getElementById('checkoutStatus');
  const checkoutName = document.getElementById('checkoutName');
  const checkoutPhone = document.getElementById('checkoutPhone');
  const checkoutCity = document.getElementById('checkoutCity');
  const checkoutAddress = document.getElementById('checkoutAddress');
  const checkoutComment = document.getElementById('checkoutComment');
  const checkoutCall = document.getElementById('checkoutCall');

  const orderPageList = document.getElementById('orderPageList');
  const orderPageRefresh = document.getElementById('orderPageRefresh');
  const ordersTotalCount = document.getElementById('ordersTotalCount');
  const ordersActiveCount = document.getElementById('ordersActiveCount');

  let cart = [];
  let recentOrders = [];
  let selectedProduct = null;
  let selectedQty = 1;
  let toastTimer = null;

  const toast = document.createElement('div');
  toast.className = 'site-toast';
  document.body.appendChild(toast);

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2200);
  }

  function loadState() {
    try {
      const savedCart = localStorage.getItem('lira_cart');
      cart = savedCart ? JSON.parse(savedCart) : [];
      if (!Array.isArray(cart)) cart = [];
    } catch {
      cart = [];
    }

    try {
      const savedOrders = localStorage.getItem('lira_recent_orders');
      recentOrders = savedOrders ? JSON.parse(savedOrders) : [];
      if (!Array.isArray(recentOrders)) recentOrders = [];
    } catch {
      recentOrders = [];
    }
  }

  function saveCart() {
    localStorage.setItem('lira_cart', JSON.stringify(cart));
  }

  function saveOrders() {
    localStorage.setItem('lira_recent_orders', JSON.stringify(recentOrders));
  }

  function totalCount() {
    return cart.reduce((sum, item) => sum + item.qty, 0);
  }

  function totalPrice() {
    return cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  }

  function lockBody() {
    if (
      (cartDrawer && cartDrawer.classList.contains('is-open')) ||
      (qtyModal && qtyModal.classList.contains('is-open')) ||
      (checkoutModal && checkoutModal.classList.contains('is-open'))
    ) {
      document.body.classList.add('cart-open');
    } else {
      document.body.classList.remove('cart-open');
    }
  }

  function openCart() {
    if (!cartDrawer || !cartOverlay) return;
    cartDrawer.classList.add('is-open');
    cartOverlay.classList.add('is-open');
    cartDrawer.setAttribute('aria-hidden', 'false');
    lockBody();
  }

  function closeCart() {
    if (!cartDrawer || !cartOverlay) return;
    cartDrawer.classList.remove('is-open');
    cartOverlay.classList.remove('is-open');
    cartDrawer.setAttribute('aria-hidden', 'true');
    lockBody();
  }

  function openQtyModal(name, price, desc) {
    if (!qtyModal || !qtyModalOverlay) return;
    selectedProduct = { name, price, desc };
    selectedQty = 1;
    if (qtyModalTitle) qtyModalTitle.textContent = name;
    if (qtyModalPrice) qtyModalPrice.textContent = `${price} грн`;
    if (qtyModalDesc) qtyModalDesc.textContent = desc;
    if (qtyValue) qtyValue.textContent = '1';
    qtyModal.classList.add('is-open');
    qtyModalOverlay.classList.add('is-open');
    qtyModal.setAttribute('aria-hidden', 'false');
    lockBody();
  }

  function closeQtyModal() {
    if (!qtyModal || !qtyModalOverlay) return;
    qtyModal.classList.remove('is-open');
    qtyModalOverlay.classList.remove('is-open');
    qtyModal.setAttribute('aria-hidden', 'true');
    lockBody();
  }

  function openCheckout() {
    if (!checkoutModal || !checkoutOverlay) return;
    if (!cart.length) {
      showToast('Спочатку додайте товари в кошик');
      return;
    }
    checkoutModal.classList.add('is-open');
    checkoutOverlay.classList.add('is-open');
    checkoutModal.setAttribute('aria-hidden', 'false');
    lockBody();
  }

  function closeCheckout() {
    if (!checkoutModal || !checkoutOverlay) return;
    checkoutModal.classList.remove('is-open');
    checkoutOverlay.classList.remove('is-open');
    checkoutModal.setAttribute('aria-hidden', 'true');
    lockBody();
  }

  function renderCart() {
    if (!cartItems || !cartCount || !cartTotal) return;
    cartCount.textContent = String(totalCount());
    cartTotal.textContent = `${totalPrice()} грн`;

    if (!cart.length) {
      cartItems.innerHTML = '<div class="cart-empty">Кошик порожній</div>';
      return;
    }

    cartItems.innerHTML = cart.map((item, index) => `
      <div class="cart-item">
        <div class="cart-item__top">
          <div>
            <strong>${item.name}</strong>
            <p class="cart-item__meta">${item.desc}</p>
          </div>
          <div class="cart-item__price">${item.price * item.qty} грн</div>
        </div>
        <div class="cart-item__controls">
          <div class="qty-box">
            <button class="qty-btn" type="button" data-action="minus" data-index="${index}">−</button>
            <span class="qty-value">${item.qty}</span>
            <button class="qty-btn" type="button" data-action="plus" data-index="${index}">+</button>
          </div>
          <button class="cart-remove" type="button" data-action="remove" data-index="${index}">Видалити</button>
        </div>
      </div>
    `).join('');
  }

  function getOrderProgress(status) {
    const steps = ['new', 'production', 'awaiting_delivery', 'shipping', 'pickup', 'done'];
    if (status === 'cancelled') return 0;
    const index = steps.indexOf(status || 'new');
    return index === -1 ? 8 : Math.max(8, ((index + 1) / steps.length) * 100);
  }

  function renderOrdersToPage() {
    if (!orderPageList) return;

    if (!recentOrders.length) {
      orderPageList.innerHTML = '<div class="cart-empty orders-empty">Поки що тут порожньо. Після оформлення замовлення воно з’явиться в цьому розділі.</div>';
      if (ordersTotalCount) ordersTotalCount.textContent = '0';
      if (ordersActiveCount) ordersActiveCount.textContent = '0';
      return;
    }

    const activeCount = recentOrders.filter((order) => !['done', 'cancelled'].includes(order.status)).length;
    if (ordersTotalCount) ordersTotalCount.textContent = String(recentOrders.length);
    if (ordersActiveCount) ordersActiveCount.textContent = String(activeCount);

    orderPageList.innerHTML = recentOrders.map((order) => {
      const status = order.status || 'new';
      const progress = getOrderProgress(status);
      const note = status === 'cancelled'
        ? 'Замовлення скасовано. За потреби можна оформити нове.'
        : status === 'done'
          ? 'Замовлення виконано. Дякуємо за покупку ❤️'
          : `Поточний етап: ${STATUS_LABELS[status] || 'Нове замовлення'}`;

      return `
        <article class="order-page-card order-page-card--modern">
          <div class="order-page-card__top">
            <div>
              <strong>${order.publicId}</strong>
              <p class="order-page-card__meta">${order.itemsSummary || ''}</p>
            </div>
            <span class="order-badge order-badge--${status}">${STATUS_LABELS[status] || 'Нове замовлення'}</span>
          </div>

          <div class="order-progress">
            <div class="order-progress__track">
              <span class="order-progress__fill order-progress__fill--${status}" style="width:${progress}%"></span>
            </div>
            <div class="order-progress__labels">
              <span>Прийнято</span>
              <span>Готовність</span>
              <span>Доставка</span>
            </div>
          </div>

          <div class="order-page-card__bottom">
            <div>
              <div class="order-page-card__total">${order.total || 0} грн</div>
              <p class="order-page-card__note">${note}</p>
            </div>
            <div class="order-page-actions">
              ${order.canCancel ? `<button class="order-cancel" type="button" data-order-id="${order.publicId}">Скасувати</button>` : ''}
            </div>
          </div>
        </article>
      `;
    }).join('');
  }

  async function refreshOrders() {
    if (!recentOrders.length) {
      renderOrdersToPage();
      return;
    }

    try {
      const ids = recentOrders.map((order) => order.publicId).join(',');
      const response = await fetch(`/api/orders/by-ids?ids=${encodeURIComponent(ids)}`);
      if (!response.ok) throw new Error('bad response');
      const data = await response.json();
      if (Array.isArray(data.orders)) {
        recentOrders = data.orders;
        saveOrders();
      }
    } catch {}
    renderOrdersToPage();
  }

  function addToCart(name, price, desc, qty) {
    const existing = cart.find((item) => item.name === name);
    if (existing) existing.qty += qty;
    else cart.push({ name, price, desc, qty });
    saveCart();
    renderCart();
  }

  function changeQty(index, action) {
    const item = cart[index];
    if (!item) return;
    if (action === 'plus') item.qty += 1;
    if (action === 'minus') {
      item.qty -= 1;
      if (item.qty <= 0) cart.splice(index, 1);
    }
    if (action === 'remove') cart.splice(index, 1);
    saveCart();
    renderCart();
  }

  async function submitOrder(event) {
    event.preventDefault();
    if (!checkoutForm || !checkoutStatus) return;
    if (!cart.length) {
      checkoutStatus.textContent = 'Кошик порожній.';
      return;
    }

    const payload = {
      name: checkoutName?.value.trim() || '',
      phone: checkoutPhone?.value.trim() || '',
      city: checkoutCity?.value.trim() || '',
      address: checkoutAddress?.value.trim() || '',
      comment: checkoutComment?.value.trim() || '',
      callMe: Boolean(checkoutCall?.checked),
      items: cart
    };

    if (!payload.name || !payload.phone || !payload.city || !payload.address) {
      checkoutStatus.textContent = 'Заповніть ім’я, телефон, місто та адресу.';
      return;
    }

    checkoutStatus.textContent = 'Відправляємо замовлення...';
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'Помилка');

      checkoutStatus.textContent = `Замовлення ${data.order.publicId} оформлено. Наш менеджер звʼяжеться з вами.`;
      recentOrders.unshift(data.order);
      saveOrders();
      cart = [];
      saveCart();
      renderCart();
      renderOrdersToPage();
      checkoutForm.reset();

      setTimeout(() => {
        closeCheckout();
        closeCart();
      }, 900);

      showToast(`Замовлення ${data.order.publicId} оформлено`);
    } catch {
      checkoutStatus.textContent = 'Не вдалося оформити замовлення. Спробуйте ще раз.';
    }
  }

  async function cancelOrder(publicId) {
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(publicId)}/cancel`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error('cancel failed');
      recentOrders = recentOrders.map((order) => order.publicId === publicId ? data.order : order);
      saveOrders();
      renderOrdersToPage();
      showToast(`Замовлення ${publicId} скасовано`);
    } catch {
      showToast('Не вдалося скасувати замовлення');
    }
  }

  document.querySelectorAll('.product-order').forEach((button) => {
    button.addEventListener('click', () => {
      openQtyModal(
        button.dataset.product || 'Товар',
        Number(button.dataset.price || 0),
        button.dataset.desc || 'Декоративна свічка ручної роботи.'
      );
    });
  });

  if (qtyMinus) qtyMinus.addEventListener('click', () => {
    selectedQty = Math.max(1, selectedQty - 1);
    if (qtyValue) qtyValue.textContent = String(selectedQty);
  });

  if (qtyPlus) qtyPlus.addEventListener('click', () => {
    selectedQty += 1;
    if (qtyValue) qtyValue.textContent = String(selectedQty);
  });

  if (qtyAddToCart) qtyAddToCart.addEventListener('click', () => {
    if (!selectedProduct) return;
    addToCart(selectedProduct.name, selectedProduct.price, selectedProduct.desc, selectedQty);
    closeQtyModal();
    showToast(`Додано: ${selectedProduct.name}`);
  });

  if (cartItems) {
    cartItems.addEventListener('click', (event) => {
      const target = event.target.closest('[data-action]');
      if (!target) return;
      changeQty(Number(target.dataset.index), target.dataset.action);
    });
  }

  if (orderPageList) {
    orderPageList.addEventListener('click', (event) => {
      const button = event.target.closest('.order-cancel');
      if (!button) return;
      cancelOrder(button.dataset.orderId);
    });
  }

  if (orderPageRefresh) orderPageRefresh.addEventListener('click', refreshOrders);
  if (cartTrigger) cartTrigger.addEventListener('click', openCart);
  if (cartClose) cartClose.addEventListener('click', closeCart);
  if (cartOverlay) cartOverlay.addEventListener('click', closeCart);

  if (qtyModalClose) qtyModalClose.addEventListener('click', closeQtyModal);
  if (qtyModalOverlay) qtyModalOverlay.addEventListener('click', closeQtyModal);

  if (checkoutOpen) checkoutOpen.addEventListener('click', openCheckout);
  if (checkoutClose) checkoutClose.addEventListener('click', closeCheckout);
  if (checkoutOverlay) checkoutOverlay.addEventListener('click', closeCheckout);
  if (checkoutForm) checkoutForm.addEventListener('submit', submitOrder);

  loadState();
  renderCart();
  renderOrdersToPage();
  refreshOrders();
});
