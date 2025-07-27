class WishlistButton {
  constructor(config) {
    this.customerId = config.customerId;
    this.productId = config.productId;
    this.uid = config.uid;
    this.storeUrl = config.storeUrl;
    this.currency = config.currency;
    this.token = window.WishlistUtils.getCookie('jwt');
    this.data = config.data;
    this.icons = {
      heart: `<svg xmlns="http://www.w3.org/2000/svg" width="16px" height="16px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle;"><path d="M14 20.408c-.492.308-.903.546-1.192.709-.153.086-.308.17-.463.252h-.002a.75.75 0 01-.686 0 16.709 16.709 0 01-.465-.252 31.147 31.147 0 01-4.803-3.34C3.8 15.572 1 12.331 1 8.513 1 5.052 3.829 2.5 6.736 2.5 9.03 2.5 10.881 3.726 12 5.605 13.12 3.726 14.97 2.5 17.264 2.5 20.17 2.5 23 5.052 23 8.514c0 3.818-2.801 7.06-5.389 9.262A31.146 31.146 0 0114 20.408z"/></svg>`,
      star: `<svg xmlns="http://www.w3.org/2000/svg" width="16px" height="16px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle;"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.34 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z"/></svg>`,
      plus: `<svg xmlns="http://www.w3.org/2000/svg" width="16px" height="16px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle;"><path d="M12 4v16m-8-8h16"/></svg>`
    };
    this.checkIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16px" height="16px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle;"><path d="M20 6L9 17L4 12"/></svg>`;
    this.button = document.querySelector('.wishlist-button');
    this.icon = document.createElement('span');
    this.text = document.createElement('span');
    document.addEventListener('wishlist:icon-toggled', (e) => {
      if (e.detail.productId == this.productId) {
        // Use the isWishlisted property from the event detail
        this.setButtonState(e.detail.isWishlisted);
      }
    });
    this.init();
  }

  async init() {
    if (!this.button) {
      console.error('Wishlist button not found');
      return;
    }

    this.icon.style.marginRight = '5px';
    this.text.style.color = this.data.textColor;
    this.icon.style.color = this.data.textColor;
    this.button.style.backgroundColor = this.data.bgColor || 'black';
    this.button.style.color = this.data.textColor || 'white';
    this.button.style.borderRadius = `${this.data.borderRadius}px` || '10px';

    await this.checkWishlistStatus();

    this.button.innerHTML = '';
    this.button.appendChild(this.icon);
    this.button.appendChild(this.text);

    this.button.addEventListener('click', () => this.toggleWishlist());
  }

  async checkWishlistStatus() {
    try {
      const response = await fetch(`/apps/apw/app/apiwishlist?customerId=${this.customerId}&storeUrl=${this.storeUrl}&uid=${this.uid}&token=${this.token || ''}&currency=${this.currency}`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const result = await response.json();

      if (result.token && !this.token) {
        this.token = result.token;
        window.WishlistUtils.setCookie('jwt', this.token, 3.5);
      }

      const isWishlisted = result.data.includes(this.productId);
      this.setButtonState(isWishlisted);
    } catch (err) {
      console.error('Fetch error:', err);
    }
  }

  async toggleWishlist() {
    const isAdding = this.text.textContent === this.data.beforeText;
    const endpoint = isAdding ? 'apiwishlist' : 'apiremove';
    this.setButtonState(isAdding);
    try {
      const response = await fetch(`/apps/apw/app/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: this.customerId,
          productId: this.productId,
          uid: this.uid,
          storeUrl: this.storeUrl,
          token: this.token
        })
      });
      const result = await response.json();
      document.dispatchEvent(new CustomEvent('wishlist:updated'));

      if (window.wishlistIconManager) {
        window.wishlistIconManager.updateWishlistStatus().then(() => {
          window.wishlistIconManager.updateIconsForProduct(this.productId);
        });
      }

      if (result.token && !this.token) {
        this.token = result.token;
        window.WishlistUtils.setCookie('jwt', this.token, 3.5);
      }
    } catch (err) {
      console.error(err);
    }
  }

  setButtonState(isWishlisted) {
    this.text.textContent = isWishlisted ? this.data.afterText : this.data.beforeText;
    this.icon.innerHTML = isWishlisted ? this.checkIcon : this.icons[this.data.icon] || this.icons.heart;
    this.icon.style.color = this.data.textColor || 'white';
  }
}


class WishlistIconManager {
  constructor({ customerId, storeUrl, uid, currency }) {
    this.customerId = customerId;
    this.storeUrl = storeUrl;
    this.uid = uid;
    this.token = window.WishlistUtils.getCookie('jwt') || '';
    this.currency = currency || 'USD';
    this.wishlistedProducts = new Set();
    this.settings = {
      iconBefore: 'heart',
      iconAfter: 'filled',
      iconColorBefore: '#000000',
      iconColorAfter: '#ff0000',
      defaultSelectors: [
        '.product-card__image-container',
        '.card__media',
        '.grid-product__image-wrap',
        '.product__media-container',
        '.product-image-container',
        '.product__image-wrapper',
        '[data-product-media-container]',
        '.image-container',
        '.card__inner',
      ],
      customSelectors: [],
      checkInterval: 300,
      maxChecks: 5
    };

    this.icons = {
      heart: color => `<svg xmlns="http://www.w3.org/2000/svg" fill="${color}" viewBox="0 0 24 24"><path d="M14 20.408c-.492.308-.903.546-1.192.709-.153.086-.308.17-.463.252h-.002a.75.75 0 01-.686 0 16.709 16.709 0 01-.465-.252 31.147 31.147 0 01-4.803-3.34C3.8 15.572 1 12.331 1 8.513 1 5.052 3.829 2.5 6.736 2.5 9.03 2.5 10.881 3.726 12 5.605 13.12 3.726 14.97 2.5 17.264 2.5 20.17 2.5 23 5.052 23 8.514c0 3.818-2.801 7.06-5.389 9.262A31.146 31.146 0 0114 20.408z"/></svg>`,
      filled: color => `<svg xmlns="http://www.w3.org/2000/svg" fill="${color}" viewBox="0 0 24 24"><path d="M14 20.408c-.492.308-.903.546-1.192.709-.153.086-.308.17-.463.252h-.002a.75.75 0 01-.686 0 16.709 16.709 0 01-.465-.252 31.147 31.147 0 01-4.803-3.34C3.8 15.572 1 12.331 1 8.513 1 5.052 3.829 2.5 6.736 2.5 9.03 2.5 10.881 3.726 12 5.605 13.12 3.726 14.97 2.5 17.264 2.5 20.17 2.5 23 5.052 23 8.514c0 3.818-2.801 7.06-5.389 9.262A31.146 31.146 0 0114 20.408z"/></svg>`
    };

    // Cache product data to avoid duplicate requests
    this.productCache = new Map();
  }

  async fetchSettings() {
    try {
      const response = await fetch(`/apps/apw/app/apiicon?storeUrl=${encodeURIComponent(this.storeUrl)}`);
      const data = await response.json();

      try {
        const customSelectors = JSON.parse(data.reply?.classSelector || '[]');
        if (Array.isArray(customSelectors)) {
          const cleaned = customSelectors.map(s => s.trim()).filter(Boolean);
          this.settings.customSelectors = Array.from(new Set([...this.settings.customSelectors, ...cleaned]));
        }
      } catch (e) {
        console.warn('Failed to parse classSelector from backend:', e);
      }

      this.applyCustomCSS(data.reply?.customCSS);
      Object.assign(this.settings, data.reply);
    } catch (err) {
      console.error('Error loading settings:', err);
    }
  }

  applyCustomCSS(css) {
    if (!css) return;
    const existingStyle = document.getElementById('wishlist-icon-custom-css-api');
    if (existingStyle) existingStyle.remove();

    const styleElement = document.createElement('style');
    styleElement.textContent = css;
    styleElement.id = 'wishlist-icon-custom-css-api';
    document.head.appendChild(styleElement);
  }

  async updateWishlistStatus() {
    try {
      const response = await fetch(`/apps/apw/app/apiwishlist?customerId=${this.customerId}&storeUrl=${this.storeUrl}&uid=${this.uid}&token=${this.token}&currency=${this.currency}`);

      if (response.ok) {
        const result = await response.json();
        if (result.token && !this.token) {
          this.token = result.token;
          window.WishlistUtils.setCookie('jwt', this.token, 3.5);
        }
        this.wishlistedProducts = new Set(result.data || []);
      }
    } catch (error) {
      console.error("Error updating wishlist:", error);
    }
  }



  createIcon(isWishlisted, productId) {
    const icon = document.createElement('div');
    icon.className = 'wishlist-icon';
    icon.innerHTML = isWishlisted
      ? this.icons[this.settings.iconAfter](this.settings.iconColorAfter)
      : this.icons[this.settings.iconBefore](this.settings.iconColorBefore);
    icon.dataset.productId = productId;
    return icon;
  }

  updateIconsForProduct(productId) {
    const isWishlisted = this.wishlistedProducts.has(productId);
    document.querySelectorAll(`.wishlist-icon[data-product-id="${productId}"]`).forEach(icon => {
      icon.innerHTML = isWishlisted
        ? this.icons[this.settings.iconAfter](this.settings.iconColorAfter)
        : this.icons[this.settings.iconBefore](this.settings.iconColorBefore);
    });
  }

  async handleProductCard(card) {
    if (card.dataset.wishlistProcessed || card.classList.contains(this.settings.excludedClass) || card.closest('.wishlist-card')) return;

    // Find the image container or the image itself
    let selectors = (this.settings.customSelectors && this.settings.customSelectors.length > 0)
      ? this.settings.customSelectors
      : this.settings.defaultSelectors;

    let imageContainer = null;
    for (const selector of selectors) {
      imageContainer = card.querySelector(selector) || card.closest(selector);
      if (imageContainer) break;
    }

    // Fallback: try to find any container that might work
    if (!imageContainer) {
      imageContainer = card.querySelector('[class*="image"], [class*="media"], [class*="card"], [data-product-handle], a[href*="/products/"], .product-card, .grid__item, .card, .card__inner') || 
                      card.querySelector('img')?.parentElement || 
                      card;
    }
    if (!imageContainer) return;

    // Get product handle or ID
    let productId = card.dataset.productId;
    let handle = card.dataset.productHandle;

    // Try to get handle from anchor if not present
    if (!handle) {
      const productLink = card.querySelector('a[href*="/products/"]');
      if (productLink) {
        handle = productLink.getAttribute('href').split('/products/')[1]?.split(/[?#]/)[0];
      }
    }
    if (!productId && handle) {
      if (this.productCache.has(handle)) {
        productId = this.productCache.get(handle);
      } else {
        try {
          const productData = await fetch(`/products/${handle}.js`).then(res => res.json());
          productId = productData.id.toString();
          this.productCache.set(handle, productId);
        } catch (e) {
          console.error('Failed to fetch product data for handle:', handle, e);
          return;
        }
      }
    }

    if (!productId) return;

    // Prevent duplicate icons
    if (imageContainer.querySelector('.wishlist-icon')) return;

    // Create and append the icon
    const icon = this.createIcon(this.wishlistedProducts.has(productId), productId);

    // Style the container if needed
    if (window.getComputedStyle(imageContainer).position === 'static') {
      imageContainer.style.position = 'relative';
    }

    icon.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const isWishlisted = this.wishlistedProducts.has(productId);
      const endpoint = isWishlisted ? 'apiremove' : 'apiwishlist';

      try {
        if (isWishlisted) {
          this.wishlistedProducts.delete(productId);
          icon.innerHTML = this.icons[this.settings.iconBefore](this.settings.iconColorBefore);
        } else {
          this.wishlistedProducts.add(productId);
          icon.innerHTML = this.icons[this.settings.iconAfter](this.settings.iconColorAfter);
        }
        this.updateIconsForProduct(productId);
        const response = await fetch(`/apps/apw/app/${endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerId: this.customerId,
            productId,
            uid: this.uid,
            storeUrl: this.storeUrl,
            token: this.token,
            currency: this.currency
          })
        });

        const result = await response.json();
       
        document.dispatchEvent(new CustomEvent('wishlist:updated'));
        if (result.token && !this.token) {
          this.token = result.token;
          window.WishlistUtils.setCookie('jwt', this.token, 3.5);
        }
         document.dispatchEvent(new CustomEvent('wishlist:icon-toggled', {
          detail: { 
            productId,
            isWishlisted: !isWishlisted // The new state after the toggle
          }
        }));
      } catch (err) {
        console.error("Error updating wishlist:", err);
      }
    });

    imageContainer.appendChild(icon);
    card.dataset.wishlistProcessed = true;
  }

  processCards() {
    const selectors = (this.settings.customSelectors && this.settings.customSelectors.length > 0)
      ? this.settings.customSelectors
      : this.settings.defaultSelectors;
    const productCardSelector = selectors.join(', ');
    const productCards = document.querySelectorAll(productCardSelector);
    productCards.forEach(card => this.handleProductCard(card));

    if (productCards.length === 0 && this.checkCount < this.settings.maxChecks) {
      this.checkCount++;
      setTimeout(() => this.processCards(), this.settings.checkInterval);
    }
  }

  observeMutations() {
    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === 1) {
            const selectors = (this.settings.customSelectors && this.settings.customSelectors.length > 0)
              ? this.settings.customSelectors
              : this.settings.defaultSelectors;
            const productCardSelector = selectors.join(', ');
            const cards = node.matches(productCardSelector)
              ? [node]
              : node.querySelectorAll(productCardSelector);
            cards.forEach(card => this.handleProductCard(card));
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  async init() {
    this.checkCount = 0;
    await this.fetchSettings();
    await this.updateWishlistStatus();
    this.processCards();
    this.observeMutations();
  }
}