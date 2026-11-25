// Applies the saved theme before first paint (loaded as a classic,
// blocking script so the page never flashes the wrong colours).
(function () {
  var t = "auto";
  try {
    t = localStorage.getItem("taletree-theme") || "auto";
  } catch (e) {
    /* storage blocked: follow the system */
  }
  if (t !== "light" && t !== "dark") t = "auto";
  document.documentElement.dataset.theme = t;
})();
