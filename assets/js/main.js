(function () {
  "use strict";

  var toggle = document.getElementById("nav-toggle");
  var navList = document.getElementById("nav-list");

  if (!toggle || !navList) return;

  function closeMenu() {
    navList.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
  }

  function toggleMenu() {
    var isOpen = navList.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(isOpen));
  }

  toggle.addEventListener("click", toggleMenu);

  // Close the mobile menu after a nav link is used, and let the browser
  // handle the actual in-page scroll (native `scroll-behavior: smooth`,
  // which already respects prefers-reduced-motion via the CSS override).
  navList.addEventListener("click", function (event) {
    if (event.target.tagName === "A") {
      closeMenu();
    }
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") closeMenu();
  });
})();
