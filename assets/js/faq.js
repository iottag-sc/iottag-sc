/* FAQ accordion — single-open, animated height, ARIA-driven. */
(() => {
  const faqs = document.querySelectorAll('.faq');
  if (!faqs.length) return;

  const setOpen = (item, open) => {
    const btn = item.querySelector('.faq__q');
    const panel = item.querySelector('.faq__a');
    btn.setAttribute('aria-expanded', String(open));
    item.classList.toggle('is-open', open);
    if (open) {
      panel.style.maxHeight = panel.scrollHeight + 'px';
    } else {
      // If the panel is at 'none' (settled open), pin its current height first
      // so the collapse actually animates instead of snapping.
      if (panel.style.maxHeight === 'none') {
        panel.style.maxHeight = panel.scrollHeight + 'px';
        void panel.offsetHeight;
      }
      panel.style.maxHeight = '0px';
    }
  };

  faqs.forEach((faq) => {
    faq.querySelectorAll('.faq__item').forEach((item) => {
      const btn = item.querySelector('.faq__q');
      const panel = item.querySelector('.faq__a');

      panel.addEventListener('transitionend', () => {
        // Let a settled-open panel grow freely if its content reflows.
        if (item.classList.contains('is-open')) panel.style.maxHeight = 'none';
      });

      btn.addEventListener('click', () => {
        const willOpen = !item.classList.contains('is-open');
        faq.querySelectorAll('.faq__item.is-open').forEach((other) => {
          if (other !== item) setOpen(other, false);
        });
        setOpen(item, willOpen);
      });
    });
  });
})();
