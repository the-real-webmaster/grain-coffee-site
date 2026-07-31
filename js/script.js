/* =========================================================================
   GRAIN — общий JS для всех страниц сайта.
   Разбит на независимые функции-инициализаторы, которые вызываются
   один раз при загрузке DOM. Каждая функция сама проверяет, есть ли
   на странице нужные элементы, поэтому файл безопасно подключать
   на любой странице сайта.
   ========================================================================= */

document.addEventListener('DOMContentLoaded', () => {
  initPageLoader();
  initThemeToggle();
  initBurgerMenu();
  initHeaderScrollState();
  initScrollAnimations();
  initHeroParallax();
  initFooterYear();
  initMenuFilters();
  initGalleryLightbox();
  initGalleryFilters();
  initContactForm();
  initBackToTop();
  initCardTilt();
  initTestimonialsCarousel();
});

/* ---------- Экранирование пользовательского текста (защита от XSS) ----------
   Используется везде, где значение из формы/URL могло бы попасть в разметку
   через innerHTML. Сейчас в проекте это не требуется напрямую (персональное
   приветствие в форме выводится через textContent, который экранирует сам
   по себе), но функция оставлена как переиспользуемый защитный барьер —
   на случай, если в будущем понадобится подставить пользовательский текст
   в HTML-шаблон. */
function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

/* ---------- Индикатор загрузки страницы ---------- */
function initPageLoader() {
  const loader = document.querySelector('.page-loader');
  if (!loader) return;

  const hide = () => loader.classList.add('is-hidden');

  window.addEventListener('load', () => {
    // небольшая задержка, чтобы не мигало на быстрых загрузках
    setTimeout(hide, 250);
  });

  // Аварийный предохранитель: если событие "load" по какой-то причине
  // задерживается (медленная сеть, зависший шрифт и т.п.), не оставляем
  // пользователя смотреть на заглушку вечно.
  setTimeout(hide, 2500);
}

/* ---------- Переключение темы (светлая / тёмная) ---------- */
function initThemeToggle() {
  const STORAGE_KEY = 'grain-theme';
  const root = document.documentElement;
  const toggleBtn = document.querySelector('.theme-toggle');

  const savedTheme = localStorage.getItem(STORAGE_KEY);
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const initialTheme = savedTheme || (prefersDark ? 'dark' : 'light');

  root.setAttribute('data-theme', initialTheme);
  updateToggleLabel(initialTheme);

  if (!toggleBtn) return;

  toggleBtn.addEventListener('click', () => {
    const current = root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    localStorage.setItem(STORAGE_KEY, next);
    updateToggleLabel(next);
  });

  function updateToggleLabel(theme) {
    const label = theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему';
    toggleBtn.setAttribute('aria-label', label);
    toggleBtn.setAttribute('title', label);
  }
}

/* ---------- Мобильное бургер-меню ----------
   Помимо открытия/закрытия панели, здесь же живёт вся доступность
   мобильного меню: подпись кнопки синхронизирована с состоянием,
   Escape и клик по подложке закрывают меню, а фокус при открытии
   не убегает за пределы панели (простой focus trap на Tab). */
function initBurgerMenu() {
  const burger = document.querySelector('.burger');
  const nav = document.querySelector('.main-nav');
  if (!burger || !nav) return;

  const LABEL_OPEN = 'Открыть меню';
  const LABEL_CLOSE = 'Закрыть меню';
  let lastFocused = null;

  const focusableSelector = 'a[href], button:not([disabled])';

  function openMenu() {
    lastFocused = document.activeElement;
    nav.classList.add('is-open');
    burger.classList.add('is-open');
    burger.setAttribute('aria-expanded', 'true');
    burger.setAttribute('aria-label', LABEL_CLOSE);
    document.body.style.overflow = 'hidden';
  }

  function closeMenu({ restoreFocus = false } = {}) {
    if (!nav.classList.contains('is-open')) return;
    nav.classList.remove('is-open');
    burger.classList.remove('is-open');
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', LABEL_OPEN);
    document.body.style.overflow = '';
    if (restoreFocus && lastFocused instanceof HTMLElement) {
      lastFocused.focus();
    }
  }

  burger.addEventListener('click', () => {
    if (nav.classList.contains('is-open')) {
      closeMenu({ restoreFocus: true });
    } else {
      openMenu();
    }
  });

  // Закрывать меню при клике на ссылку (переход на другую страницу/якорь)
  nav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => closeMenu());
  });

  document.addEventListener('keydown', (e) => {
    if (!nav.classList.contains('is-open')) return;

    if (e.key === 'Escape') {
      closeMenu({ restoreFocus: true });
      return;
    }

    // Простой focus trap: Tab не должен уводить фокус на элементы под меню
    if (e.key === 'Tab') {
      const focusable = Array.from(nav.querySelectorAll(focusableSelector));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  // Закрыть меню, если ресайз/поворот экрана вывел раскладку из мобильной
  window.addEventListener('resize', () => {
    if (window.matchMedia('(min-width: 901px)').matches) {
      closeMenu();
    }
  });
}

/* ---------- Изменение хедера при скролле ---------- */
function initHeaderScrollState() {
  const header = document.querySelector('.site-header');
  if (!header) return;

  // Пишем в style только когда состояние реально меняется — иначе на
  // каждый scroll-кадр (их десятки в секунду) браузер получает
  // одинаковую строку и всё равно тратит время на пересчёт стилей.
  let isScrolled = null;
  const onScroll = () => {
    const shouldBeScrolled = window.scrollY > 12;
    if (shouldBeScrolled === isScrolled) return;
    isScrolled = shouldBeScrolled;
    header.style.boxShadow = isScrolled ? 'var(--shadow-card)' : 'none';
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
}

/* ---------- Появление элементов при скролле (Intersection Observer) ---------- */
/* ---------- Появление элементов при скролле — библиотека AOS ----------
   AOS (Animate On Scroll, cdnjs.cloudflare.com/ajax/libs/aos) подключена
   в <head>/перед </body> каждой страницы и анимирует все элементы с
   атрибутом data-aos в разметке. Если библиотека не загрузилась
   (например, заблокирована офлайн/CSP) — просто ничего не анимируется,
   контент остаётся видимым как есть, ничего не ломается. */
function initScrollAnimations() {
  if (typeof AOS === 'undefined') return;
  // На мобильных анимация короче и с меньшим отступом срабатывания —
  // на маленьком экране длинный fade-up ощущается как тормознутость,
  // а не как красивый эффект.
  const isMobile = window.matchMedia('(max-width: 640px)').matches;
  AOS.init({
    duration: isMobile ? 450 : 700,
    easing: 'ease-out-cubic',
    once: true,
    offset: isMobile ? 20 : 40,
    disable: () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  });

  // Аварийный предохранитель (по тому же принципу, что и у page-loader
  // выше): CSS для [data-aos="fade-*"] сам по себе держит элемент на
  // opacity:0, пока JS не добавит класс .aos-animate. На длинных страницах
  // с большим числом анимированных карточек (например, меню) это может
  // не сработать для части блоков — тогда контент навсегда остаётся
  // невидимым, хотя физически он на странице есть. Через 2.5с после
  // полной загрузки принудительно "проявляем" всё, что AOS почему-то
  // пропустил, чтобы контент никогда не терялся из виду.
  window.addEventListener('load', () => {
    setTimeout(() => {
      document.querySelectorAll('[data-aos]:not(.aos-animate)').forEach((el) => {
        el.classList.add('aos-animate');
      });
    }, 2500);
  });
}

/* ---------- Лёгкий parallax-эффект декоративных элементов в hero ---------- */
function initHeroParallax() {
  const hero = document.querySelector('.hero');
  const decos = document.querySelectorAll('.hero-deco');
  if (!hero || !decos.length) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (window.matchMedia('(max-width: 900px)').matches) return;

  // mousemove может стрелять чаще, чем браузер успевает рисовать кадры —
  // копим только последнюю позицию и применяем её не чаще раза за кадр
  // через requestAnimationFrame, вместо того чтобы писать в style на
  // каждое отдельное событие.
  let rafId = null;
  let pendingEvent = null;

  const applyParallax = () => {
    rafId = null;
    if (!pendingEvent) return;
    const { innerWidth, innerHeight } = window;
    const x = (pendingEvent.clientX / innerWidth - 0.5) * 24;
    const y = (pendingEvent.clientY / innerHeight - 0.5) * 24;

    decos.forEach((deco, i) => {
      const factor = i % 2 === 0 ? 1 : -1;
      deco.style.transform = `translate(${x * factor}px, ${y * factor}px)`;
    });
  };

  hero.addEventListener('mousemove', (e) => {
    pendingEvent = e;
    if (rafId === null) {
      rafId = requestAnimationFrame(applyParallax);
    }
  });
}

/* ---------- Текущий год в футере ---------- */
function initFooterYear() {
  const yearEl = document.querySelector('#current-year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
}

/* ---------- Фильтрация карточек меню (menu.html) ---------- */
function initMenuFilters() {
  const filterButtons = document.querySelectorAll('.menu-filters .filter-btn');
  const categories = document.querySelectorAll('[data-menu-category]');
  if (!filterButtons.length || !categories.length) return;

  filterButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      filterButtons.forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      const target = btn.dataset.filter;

      categories.forEach((cat) => {
        const match = target === 'all' || cat.dataset.menuCategory === target;
        cat.style.display = match ? '' : 'none';
      });
    });
  });
}

/* ---------- Фильтрация галереи (gallery.html) ---------- */
function initGalleryFilters() {
  const filterButtons = document.querySelectorAll('.gallery-filters .filter-btn');
  const items = document.querySelectorAll('.masonry-grid figure');
  if (!filterButtons.length || !items.length) return;

  filterButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      filterButtons.forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      const target = btn.dataset.filter;

      items.forEach((item) => {
        const match = target === 'all' || item.dataset.category === target;
        item.style.display = match ? '' : 'none';
      });
    });
  });
}

/* ---------- Lightbox для галереи (gallery.html) ---------- */
function initGalleryLightbox() {
  const figures = Array.from(document.querySelectorAll('.masonry-grid figure'));
  const lightbox = document.querySelector('.lightbox');
  if (!figures.length || !lightbox) return;

  const stage = lightbox.querySelector('.lightbox-stage');
  const captionEl = lightbox.querySelector('.lightbox-caption');
  const closeBtn = lightbox.querySelector('.lightbox-close');
  const prevBtn = lightbox.querySelector('.lightbox-prev');
  const nextBtn = lightbox.querySelector('.lightbox-next');
  let currentIndex = 0;

  function openLightbox(index) {
    currentIndex = index;
    updateSlide();
    lightbox.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    lightbox.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  function updateSlide() {
    const img = figures[currentIndex].querySelector('img');
    const caption = figures[currentIndex].querySelector('figcaption');
    if (img) {
      stage.src = img.src;
      stage.alt = img.alt;
    }
    captionEl.textContent = caption ? caption.textContent : '';
  }

  function showNext(step) {
    currentIndex = (currentIndex + step + figures.length) % figures.length;
    updateSlide();
  }

  figures.forEach((figure, index) => {
    figure.addEventListener('click', () => openLightbox(index));
    figure.setAttribute('tabindex', '0');
    figure.setAttribute('role', 'button');
    figure.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openLightbox(index);
      }
    });
  });

  closeBtn.addEventListener('click', closeLightbox);
  nextBtn.addEventListener('click', () => showNext(1));
  prevBtn.addEventListener('click', () => showNext(-1));

  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
  });

  document.addEventListener('keydown', (e) => {
    if (!lightbox.classList.contains('is-open')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowRight') showNext(1);
    if (e.key === 'ArrowLeft') showNext(-1);
  });
}

/* ---------- Валидация и имитация отправки формы обратной связи ----------
   Меры защиты на уровне клиента (полный список — см. README, раздел
   «Безопасность»):
   1. Валидация обязательных полей и формата email перед «отправкой».
   2. Honeypot-поле: невидимое человеку, но доступное простым ботам —
      если оно заполнено, отправка молча отклоняется без подсказки боту.
   3. Персональное приветствие в успехе выводится через textContent, а не
      innerHTML — значение из поля «Имя» не может внедрить HTML/скрипт. */
function initContactForm() {
  const form = document.querySelector('#contact-form');
  if (!form) return;

  const successBox = document.querySelector('.form-success');
  const successText = successBox ? successBox.querySelector('.form-success-text') : null;
  const honeypot = form.querySelector('[data-honeypot]');

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    // Honeypot сработал — вероятнее всего это бот. Отклоняем без объяснений.
    if (honeypot && honeypot.value.trim() !== '') {
      form.reset();
      return;
    }

    let isValid = true;

    form.querySelectorAll('[data-required]').forEach((field) => {
      const group = field.closest('.form-group');
      const value = field.value.trim();
      let fieldValid = value.length > 0;

      if (field.type === 'email' && value) {
        fieldValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      }

      group.classList.toggle('has-error', !fieldValid);
      if (!fieldValid) isValid = false;
    });

    if (!isValid) return;

    // Реального бэкенда нет — имитируем успешную отправку.
    // TODO: подключить реальный обработчик (fetch к своему API / сервису форм),
    // добавить серверную валидацию и антиспам (honeypot на клиенте боты обходят
    // тривиально — на сервере нужен ещё капча/рейт-лимит).
    const nameField = form.querySelector('#name');
    const guestName = nameField ? nameField.value.trim() : '';

    if (successText) {
      // textContent, а не innerHTML — значение поля не интерпретируется как HTML
      successText.textContent = guestName
        ? `Спасибо, ${guestName}! Ваше сообщение отправлено — мы скоро ответим.`
        : 'Спасибо! Ваше сообщение отправлено — мы скоро ответим.';
    }

    if (successBox) successBox.classList.add('is-visible');
    form.reset();

    if (successBox) {
      setTimeout(() => successBox.classList.remove('is-visible'), 6000);
    }
  });
}

/* ---------- Лёгкий 3D-tilt для карточек при наведении мышью ----------
   Работает только на устройствах с точным указателем (мышь) и без
   prefers-reduced-motion — на тачскринах и при отключённой анимации
   карточки остаются в обычном состоянии. */
function initCardTilt() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!window.matchMedia('(pointer: fine)').matches) return;

  const cards = document.querySelectorAll(
    '.feature-card, .drink-card, .menu-card, .article-card, .testimonial-card'
  );

  cards.forEach((card) => {
    // Раньше getBoundingClientRect() читался на каждое mousemove — это
    // принудительный синхронный пересчёт layout на каждое из десятков
    // событий в секунду, и с несколькими картами под курсором именно
    // это подвешивало страницу. Теперь геометрия карты считывается один
    // раз при наведении (mouseenter), а сама отрисовка throttled через
    // requestAnimationFrame — визуально эффект тот же самый.
    let rect = null;
    let rafId = null;
    let pendingEvent = null;

    const applyTilt = () => {
      rafId = null;
      if (!rect || !pendingEvent) return;
      const px = (pendingEvent.clientX - rect.left) / rect.width - 0.5;
      const py = (pendingEvent.clientY - rect.top) / rect.height - 0.5;
      const rotateX = (-py * 8).toFixed(2);
      const rotateY = (px * 8).toFixed(2);
      card.style.transform = `perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-6px)`;
    };

    card.addEventListener('mouseenter', () => {
      rect = card.getBoundingClientRect();
    });

    card.addEventListener('mousemove', (e) => {
      pendingEvent = e;
      if (rafId === null) {
        rafId = requestAnimationFrame(applyTilt);
      }
    });

    card.addEventListener('mouseleave', () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      rect = null;
      pendingEvent = null;
      card.style.transform = '';
    });
  });
}

/* ---------- Карусель отзывов (index.html) ----------
   Библиотека Swiper (cdnjs, с integrity) превращает сетку отзывов
   в свайпаемую на телефоне карусель — на мобильном это ощутимо приятнее
   чтения, чем три сложенных друг под другом карточки. До инициализации
   JS `.swiper-wrapper` уже выглядит как обычная CSS grid-сетка (см.
   styles.css) — если Swiper не загрузился (офлайн/заблокирован CDN),
   секция остаётся полностью рабочей и просто не свайпается. */
function initTestimonialsCarousel() {
  const el = document.querySelector('.testimonials-track.swiper');
  if (!el || typeof Swiper === 'undefined') return;

  new Swiper(el, {
    slidesPerView: 1.08,
    spaceBetween: 18,
    grabCursor: true,
    a11y: { enabled: true },
    pagination: { el: '.testimonial-pagination', clickable: true },
    breakpoints: {
      560: { slidesPerView: 1.35, spaceBetween: 20 },
      760: { slidesPerView: 2, spaceBetween: 24 },
      1080: { slidesPerView: 3, spaceBetween: 28 },
    },
  });
}

/* ---------- Кнопка "наверх" ---------- */
function initBackToTop() {
  const btn = document.querySelector('.back-to-top');
  if (!btn) return;

  let isVisible = null;
  const onScroll = () => {
    const shouldBeVisible = window.scrollY > 480;
    if (shouldBeVisible === isVisible) return;
    isVisible = shouldBeVisible;
    btn.style.opacity = isVisible ? '1' : '0.4';
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}
