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

  navList.addEventListener("click", function (event) {
    if (event.target.tagName === "A") {
      closeMenu();
    }
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") closeMenu();
  });
})();
